# Feature Research

**Domain:** Trainer-facing subscription tiers on a luxury fitness marketplace (SaaS B2B2C)
**Researched:** 2026-03-15
**Confidence:** HIGH (Stripe docs + verified SaaS patterns) / MEDIUM (competitive comparisons)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features trainers assume exist once a subscription tier is introduced. Missing these makes the tier feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clear tier comparison page | Users need to see what they're buying before committing | LOW | Pricing table with feature checklist; annual/monthly toggle |
| Monthly + annual billing toggle | Industry standard; annual = 20% discount is the sweet spot | LOW | Stripe `price` objects per interval; toggle updates displayed price |
| 30-day free trial, no card required | Removes sign-up friction; "no card" outperforms card-required for marketplace B2B | LOW | Stripe `trial_period_days` on subscription; no `payment_method` needed during trial |
| In-app subscription status indicator | Trainers expect to see current tier + next billing date at a glance | LOW | Read from Stripe customer portal or cached DB column |
| Self-serve upgrade path | Trainers must be able to upgrade without contacting support | MEDIUM | Stripe Checkout or Payment Element; proration handled automatically |
| Self-serve cancel/downgrade path | FTC Click-to-Cancel rule (2025) mandates cancellation is as easy as signup | MEDIUM | Must not require email or support ticket; in-app flow required |
| Invoice history | Trainers need receipts for tax purposes | LOW | Stripe Customer Portal covers this out of the box |
| Slot gate enforcement at display layer | Free-tier trainers must never show more than 3 slots to clients | MEDIUM | Query-level enforcement in trainer search RPC; not just UI hide |
| Trial expiry email sequence | Users forget trial ends; 3-day and 1-day warning emails are expected | MEDIUM | Edge Function + Resend; Stripe `customer.subscription.trial_will_end` webhook |
| Grace period on failed payment | Involuntary churn via card decline is common; brief retry window is industry norm | MEDIUM | Stripe `dunning` settings; Stripe retries 3-4x by default over ~7 days |

### Differentiators (Competitive Advantage)

Features that justify the upgrade cost and are specific to FitRush's positioning as a luxury marketplace.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Priority search placement (Pro) | Directly converts to more bookings; tangible ROI | MEDIUM | Add `tier_rank` column to profiles; weight into existing search query ORDER BY |
| Advanced analytics tab (Pro) | Trainers can optimize their idle-hour strategy with trend data | LOW | Already built; gate visibility by tier in frontend check + DB policy |
| Featured section on landing page (Elite) | Maximum client acquisition surface; exclusive and visible | MEDIUM | Curated section above trainer grid; query Elite trainers only; rotate or static |
| Custom bio (Pro/Elite) | Differentiation vs free generic bio; luxury brand signal | LOW | Character limit increase or rich text; simple schema change |
| Custom branded URL (Elite) | `/trainer/jane-doe` vs `/trainer/uuid`; professionalism signal | MEDIUM | Requires slug field on profiles + routing logic; slug uniqueness constraint |
| Priority support (Elite) | Perceived value for $29/mo even if rarely used | LOW | Separate support email/tag; no infrastructure change; SLA commitment only |
| Pause subscription (all paid tiers) | Reduces cancellations by ~30%; pause 1-3 months beats losing trainer entirely | MEDIUM | Stripe pause collection; feature gates revert to Free during pause |
| Upgrade prompt with booking-impact message | Show "You'd appear to 3x more clients on Pro" at slot limit hit | LOW | Upsell modal triggered on gated action; contextual copy beats generic |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Hard slot deletion on downgrade | "Enforce the limit cleanly" | Destroys trainer data; causes support escalations and rage churn | Soft-hide excess slots from client view; flag in dashboard "3 of 8 slots visible — upgrade to show all" |
| Immediate feature removal on cancel | "Stop giving access once cancelled" | Trainers have paid through the billing period; removing access mid-cycle is a trust violation | Schedule removal for billing period end; show countdown in UI |
| Card-required free trial | Higher-intent signups | Significantly reduces trial starts; marketplace trainers are acquisition-sensitive | No-card trial; collect card at trial-end conversion prompt |
| Per-booking percentage fee on top of tier | "Extra monetization lever" | Stacks with existing 8% platform fee; trainers will feel double-taxed; erodes trust | Keep flat tier pricing; platform fee stays 8% regardless of tier |
| Automatic upgrade when slot limit hit | "Frictionless revenue" | Dark pattern; causes chargebacks and support issues; potentially illegal in some jurisdictions | Gate action, show upgrade modal, require explicit confirmation |
| Annual-only pricing for Elite | "Lock in high-value users" | Limits adoption; $29/mo already high for early-stage marketplace | Offer both; annual discount incentivizes without mandating |
| Public tier badge on trainer card | "Social proof for Elite trainers" | Reveals business model to clients who don't care; may feel pay-to-win | Keep tier signals internal to trainer dashboard only |

---

## Feature Dependencies

```
[Stripe Billing integration]
    └──required by──> [Subscription create/upgrade/downgrade UI]
    └──required by──> [Trial with no card]
    └──required by──> [Invoice history]
    └──required by──> [Grace period dunning]
    └──required by──> [Annual billing toggle]

[trainer_subscriptions DB table (tier + status + Stripe IDs)]
    └──required by──> [Slot gate enforcement]
    └──required by──> [Priority search placement]
    └──required by──> [Advanced analytics gate]
    └──required by──> [Featured section query]
    └──required by──> [Admin tier status view]
    └──required by──> [Manual tier override]

[Stripe webhook handler (subscription events)]
    └──required by──> [Trial expiry emails]
    └──required by──> [Tier sync on upgrade/downgrade]
    └──required by──> [Grace period enforcement]
    └──required by──> [MRR calculation]

[Slot gate enforcement]
    └──enhances──> [Upgrade prompt with booking-impact message]

[Custom branded URL (slug)]
    └──requires──> [Profile slug field + uniqueness constraint]
    └──requires──> [Router change for /trainer/:slug]

[Advanced analytics tab]
    └──already built──> [gate visibility only; no new analytics work needed]

[Priority search placement]
    └──depends on──> [Discount-based weighted ranking (deferred in PROJECT.md)]
    └──note──> [Tier rank is independent weight; can ship without discount weighting]

[Featured section on landing page]
    └──conflicts with──> [Referral leaderboard layout] (both compete for landing page real estate)
    └──resolve──> [Featured trainers section above leaderboard; distinct visual treatment]
```

### Dependency Notes

- **Stripe Billing is the foundational dependency.** Everything else — gating, trials, invoices, admin MRR — flows from subscription state managed in Stripe.
- **trainer_subscriptions table is the enforcement source of truth.** Client-facing queries must read from this table, not from a frontend prop, to prevent gate bypass.
- **Custom branded URL has routing implications.** Must handle slug collisions, slug changes (redirect old URL), and reserved slugs (admin, login, etc.).
- **Advanced analytics is already built.** This is a gating task only — show/hide the tab based on tier. No new analytics development needed.
- **Featured section conflicts with landing page layout.** The referral leaderboard is already placed on the landing page. Featured trainers section needs deliberate placement to avoid visual competition.

---

## MVP Definition

This is a subsequent milestone (v2.1), not a greenfield product. "MVP" here means the minimum to make the tier system real and trustworthy.

### Launch With (v2.1 core)

- [ ] Stripe Billing integration — subscriptions, webhooks, plan sync to DB
- [ ] trainer_subscriptions table — tier, status, stripe_subscription_id, trial_end, billing_interval
- [ ] Slot gate enforcement — query-level, not UI-only; Free = 3, Pro = 10, Elite = unlimited
- [ ] Subscription management UI — pricing page, upgrade flow, cancel/downgrade flow
- [ ] Trial start flow — no card required; 30 days; converts on card entry at trial end
- [ ] Trial expiry emails — 3-day warning + 1-day warning via existing Resend integration
- [ ] Priority search placement (Pro) — tier_rank weight in trainer search ORDER BY
- [ ] Advanced analytics gate — hide analytics tab for Free tier (already built; just gate it)
- [ ] Featured trainers section (Elite) — landing page section querying Elite trainers
- [ ] Annual billing toggle — 20% discount; Stripe yearly price objects
- [ ] Admin: tier status per trainer — visible in existing user management table
- [ ] Admin: MRR + subscriber count — new metrics in existing admin analytics tab

### Add After Validation (v2.1.x)

- [ ] Custom branded URL (slug) — routing complexity warrants its own slice after core ships
- [ ] Pause subscription — reduces churn; lower priority than initial tier launch
- [ ] Upgrade prompt contextual modals — polish layer; add after gating is stable
- [ ] Invoice history via Stripe Customer Portal — low effort, add when trainers request it

### Future Consideration (v2.2+)

- [ ] Per-tier slot notification preferences — Fine-grained control; wait for trainer feedback
- [ ] Tier-based client messaging limits — Would require message infrastructure changes
- [ ] White-label coach page (beyond custom URL) — Significant design/infra investment

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Stripe Billing + DB table | HIGH | MEDIUM | P1 |
| Slot gate enforcement (query level) | HIGH | MEDIUM | P1 |
| Subscription management UI | HIGH | MEDIUM | P1 |
| Trial flow (no card) | HIGH | LOW | P1 |
| Trial expiry emails | HIGH | LOW | P1 |
| Priority search placement | HIGH | LOW | P1 |
| Advanced analytics gate | HIGH | LOW | P1 |
| Annual billing toggle | MEDIUM | LOW | P1 |
| Admin tier status + MRR | MEDIUM | LOW | P1 |
| Featured trainers section | HIGH | MEDIUM | P1 |
| Custom branded URL | MEDIUM | MEDIUM | P2 |
| Pause subscription | MEDIUM | MEDIUM | P2 |
| Upgrade prompt modals | MEDIUM | LOW | P2 |
| Stripe Customer Portal (invoices) | LOW | LOW | P2 |

---

## Behavior Specifications

### Trial Expiry Behavior

1. Trainer signs up → Stripe subscription created with `trial_period_days: 30`, no `default_payment_method`
2. At day 27 → `customer.subscription.trial_will_end` webhook fires → send 3-day warning email
3. At day 29 → send 1-day warning email
4. At day 30 (trial end) with no card → subscription status becomes `past_due` or `canceled` depending on Stripe config
   - **Recommended:** Use `trial_settings.end_behavior.missing_payment_method: cancel` so subscription cancels cleanly rather than entering dunning
5. After trial ends without converting → trainer reverts to Free tier immediately; no grace period on intentional non-conversion
6. If trainer adds card before trial ends → subscription activates on trial end; pro-rated charge for first partial month applies

### Slot Gate Enforcement Behavior

- Slot count is enforced at **query time in the trainer search RPC**, not at UI render time
- Free tier: `LIMIT 3` on visible slots ordered by `created_at ASC` (oldest = most reliable signals)
- Pro tier: `LIMIT 10`
- Elite tier: no limit
- On downgrade from Pro to Free: excess slots (slots 4–10) remain in DB but are hidden from client-facing queries
  - Trainer dashboard shows: "3 of 8 slots visible — upgrade to show all"
  - No slots are deleted
- On upgrade from Free to Pro: hidden slots become visible immediately (no re-creation needed)
- **New slot creation** is also gated: Free trainer cannot create a 4th slot; show upgrade prompt

### Upgrade Behavior

- Upgrades take effect immediately
- Proration applied: trainer charged only for remaining days at new tier price
- Stripe `proration_behavior: create_prorations` (default) — proration line item on next invoice
- Feature access granted immediately on Stripe webhook `customer.subscription.updated` with new tier
- Do not wait for next billing cycle to grant access

### Downgrade Behavior

- Downgrades are **scheduled to the end of current billing period** (Zoom/GitHub model)
- Trainer retains current tier features until billing period ends
- UI shows: "Your [tier] access ends on [date]. After that, you'll move to [lower tier]."
- On billing period end: webhook fires → update DB tier → enforce new gates
- Excess slots become hidden (not deleted) on downgrade effective date
- Custom URL/slug: retained in DB but no longer resolves if trainer downgrades from Elite (redirect to standard URL); reactivates on re-upgrade

### Cancellation Behavior

- Cancel schedules for end of billing period (never immediate mid-cycle removal)
- Cancellation flow must include: reason survey (optional), pause offer, downgrade-to-Free offer
- After cancel effective date: trainer reverts to Free tier automatically; no account deletion
- Failed payment / involuntary churn: Stripe retries 4x over 7 days (configure in Stripe dashboard); after exhaustion → cancel and revert to Free; send notification email
- Stripe `cancel_at_period_end: true` is the correct API behavior for end-of-period cancel

### Featured Placement Behavior

- Elite trainers are queried for the featured section on the landing page
- If > N Elite trainers exist, rotate daily (deterministic: `ORDER BY trainer_id, date_trunc('day', now())` hash) to ensure fairness
- If 0 Elite trainers exist, section is hidden (do not show empty section or fall back to Pro trainers — that dilutes the Elite value proposition)
- Admin can manually pin specific Elite trainers to featured (override rotation)

### Annual Billing Behavior

- Annual plan = 12 months prepaid at 20% discount (~$7.20/mo Pro, ~$23.20/mo Elite)
- Stripe: separate `price` objects for monthly and annual intervals on each product
- Downgrade from annual to monthly: takes effect at annual period end; trainer gets full annual period at lower price
- Upgrade from monthly to annual: proration calculated; trainer charged difference for remainder of year
- No refund on annual plans — clearly stated at checkout

### Admin Manual Override Behavior

- Admin can grant any tier (Free/Pro/Elite) to any trainer, bypassing billing
- Override stored as `manual_override: true` + `override_tier: 'pro'` on trainer record
- Manual override does not create or modify Stripe subscription
- Override persists until admin removes it or trainer subscribes normally (subscription supersedes override)
- Admin overrides are audited (who granted, when, reason)

---

## Competitor Feature Analysis

| Feature | Trainerize | Fyt | FitRush Approach |
|---------|------------|-----|-----------------|
| Subscription tiers for trainers | Yes (Free/Pro/Studio) — client count limits | No trainer tiers (platform fee model) | Slot visibility + search placement; aligns with idle-hour model |
| Free tier | 1 active client (very restrictive) | N/A | 3 slots visible; usable but clearly limited |
| Slot/client hard limit enforcement | Excess clients auto-deactivated | N/A | Soft-hide (preserve data); show upgrade prompt |
| Featured placement | No | No | Elite-exclusive; high perceived value |
| Custom URL/branding | Yes (paid tiers) | No | Elite only; slug-based routing |
| Annual discount | ~16% | N/A | 20% (slightly above industry median to drive annual commits) |
| No-card trial | No (card required) | N/A | Yes; reduces friction for trainer acquisition |

---

## Implementation Patterns: Deep Dives

This section provides opinionated implementation specifics for the 10 highest-complexity patterns in v2.1. These supersede general guidance where the two conflict.

---

### Pattern 1: Upgrade Flow UX

**Recommended: Feature-access triggered modals, not proactive interruption.**

Allow full navigation and read access at every tier. Trigger the upgrade modal only when a trainer attempts a gated write or action — not on page load, not after a timer.

Trigger points:
- Clicking "Add Slot" when at the Free tier slot ceiling (3)
- Clicking "View Full Analytics" when on Free tier
- Editing the "Custom URL" field when not on Elite
- The upgrade prompt is one modal per session per gate — after dismissal, revert to an inline banner for the rest of the session

Frame prompts as discovery, not restriction. "You've found a Pro feature" outperforms "Upgrade required." The gold `#C5A059` accent on the CTA is the single focal point — no competing CTAs in the upgrade modal.

Persistent non-blocking banners live at the top of gated pages (e.g., the Analytics page shows a gold bar for Free trainers). They do not appear on every page — only on pages where the primary content is gated.

**Confidence:** HIGH — sourced from Appcues freemium upgrade case study, Sankalpjonna paywall trigger analysis, Userpilot modal UX guide.

---

### Pattern 2: Trial-to-Paid Conversion Flow

**Trial countdown banner schedule:**

| Days Remaining | Banner Style | Copy |
|---|---|---|
| 30–8 | Subtle gold bar | "Trial active — X days remaining. Upgrade anytime." |
| 7 | Amber warning | "7 days left on your trial. Choose a plan to keep Pro access." |
| 3 | Orange with date | "3 days left — your visible slots drop to 3 on [exact date]." |
| 1 | Red with inline CTA | "Last day. Add a card to keep Pro access — 30 seconds." |
| 0 | Modal on next login | "Your trial ended. Choose a plan or continue on Free." |

Specificity converts. "Your visible slots drop to 3 on March 22" outperforms "trial ends soon" because it attaches a concrete cost to inaction.

**No-card trial means payment is collected at trial end, not before.** The upgrade CTA during trial routes to: billing period selector (annual/monthly toggle) → Stripe Checkout → card capture. Do not collect card mid-trial unless trainer initiates upgrade.

**Activation milestone trigger (supplementary):** If a trainer receives their first booking during trial, fire a contextual upgrade nudge: "You got your first booking! Upgrade to Pro to show 10 slots and book more." This is a behavioral trigger, not calendar-based, and converts at higher rates than countdown-only approaches.

**Confidence:** HIGH — sourced from 1Capture SaaS conversion benchmarks (10,000+ companies), Demogo 2025 trial optimization guide.

---

### Pattern 3: React Feature Gate Implementation

**Use a hook + feature registry. Not HOC, not inline tier string comparisons.**

The codebase uses Zustand for auth state. Extend the same pattern with a `useTier` hook that reads from `trainerProfile` (once `trainer_subscriptions` table exists, it reads from there via a subscription field on `trainerProfile`).

```typescript
// src/lib/tierGates.ts
export type Tier = 'free' | 'pro' | 'elite';

export type TierFeature =
  | 'slots_ten'
  | 'slots_unlimited'
  | 'custom_bio'
  | 'custom_url'
  | 'analytics_advanced'
  | 'priority_search'
  | 'featured_landing';

// Single source of truth for what each tier unlocks.
// Adding a new feature or moving a feature between tiers = one line change here.
export const TIER_GATES: Record<TierFeature, Tier[]> = {
  slots_ten:          ['pro', 'elite'],
  slots_unlimited:    ['elite'],
  custom_bio:         ['pro', 'elite'],
  custom_url:         ['elite'],
  analytics_advanced: ['pro', 'elite'],
  priority_search:    ['pro', 'elite'],
  featured_landing:   ['elite'],
};
```

```typescript
// src/hooks/useTier.ts
export function useTier() {
  const { trainerProfile } = useAuthStore();
  // trainerProfile will gain a `subscription_tier` field once the DB table is added
  const tier: Tier = (trainerProfile?.subscription_tier as Tier) ?? 'free';
  const isTrialing: boolean = trainerProfile?.subscription_status === 'trialing';
  const trialEndsAt: string | null = trainerProfile?.trial_ends_at ?? null;
  return { tier, isTrialing, trialEndsAt };
}

export function useCan(feature: TierFeature): boolean {
  const { tier, isTrialing } = useTier();
  // During trial, all features are accessible regardless of tier
  if (isTrialing) return true;
  return TIER_GATES[feature].includes(tier);
}
```

Component usage stays clean and never contains string comparisons:

```tsx
const canAdvancedAnalytics = useCan('analytics_advanced');

return canAdvancedAnalytics
  ? <AdvancedAnalyticsDashboard />
  : <LockedFeaturePlaceholder feature="analytics_advanced" />;
```

`LockedFeaturePlaceholder` is a reusable component that takes `feature` and knows how to render the lock icon, tooltip, and upgrade CTA for that specific gate. This keeps upgrade prompt copy co-located with the gate rather than scattered.

**Confidence:** HIGH — hook pattern matches PostHog, Unleash, Reflag SDK shapes. Feature registry is industry-standard for maintainability (Octopus Deploy feature flag best practices).

---

### Pattern 4: Slot Visibility Gating

**Enforce at the Postgres RPC layer, not the frontend.**

Frontend `LIMIT` or filter is not enforcement — it is trivially bypassed via direct API calls. RLS policies control row-level access but cannot enforce row count limits based on another table's value. The correct layer is a Postgres function called via Supabase RPC.

```sql
-- Called by the client search page; replaces direct availability_slots query
CREATE OR REPLACE FUNCTION get_trainer_public_slots(p_trainer_id UUID)
RETURNS SETOF availability_slots AS $$
DECLARE
  v_tier TEXT;
  v_limit INT;
BEGIN
  -- Read the trainer's current active tier from the subscriptions table.
  -- Falls back to 'free' if no active subscription found.
  SELECT COALESCE(ts.tier, 'free') INTO v_tier
  FROM trainer_subscriptions ts
  WHERE ts.trainer_id = p_trainer_id
    AND ts.status IN ('active', 'trialing')
  LIMIT 1;

  v_limit := CASE v_tier
    WHEN 'elite' THEN NULL   -- NULL = no LIMIT applied
    WHEN 'pro'   THEN 10
    ELSE              3      -- free or missing subscription
  END;

  RETURN QUERY
  SELECT *
  FROM availability_slots
  WHERE trainer_id = p_trainer_id
    AND is_booked = false
    AND deleted_at IS NULL
    AND start_time > NOW()
  ORDER BY start_time ASC
  LIMIT v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

The trainer's own dashboard query is separate — it shows all slots (not limited), with a visual indicator of which ones are "hidden from clients" due to their current tier. The trainer needs to see their full slot inventory; only the client-facing query is limited.

**Confidence:** MEDIUM-HIGH — pattern is correct for Supabase/Postgres. `trainer_subscriptions` table schema is not yet defined; the RPC will need updating once that schema is finalized.

---

### Pattern 5: Priority Search Ranking

**Use `ORDER BY CASE` on a denormalized tier column. No separate ranking job or re-sort trigger.**

The tier column should be denormalized onto `trainer_profiles` (or `profiles`) so the search query does not require a join to `trainer_subscriptions` on every search. Sync it via the Stripe webhook handler.

```sql
SELECT
  tp.*,
  CASE tp.subscription_tier   -- denormalized column, not a join
    WHEN 'elite' THEN 1
    WHEN 'pro'   THEN 2
    ELSE              3        -- free
  END AS tier_rank
FROM trainer_profiles tp
WHERE tp.location_city = $1
  -- other filter conditions
ORDER BY
  tier_rank ASC,               -- Elite first, Pro second, Free third
  tp.rating DESC,              -- within same tier: higher rated appears first
  tp.review_count DESC         -- tiebreak: more reviewed trainers rank higher
LIMIT 20 OFFSET $2;
```

This is evaluated per-row during sort on an already-filtered result set — it does not require scanning the full table. Adding `CREATE INDEX ON trainer_profiles(subscription_tier)` helps the planner but the `CASE` expression in `ORDER BY` works correctly without it.

**Why not a numeric `search_priority` column:** A `search_priority` number gets stale when tier definitions change. The `CASE` on a tier string always reflects current tier logic and is changed in one place (the SQL function) when requirements evolve.

**Confidence:** HIGH — `ORDER BY CASE` is a standard and well-documented Postgres pattern. Denormalized tier column is the recommended approach for Stripe+Supabase (avoids join on search hot path).

---

### Pattern 6: Featured Section on Landing Page

**Two independent queries. Graceful fallback. Never show an empty featured section.**

```typescript
// Featured trainers — aggressive caching, rarely changes
const { data: featuredTrainers } = useQuery({
  queryKey: ['trainers', 'featured'],
  queryFn: async () => {
    const { data } = await supabase
      .from('trainer_profiles')
      .select('id, user_id, specialty, rating, review_count, ...')
      .eq('subscription_tier', 'elite')
      .eq('verified', true)
      .order('rating', { ascending: false })
      .limit(6);
    return data ?? [];
  },
  staleTime: 5 * 60 * 1000,  // 5 minutes — Elite membership changes are low-frequency
});

// Top-rated fallback — used when no Elite trainers exist
const { data: topTrainers } = useQuery({
  queryKey: ['trainers', 'top-rated'],
  queryFn: () => supabase.rpc('get_top_rated_trainers', { limit: 6 }),
  staleTime: 2 * 60 * 1000,
});
```

```tsx
// Landing page rendering
{featuredTrainers && featuredTrainers.length > 0 ? (
  <FeaturedTrainersSection
    trainers={featuredTrainers}
    heading="Elite Trainers"
  />
) : (
  // Falls back silently — client never sees an empty section
  <FeaturedTrainersSection
    trainers={topTrainers ?? []}
    heading="Top Rated Trainers"
  />
)}
```

**Do not UNION the queries** — merging featured + regular into one query makes the component layout rigid and couples the rendering logic to the query shape unnecessarily.

**Add a `featured_eligible` boolean to `trainer_profiles`** that admins can toggle independently of tier. Some Elite trainers may not want to appear on the landing page. The query becomes `eq('subscription_tier', 'elite').eq('featured_eligible', true)`.

**Confidence:** HIGH — standard TanStack Query pattern. Separate queries with conditional rendering is the documented approach.

---

### Pattern 7: Annual vs Monthly Plan Switcher UI

**Toggle switch at top of pricing page. Default to Annual. Show monthly equivalent for annual pricing.**

The standard pattern used by Canva, Linear, Jasper:

```
[Monthly]  ●────  [Annual  Save 20%]
```

- A two-button toggle or styled checkbox, not a dropdown
- "Annual" carries a `Save 20%` badge inline
- Default state: **Annual** — anchors the comparison to the better deal
- Annual price displays as the monthly equivalent: `$7.20/mo` with a subscript `billed $86.40 annually` — not just the lump sum
- Price values update instantly in React state with no network call

```tsx
const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');

const PRICES = {
  pro:   { monthly: 9.00,  annual: 7.20  },  // annual = 9 * 12 * 0.8 / 12
  elite: { monthly: 29.00, annual: 23.20 },
};

const price = PRICES[selectedPlan][billing];
```

**Routing to checkout:** Pass billing period as a query param. The checkout page maps it to the correct Stripe Price ID from a central config — never hardcode Price IDs in components.

```typescript
// src/lib/stripePrices.ts
export const STRIPE_PRICE_IDS = {
  pro_monthly:    import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY,
  pro_annual:     import.meta.env.VITE_STRIPE_PRICE_PRO_ANNUAL,
  elite_monthly:  import.meta.env.VITE_STRIPE_PRICE_ELITE_MONTHLY,
  elite_annual:   import.meta.env.VITE_STRIPE_PRICE_ELITE_ANNUAL,
} as const;
```

**Confidence:** HIGH — pattern verified against Cruip implementation tutorial, Canva and Jasper documented examples, 9 Best Practices for SaaS Pricing Pages guide.

---

### Pattern 8: Invoice History Display

**Mirror to DB via webhook. Read from DB in UI. Never call Stripe API from the client.**

| Concern | Mirror to DB (recommended) | Direct Stripe API |
|---|---|---|
| Latency | Fast (local Supabase read) | Slow (external round-trip) |
| Rate limits | None | Stripe allows 100 req/s; fine for most loads but adds latency |
| Offline / degraded Stripe | Still works | Fails |
| Implementation | Webhook handler + table insert | `stripe.invoices.list()` call |
| Stripe PDF link | Stored as `hosted_invoice_url` | Same — Stripe generates the PDF |

Recommended `trainer_invoices` table:

```sql
CREATE TABLE trainer_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_invoice_id   TEXT UNIQUE NOT NULL,
  amount_paid         INT NOT NULL,          -- stored in cents
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              TEXT NOT NULL,         -- 'paid', 'void', 'uncollectible'
  period_start        TIMESTAMPTZ NOT NULL,
  period_end          TIMESTAMPTZ NOT NULL,
  hosted_invoice_url  TEXT,                  -- Stripe-hosted PDF link
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

Webhook event: `invoice.payment_succeeded` → upsert to `trainer_invoices`. Use `ON CONFLICT (stripe_invoice_id) DO UPDATE` to handle duplicate webhook delivery safely.

The UI renders a simple table: date, plan name, amount, and a "View Invoice" link to `hosted_invoice_url`. Stripe hosts and generates the PDF — no PDF generation needed on the FitRush side.

**Note on Stripe Customer Portal:** An alternative that eliminates this table entirely is to redirect trainers to the Stripe Customer Portal for invoice history. This is lower effort but gives a non-FitRush UX. Recommended as a fast follow (v2.1.x) rather than v2.1 launch if the in-app table is too time-consuming.

**Confidence:** HIGH — aligns with Stripe's documented recommendation: "treat Stripe as source of truth via webhooks; API for gap-filling." Stripe explicitly recommends `invoice.paid` (equivalent to `invoice.payment_succeeded`) as the primary event for SaaS billing history.

---

### Pattern 9: Admin MRR Calculation

**Formula for mixed monthly/annual subscriptions. Exclude trials.**

```
MRR = (Pro Monthly subscribers × $9.00)
    + (Pro Annual subscribers × $7.20)      ← annual price / 12
    + (Elite Monthly subscribers × $29.00)
    + (Elite Annual subscribers × $23.20)   ← annual price / 12
```

Trials are excluded. A trainer in trial is not paying. Report trial count separately as a conversion pipeline metric.

Postgres query for the admin dashboard:

```sql
SELECT
  -- Subscriber counts by tier and billing period
  COUNT(*) FILTER (WHERE tier = 'pro'   AND billing_interval = 'month') AS pro_monthly_count,
  COUNT(*) FILTER (WHERE tier = 'pro'   AND billing_interval = 'year')  AS pro_annual_count,
  COUNT(*) FILTER (WHERE tier = 'elite' AND billing_interval = 'month') AS elite_monthly_count,
  COUNT(*) FILTER (WHERE tier = 'elite' AND billing_interval = 'year')  AS elite_annual_count,

  -- Trial pipeline (excluded from MRR, reported separately)
  COUNT(*) FILTER (WHERE status = 'trialing') AS active_trials,

  -- MRR in dollars (annual subscribers normalized to monthly)
  ROUND(
      COUNT(*) FILTER (WHERE tier = 'pro'   AND billing_interval = 'month' AND status = 'active') * 9.00
    + COUNT(*) FILTER (WHERE tier = 'pro'   AND billing_interval = 'year'  AND status = 'active') * 7.20
    + COUNT(*) FILTER (WHERE tier = 'elite' AND billing_interval = 'month' AND status = 'active') * 29.00
    + COUNT(*) FILTER (WHERE tier = 'elite' AND billing_interval = 'year'  AND status = 'active') * 23.20
  , 2) AS mrr_usd

FROM trainer_subscriptions
WHERE status IN ('active', 'trialing');
```

The `WHERE status = 'active'` inside the `FILTER` clauses is intentional — the outer `WHERE` returns both `active` and `trialing` rows (to get the trial count), but MRR only counts `active` rows.

**What to exclude from MRR:**
- `status = 'trialing'` — not paying yet
- `status = 'past_due'` — payment failed; include in a separate "at-risk MRR" metric
- `status = 'canceled'` — churned
- Discounted subscriptions (referral promo codes) contribute discounted amount, not sticker price — Stripe stores `plan.amount` which reflects the actual charge

**Confidence:** HIGH — formula consistent across Baremetrics, Cobloom, Wall Street Prep, Paddle MRR guides.

---

### Pattern 10: Manual Tier Override for Admin

**Two scenarios require different implementations. Never directly edit DB for active Stripe subscribers.**

**Scenario A: Complimentary access (no active Stripe subscription)**

A beta partner trainer, a contest winner, an admin granting courtesy Elite access. No Stripe subscription exists or is desired.

Write directly to `trainer_subscriptions`:

```sql
INSERT INTO trainer_subscriptions (
  trainer_id, tier, status, billing_interval,
  stripe_subscription_id,
  override_by_admin, override_reason, override_granted_by,
  override_expires_at
) VALUES (
  $trainer_id, 'elite', 'active', NULL,
  NULL,   -- no Stripe subscription
  true, 'beta partner', $admin_id,
  NOW() + INTERVAL '90 days'
);
```

The application reads from `trainer_subscriptions` for feature access, so this takes effect immediately. Stripe is not touched. A scheduled job should check `override_expires_at` to auto-expire complimentary access.

**Scenario B: Modify an existing paying subscriber's tier**

A Pro trainer should be moved to Elite for retention purposes. They have an active Stripe subscription.

Use the Stripe API — do not write to the DB directly:

```typescript
// In an Edge Function called by the admin UI
await stripe.subscriptions.update(stripeSubscriptionId, {
  items: [{
    id: currentItemId,
    price: STRIPE_PRICE_IDS.elite_monthly,  // or elite_annual
  }],
  proration_behavior: 'none',  // admin override = no surprise charge
});
// The customer.subscription.updated webhook fires → webhook handler updates DB
```

**Why not direct DB write for active subscribers:** Stripe still holds the old Price ID. On the next renewal, Stripe charges the old price and fires `customer.subscription.updated`, which the webhook handler will use to overwrite your manual DB change. The DB and Stripe will be out of sync silently until next renewal, then snap back — breaking the override.

**Admin UI flow:**

1. Admin views trainer → sees current tier, subscription status, any active override
2. "Override Tier" button → modal: [Free | Pro | Elite | Complimentary Elite (90 days)]
3. If active Stripe subscription: Edge Function calls Stripe API → webhook syncs DB
4. If no subscription (or Complimentary selected): Edge Function writes directly to DB with `override_by_admin: true`
5. All overrides logged to `admin_override_audit` table: who, when, reason, previous tier, new tier

**Confidence:** MEDIUM-HIGH — Stripe documentation confirms subscriptions must be modified via API for billing to remain correct. Direct DB approach is only safe when no Stripe subscription exists.

---

## Sources

- [Stripe Prorations Documentation](https://docs.stripe.com/billing/subscriptions/prorations) — HIGH confidence; authoritative on proration behavior
- [Stripe Modify Subscriptions](https://docs.stripe.com/billing/subscriptions/change) — HIGH confidence; upgrade/downgrade API behaviors
- [Build a Subscriptions Integration — Stripe Docs](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — HIGH confidence; webhook-driven access provisioning
- [Using Webhooks with Subscriptions — Stripe Docs](https://docs.stripe.com/billing/subscriptions/webhooks) — HIGH confidence; `invoice.payment_succeeded` as primary event
- [Invoices API Reference — Stripe](https://docs.stripe.com/api/invoices) — HIGH confidence
- [Finding the Right Point to Trigger a Paywall](https://www.sankalpjonna.com/posts/finding-the-right-point-in-your-ux-to-trigger-a-paywall) — HIGH confidence; read vs write trigger pattern
- [How Freemium SaaS Products Convert with Upgrade Prompts — Appcues](https://www.appcues.com/blog/best-freemium-upgrade-prompts) — HIGH confidence; framing and copy patterns
- [Modal UX Design for SaaS — Userpilot](https://userpilot.com/blog/modal-ux-design/) — HIGH confidence; single-modal-per-session rule
- [Optimizing SaaS Trial-to-Paid Conversion 2025 — Demogo](https://demogo.com/2025/08/29/optimizing-saas-trial-to-paid-conversion-strategies-for-2025/) — MEDIUM confidence; behavioral triggers
- [Free Trial Conversion Benchmarks 2025 — 1Capture](https://www.1capture.io/blog/free-trial-conversion-benchmarks-2025) — HIGH confidence; 10,000+ company dataset
- [How to (Properly) Calculate ARR and MRR — Cobloom](https://www.cobloom.com/blog/how-to-calculate-saas-arr-mrr) — HIGH confidence
- [MRR Academy — Baremetrics](https://baremetrics.com/academy/saas-calculate-mrr) — HIGH confidence; trial exclusion rule
- [How to Create a Pricing Table with Monthly/Yearly Toggle — Cruip](https://cruip.com/how-to-create-a-pricing-table-with-a-monthly-yearly-toggle-in-tailwind-css-and-next-js/) — HIGH confidence; React implementation
- [9 Best Practices for a High-Converting SaaS Pricing Page](https://www.thespotonagency.com/blog/the-architects-guide-9-best-practices-for-a-high-converting-saas-pricing-page) — MEDIUM confidence; default-to-annual pattern
- [PostgreSQL Custom Sort ORDER BY — CommandPrompt](https://www.commandprompt.com/education/how-to-custom-sort-in-postgresql-order-by-clause/) — HIGH confidence
- [Top 5 React Feature Flag Libraries 2025 — Featbit](https://www.featbit.co/articles2025/top-5-react-feature-flags-hooks-2025) — MEDIUM confidence; hook pattern shapes
- [Feature Flag Best Practices for JavaScript — Octopus Deploy](https://octopus.com/devops/feature-flags/feature-flag-javascript-best-practices/) — HIGH confidence; registry pattern
- [Row Level Security — Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- [Stigg: Upgrade & Downgrade Flows Guide](https://www.stigg.io/blog-posts/the-only-guide-youll-ever-need-to-implement-upgrade-downgrade-flows-part-2) — MEDIUM confidence; verified against Stripe docs
- [SaaStr: Pause is Better Than Cancel](https://www.saastr.com/as-a-saas-company-do-you-allow-customers-to-pause-their-account/) — MEDIUM confidence; industry consensus
- [Chargebee: Trial Strategy Guide](https://www.chargebee.com/resources/guides/subscription-pricing-trial-strategy/saas-trial-plans/) — MEDIUM confidence; trial conversion benchmarks
- [Trainerize Pricing](https://www.trainerize.com/pricing/) — MEDIUM confidence; direct competitor; slot/client limit patterns

---

*Feature research for: FitRush v2.1 — Trainer Subscription Tiers*
*Researched: 2026-03-15*
