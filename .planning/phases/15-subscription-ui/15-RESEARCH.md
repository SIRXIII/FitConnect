# Phase 15: Subscription UI - Research

**Researched:** 2026-03-16
**Domain:** React subscription management UI (pricing page, trial banners, subscription management)
**Confidence:** HIGH

## Summary

Phase 15 builds the frontend surfaces that let trainers discover, start, and manage their subscriptions. The backend infrastructure is fully in place: `create-subscription` accepts a `priceId` and creates a 30-day trial, `manage-subscription` returns a Stripe Customer Portal URL, and the billing webhook syncs all state changes back to `trainer_profiles`. The auth store already exposes `subscription_tier`, `subscription_status`, `trial_ends_at`, `current_period_end`, and `cancel_at_period_end`.

The work decomposes into four distinct UI concerns: (1) a pricing/comparison page, (2) a trial expiration banner, (3) a subscription management tab in the trainer dashboard, and (4) a downgrade confirmation modal. All components follow the existing editorial design system (paper/ink/accent, serif italic headings, uppercase tracking labels).

**Primary recommendation:** Build a standalone `/pricing` page (public, marketing-friendly) with decomposed components, add a persistent trial banner in the layout level, and add a "Subscription" tab to the existing TrainerDashboard tab bar. Let the backend resolve price IDs from tier+interval rather than exposing Stripe price IDs to the frontend.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-01 | Trainer can start a 30-day free trial of Pro or Elite | PricingPage calls `create-subscription` with tier+interval; backend resolves priceId |
| BILL-02 | Trial ends with no payment = auto-cancel to Free | Webhook handles this; UI shows trial banner countdown and "add payment" CTA |
| BILL-03 | Trainer can upgrade from Free/trial to paid tier | "Manage Subscription" button calls `manage-subscription` -> Stripe Portal |
| BILL-04 | Monthly/annual billing toggle (annual = 20% discount) | BillingToggle component in PricingPage; prices defined in PRICING_DATA constant |
| BILL-05 | Upgrade/downgrade/cancel/update payment via Stripe Portal | SubscriptionTab "Manage Subscription" button -> `manage-subscription` edge function |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.x | UI framework | Already in use |
| React Router | 7.13.x | Routing (`/pricing` route) | Already in use |
| Zustand | 5.0.x | Auth store with subscription state | Already in use |
| Tailwind CSS | 4.2.x | Styling (editorial design system) | Already in use |
| Sonner | 2.0.x | Toast notifications | Already in use |
| Lucide React | 0.555.x | Icons | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | (not installed) | Trial countdown formatting | NOT NEEDED -- use native `Date` and `Intl.RelativeTimeFormat` or simple math; the app has no date library and adding one for "X days left" is overkill |

### No New Dependencies Required
All UI work uses existing libraries. No new npm packages needed.

## Architecture Patterns

### Recommended File Structure
```
src/
  pages/
    Pricing.tsx              # /pricing route - tier comparison page
  components/
    subscription/
      PricingTable.tsx        # Tier comparison grid with feature rows
      PlanCard.tsx            # Individual plan card (Free/Pro/Elite)
      BillingToggle.tsx       # Monthly/Annual switch with "Save 20%" badge
      TrialBanner.tsx         # Persistent trial countdown banner
      SubscriptionTab.tsx     # Dashboard tab: current plan status + manage CTA
      DowngradeModal.tsx      # Confirmation modal listing features to lose
  lib/
    subscription.ts           # PRICING_DATA constant, helper functions, Edge Function callers
```

### Pattern 1: Price ID Resolution (Backend-Side)

**What:** The frontend sends `{ tier: 'pro', interval: 'month' }` to `create-subscription`. The backend resolves the Stripe Price ID from its env vars.

**When to use:** Always -- this is the correct approach for this codebase.

**Why:** The `create-subscription` Edge Function currently expects a raw `priceId`. This requires a small modification to accept `{ tier, interval }` instead. The alternative (hardcoding VITE_STRIPE_PRICE_* env vars in the frontend) leaks Stripe internals into the client bundle and couples deploys to price ID changes.

**Implementation:** Modify `create-subscription/index.ts` to accept either `priceId` (backward compat) OR `{ tier, interval }`. Add a lookup map identical to the one already in `stripe-billing-webhook`:

```typescript
// In create-subscription/index.ts
const PRICE_MAP: Record<string, string> = {
  'pro:month':    Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')!,
  'pro:year':     Deno.env.get('STRIPE_PRICE_PRO_YEARLY')!,
  'elite:month':  Deno.env.get('STRIPE_PRICE_ELITE_MONTHLY')!,
  'elite:year':   Deno.env.get('STRIPE_PRICE_ELITE_YEARLY')!,
};

// Accept { tier, interval } OR { priceId }
const body = await req.json();
const priceId = body.priceId ?? PRICE_MAP[`${body.tier}:${body.interval}`];
if (!priceId) {
  return new Response(JSON.stringify({ error: 'Invalid tier/interval' }), { status: 400, ... });
}
```

**Confidence:** HIGH -- the webhook already uses this exact pattern (TIER_FROM_PRICE map on lines 49-54).

### Pattern 2: Edge Function Caller Helper

**What:** A thin wrapper in `src/lib/subscription.ts` that handles JWT retrieval, fetch, error handling, and typing.

**Why:** The TrainerDashboard already has this pattern inline for `create-connect-account` (lines 96-159). Extract into a reusable helper to avoid duplicating the abort-controller/error-handling boilerplate.

```typescript
// src/lib/subscription.ts
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function callEdgeFunction<T>(fnName: string, body?: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Session expired -- please sign in again.');
  if (!SUPABASE_URL) throw new Error('App not configured. Contact support.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error || `Server error (${res.status})`);
    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function startTrial(tier: 'pro' | 'elite', interval: 'month' | 'year') {
  return callEdgeFunction<{ subscriptionId: string; status: string }>(
    'create-subscription',
    { tier, interval }
  );
}

export async function getPortalUrl() {
  return callEdgeFunction<{ url: string }>('manage-subscription');
}
```

**Confidence:** HIGH -- follows existing fetch pattern in TrainerDashboard.tsx.

### Pattern 3: Trial Banner Placement

**What:** Render `TrialBanner` inside the main App layout, between `<Navbar />` and `<Routes>`, visible on ALL pages when a trainer is trialing with <= 7 days remaining.

**Why:** Success criteria #3 explicitly says "persistent banner." Placing it only in TrainerDashboard would miss pages like Messages, Bookings, and Trainer Profile. The Navbar is fixed-position, so the banner should render below it in the document flow.

```typescript
// In App.tsx, after <Navbar />
{profile?.role === 'trainer' && <TrialBanner />}
<Routes>...
```

The `TrialBanner` component internally checks `trainerProfile.subscription_status === 'trialing'` and `trial_ends_at` to decide whether to render. If more than 7 days remain or not trialing, it returns `null`.

**Confidence:** HIGH -- simple conditional rendering, same pattern as the existing `<Toaster />` placement.

### Pattern 4: Subscription Tab in Dashboard

**What:** Add `'subscription'` to the existing tab bar in TrainerDashboard (currently `overview | payouts | analytics`).

**Why:** The `manage-subscription` Edge Function already returns to `/trainer/dashboard?tab=subscription`. Adding a tab (not a separate page) keeps the navigation hierarchy flat and matches existing patterns.

```typescript
// TrainerDashboard.tsx tab bar update
const tabs = ['overview', 'payouts', 'analytics', 'subscription'] as const;
type Tab = typeof tabs[number];
const [activeTab, setActiveTab] = useState<Tab>(() => {
  const tabParam = searchParams.get('tab');
  return tabs.includes(tabParam as Tab) ? (tabParam as Tab) : 'overview';
});
```

**Confidence:** HIGH -- the tab bar already exists; this adds one entry.

### Pattern 5: Downgrade Confirmation Modal

**What:** Before redirecting to Stripe Portal for a downgrade, show a modal listing features the trainer will lose.

**Why:** Success criteria #5 requires listing exact features lost. Pull dynamically from `TIER_GATES` to stay in sync with Phase 14.

```typescript
// Compute features lost when downgrading from currentTier to targetTier
import { TIER_GATES, type TierFeature, type Tier } from '@/lib/tierGates';

function featuresLostOnDowngrade(from: Tier, to: Tier): TierFeature[] {
  return (Object.entries(TIER_GATES) as [TierFeature, Tier[]][])
    .filter(([, tiers]) => tiers.includes(from) && !tiers.includes(to))
    .map(([feature]) => feature);
}
```

**Confidence:** HIGH -- TIER_GATES is a static record, straightforward to diff.

### Pattern 6: State Refresh After Trial Start

**What:** After `create-subscription` returns `{ status: 'trialing' }`, call `fetchProfile(user.id)` to reload `trainerProfile` from the database.

**Why:** The webhook fires asynchronously. There may be a 1-3 second delay between the `create-subscription` response and the webhook updating the DB. Two strategies:

1. **Optimistic + poll:** Immediately show success UI, then poll `fetchProfile` at 1s intervals up to 5 times.
2. **Single refetch with fallback:** Call `fetchProfile` once after a 2-second delay. If `subscription_status` is still not `trialing`, show a "Subscription is being set up..." message that auto-resolves on next profile load.

**Recommendation:** Option 2 (simpler). The webhook processes in under 2 seconds in practice. If the profile doesn't reflect the change yet, a "Setting up..." message with a retry button is sufficient.

```typescript
const handleStartTrial = async (tier: 'pro' | 'elite', interval: 'month' | 'year') => {
  setLoading(true);
  try {
    await startTrial(tier, interval);
    toast.success('Trial started! Setting up your account...');
    // Give webhook time to fire
    await new Promise(r => setTimeout(r, 2000));
    await fetchProfile(user!.id);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to start trial');
  } finally {
    setLoading(false);
  }
};
```

**Confidence:** HIGH -- same pattern as `handleStripeConnect` in TrainerDashboard (line 146: `await fetchProfile(user.id)`).

### Anti-Patterns to Avoid
- **Exposing Stripe Price IDs in frontend env vars:** Couples the frontend build to Stripe dashboard configuration. If a price changes, you redeploy the frontend.
- **Building a custom subscription management UI:** Stripe Customer Portal handles upgrade, downgrade, cancel, payment method update. Don't rebuild what Stripe gives you for free.
- **Polling Supabase realtime for subscription changes:** Overkill for a one-time event. A single delayed `fetchProfile` is sufficient.
- **Separate `/subscription` page:** Creates navigation fragmentation. The trainer already lives in their dashboard; a tab is the right UX.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscription management portal | Custom upgrade/downgrade/cancel UI | Stripe Customer Portal (`manage-subscription` edge function) | Handles proration, payment method updates, SCA compliance, invoice history |
| Payment form | Custom card input | Stripe Portal (trial start needs no card) | PCI compliance, 3D Secure, error handling |
| Trial countdown | Custom timer with setInterval | Simple date math on `trial_ends_at` | No live countdown needed; "X days left" updates on page load |
| Feature comparison data | Hardcoded feature lists per tier | Derive from `TIER_GATES` + human-readable copy map | Single source of truth, stays in sync with Phase 14 gates |

## Common Pitfalls

### Pitfall 1: Webhook Delay After Trial Start
**What goes wrong:** Trainer clicks "Start Trial," `create-subscription` returns success, but `fetchProfile` still shows `subscription_tier: 'free'` because the webhook hasn't fired yet.
**Why it happens:** Stripe webhook delivery takes 1-5 seconds.
**How to avoid:** Add a 2-second delay before `fetchProfile`. Show intermediate "Setting up..." state. The user sees success toast immediately.
**Warning signs:** Tier badge doesn't update; trainer refreshes page and it works.

### Pitfall 2: Price Display Drift
**What goes wrong:** Hardcoded prices in the frontend don't match Stripe price objects.
**Why it happens:** Someone changes prices in Stripe dashboard but forgets to update the frontend.
**How to avoid:** Define prices in a single `PRICING_DATA` constant in `src/lib/subscription.ts`. Add a code comment noting the Stripe dashboard is the source of truth. For v2.1, hardcoded is acceptable; a `get-prices` endpoint is deferred complexity.
**Warning signs:** Customer sees $9/mo in the app but gets charged $12/mo.

### Pitfall 3: Trial Banner Flicker on Page Load
**What goes wrong:** Banner briefly appears then disappears as `trainerProfile` loads asynchronously.
**Why it happens:** Initial state has `trainerProfile: null`, then loads.
**How to avoid:** Only render `TrialBanner` when `trainerProfile` is loaded (not null). If `loading` is true in auth store, render nothing.
**Warning signs:** Flash of trial banner on non-trainer pages.

### Pitfall 4: Pricing Page Accessible After Subscribing
**What goes wrong:** A trainer with an active Pro subscription visits `/pricing` and clicks "Start Trial" again.
**Why it happens:** No guard on the CTA button based on current subscription state.
**How to avoid:** The `create-subscription` backend already returns 409 if `subscription_id` exists. But the UI should also disable/replace the CTA: show "Current Plan" badge instead of "Start Trial" for the active tier, and "Manage Subscription" for upgrade paths.
**Warning signs:** Confusing error toast when trainer clicks a button that shouldn't exist.

### Pitfall 5: DowngradeModal Not Knowing Target Tier
**What goes wrong:** The downgrade modal doesn't know what tier the trainer is downgrading TO, so it can't compute which features are lost.
**Why it happens:** Clicking "Manage Subscription" redirects to Stripe Portal where the downgrade happens.
**How to avoid:** The in-app downgrade confirmation modal is shown BEFORE the portal redirect. Since the portal handles the actual tier change, the modal should show features for downgrading to Free (the only in-app downgrade path). For tier-to-tier changes (Elite -> Pro), those happen in the Stripe Portal itself.
**Warning signs:** Modal shows wrong feature list.

## Code Examples

### Pricing Data Constant
```typescript
// src/lib/subscription.ts
export type BillingInterval = 'month' | 'year';

export interface PlanPricing {
  tier: 'free' | 'pro' | 'elite';
  name: string;
  monthlyPrice: number;       // Monthly price in dollars
  annualPrice: number;         // Annual price in dollars (total per year)
  annualMonthly: number;       // Annual price divided by 12
  features: string[];
  highlighted?: boolean;
}

export const PRICING_DATA: PlanPricing[] = [
  {
    tier: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    annualMonthly: 0,
    features: [
      'Up to 3 visible availability slots',
      'Basic trainer profile',
      'Standard bio (280 characters)',
      'Standard search ranking',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    monthlyPrice: 9,
    annualPrice: 86.40,
    annualMonthly: 7.20,
    highlighted: true,
    features: [
      'Up to 10 visible availability slots',
      'Extended bio (1000 characters)',
      'Advanced analytics dashboard',
      'Priority search ranking',
      '30-day free trial',
    ],
  },
  {
    tier: 'elite',
    name: 'Elite',
    monthlyPrice: 29,
    annualPrice: 278.40,
    annualMonthly: 23.20,
    features: [
      'Unlimited visible availability slots',
      'Extended bio (1000 characters)',
      'Advanced analytics dashboard',
      'Priority search ranking',
      'Featured on landing page',
      '30-day free trial',
    ],
  },
];
```

### Trial Banner Component Shape
```typescript
// src/components/subscription/TrialBanner.tsx
import { useAuthStore } from '@/stores/auth';

export const TrialBanner: React.FC = () => {
  const { trainerProfile } = useAuthStore();

  if (!trainerProfile) return null;
  if (trainerProfile.subscription_status !== 'trialing') return null;
  if (!trainerProfile.trial_ends_at) return null;

  const daysLeft = Math.ceil(
    (new Date(trainerProfile.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  // Only show when 7 or fewer days remain (success criteria #3: absent when > 7 days)
  if (daysLeft > 7) return null;

  const tierName = trainerProfile.subscription_tier === 'elite' ? 'Elite' : 'Pro';

  return (
    <div className="bg-accent/5 border-b border-accent/10 px-6 py-3 text-center">
      <p className="text-xs tracking-wide text-ink/70">
        <span className="font-medium">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
        {' '}in your {tierName} trial
        {' '}&mdash;{' '}
        <a href="/trainer/dashboard?tab=subscription" className="text-accent underline underline-offset-2">
          add payment to keep access
        </a>
      </p>
    </div>
  );
};
```

### Dashboard Tier Badge
```typescript
// Inside SubscriptionTab.tsx or TrainerDashboard header
const tierBadgeText = () => {
  const { trainerProfile } = useAuthStore();
  if (!trainerProfile) return '';

  const tierName = trainerProfile.subscription_tier === 'elite' ? 'Elite'
    : trainerProfile.subscription_tier === 'pro' ? 'Pro' : 'Free';

  if (trainerProfile.subscription_status === 'trialing' && trainerProfile.trial_ends_at) {
    const endDate = new Date(trainerProfile.trial_ends_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    });
    return `${tierName} -- Trialing until ${endDate}`;
  }

  return tierName;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom billing UI | Stripe Customer Portal redirect | Stripe Portal v2 (2023) | Don't build upgrade/downgrade/cancel forms; redirect to Portal |
| Stripe Checkout for trials | `stripe.subscriptions.create` with `trial_period_days` | Always available | No-card trial start without redirect; already implemented in backend |
| Client-side price IDs | Backend price resolution | Best practice | Eliminates VITE_STRIPE_PRICE_* env vars from frontend |

## Routing Decision

**Recommendation:** `/pricing` should be a PUBLIC route (no `ProtectedRoute` wrapper).

**Rationale:**
- Marketing value: unauthenticated visitors can see pricing before signing up
- The "Start Free Trial" CTA checks auth state: if not logged in, redirects to `/login?redirect=/pricing`
- If logged in and already subscribed, CTA changes to "Current Plan" or "Manage Subscription"
- This matches the existing pattern where `/trainers/:id` is public

## Edge Function Modification Required

The `create-subscription` Edge Function currently requires a raw `priceId` in the request body. Phase 15 should modify it to also accept `{ tier, interval }` as an alternative. This is a small change (add a lookup map, ~10 lines) and keeps backward compatibility.

**This is the only backend change needed for Phase 15.** Everything else is pure frontend.

## Open Questions

1. **LockedFeatureBanner upgrade CTA**
   - What we know: The component has a comment "Upgrade CTA placeholder -- Phase 15 will add the pricing page link"
   - What's unclear: Should it link to `/pricing` or to `/trainer/dashboard?tab=subscription`?
   - Recommendation: Link to `/pricing` -- it gives the trainer full context on what each tier offers before committing.

2. **Annual billing default**
   - What we know: Annual saves 20%, better for retention
   - What's unclear: Should the toggle default to monthly or annual?
   - Recommendation: Default to monthly (lower sticker shock), but make the annual savings prominent. This is a standard SaaS pattern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x + @testing-library/react 16.3.x |
| Config file | `vite.config.ts` (test block at line 22-25) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | startTrial calls edge function with tier+interval | unit | `npx vitest run src/lib/subscription.test.ts -t "startTrial"` | No -- Wave 0 |
| BILL-02 | TrialBanner shows when <= 7 days remain, hidden when > 7 | unit | `npx vitest run src/components/subscription/TrialBanner.test.tsx -t "banner"` | No -- Wave 0 |
| BILL-03 | "Manage Subscription" calls manage-subscription and redirects | unit | `npx vitest run src/components/subscription/SubscriptionTab.test.tsx -t "manage"` | No -- Wave 0 |
| BILL-04 | BillingToggle switches prices and shows "Save 20%" | unit | `npx vitest run src/components/subscription/BillingToggle.test.tsx -t "toggle"` | No -- Wave 0 |
| BILL-05 | DowngradeModal lists correct features lost | unit | `npx vitest run src/components/subscription/DowngradeModal.test.tsx -t "features"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/subscription.test.ts` -- covers BILL-01 (startTrial helper)
- [ ] `src/components/subscription/TrialBanner.test.tsx` -- covers BILL-02
- [ ] `src/components/subscription/SubscriptionTab.test.tsx` -- covers BILL-03
- [ ] `src/components/subscription/BillingToggle.test.tsx` -- covers BILL-04
- [ ] `src/components/subscription/DowngradeModal.test.tsx` -- covers BILL-05

Existing test infrastructure (vitest + jsdom + testing-library) is already installed and configured. No Wave 0 framework setup needed.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `create-subscription/index.ts` -- confirms priceId-based API contract
- Codebase inspection: `manage-subscription/index.ts` -- confirms portal URL return pattern
- Codebase inspection: `stripe-billing-webhook/index.ts` -- confirms TIER_FROM_PRICE map pattern
- Codebase inspection: `TrainerDashboard.tsx` -- confirms tab bar pattern and Stripe Connect fetch pattern
- Codebase inspection: `useTier.ts` / `tierGates.ts` -- confirms tier/feature gate architecture
- Codebase inspection: `auth.ts` store -- confirms `fetchProfile` as refresh mechanism
- Codebase inspection: `LockedFeatureBanner.tsx` -- confirms Phase 15 upgrade CTA placeholder

### Secondary (MEDIUM confidence)
- Stripe Customer Portal documentation -- redirect-based management pattern
- Stripe Billing trial_period_days -- no-card trial flow

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libraries
- Architecture: HIGH -- all patterns derived from existing codebase conventions
- Pitfalls: HIGH -- identified from direct codebase inspection and known Stripe webhook timing
- Price ID handling: HIGH -- webhook already uses identical PRICE_MAP pattern

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- no fast-moving dependencies)
