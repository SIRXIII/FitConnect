# Stack Research

**Domain:** Subscription tiers (Pro/Elite) on a React 19 + Supabase + Stripe Connect marketplace
**Researched:** 2026-03-15
**Confidence:** HIGH (all critical claims verified against official Stripe documentation; package versions confirmed against npm registry and project package.json)

---

## What This Covers

ONLY the new capabilities required for v2.1 — Subscription Tiers. The existing validated stack (React 19, Supabase, Stripe Connect Express, Edge Functions, Zustand v5) is not re-documented.

New capabilities needed:

- Stripe Billing (Products, Prices, Subscriptions, Customer Portal)
- Trial period mechanics (30-day free, no card required)
- Monthly + annual billing with 20% annual discount
- Upgrade/downgrade flows via Customer Portal
- Feature gating (React component layer + Supabase DB enforcement)
- Webhook handler extension for subscription lifecycle events
- Separation of Billing from Connect payouts

---

## Package Situation: Nothing New to Install

Both Stripe client packages are already in `package.json`:

```json
"@stripe/react-stripe-js": "^5.6.1",
"@stripe/stripe-js": "^8.9.0"
```

The server-side `stripe` package is imported in Edge Functions via Deno's `npm:` specifier — no separate install. **Zero new frontend dependencies are required for the entire subscription tier feature.**

---

## Architecture: How Stripe Billing Coexists With Stripe Connect

This is the most consequential architectural decision for v2.1.

### The Problem

Trainers already have Stripe Connect Express accounts (created via Accounts v1 API) stored as `trainer_profiles.stripe_account_id`. Stripe's current "Accounts v2" approach would allow a single Account object to serve as both merchant and billable customer — but **v2 requires recreating all Connect accounts from scratch**. Recreating Connect accounts breaks existing payout flows and is not a viable path.

### The Solution: Separate Customer Object Per Trainer (v1 Pattern)

For v1 Express accounts, Stripe's documented approach is to create a **separate `stripe_customer_id` for each trainer** on the platform account. These are two completely independent objects:

| Field | Object Type | Stripe ID Format | Purpose |
|-------|-------------|-----------------|---------|
| `trainer_profiles.stripe_account_id` | Connect Express Account | `acct_xxx` | Destination charges, payouts to trainer |
| `profiles.stripe_customer_id` (new) | Customer | `cus_xxx` | Platform subscription billing from trainer |

The platform's Stripe account holds the Customer object. The Customer's payment method is charged for Pro/Elite subscriptions. This payment goes to the **platform** — completely separate from booking revenue, which flows *through* the trainer's Connect account.

**Source:** Official Stripe documentation confirms this for v1 accounts: "In the Accounts v1 API, associating purchases and subscriptions with your connected account requires a separate Customer object that you manually associate with the connected account's Account object."

**Source:** [Charge SaaS fees to your connected accounts](https://docs.stripe.com/connect/integrate-billing-connect) and [Create subscriptions with Stripe Billing](https://docs.stripe.com/connect/subscriptions)

There is zero interference between subscription charges and Connect destination charges. They use different Stripe object types and different API surfaces.

---

## Stripe Billing API Objects

Create once in the Stripe Dashboard, not in application code:

| Object | Name | Amount | Interval | `lookup_key` |
|--------|------|--------|----------|-------------|
| Product | "FitRush Pro" | — | — | — |
| Product | "FitRush Elite" | — | — | — |
| Price | Pro Monthly | $9.00 | `month` | `pro_monthly` |
| Price | Pro Annual | $86.40 | `year` | `pro_annual` |
| Price | Elite Monthly | $29.00 | `month` | `elite_monthly` |
| Price | Elite Annual | $278.40 | `year` | `elite_annual` |

Annual pricing: $9.00 × 12 = $108.00 × 0.80 = $86.40/yr (saves $21.60, ~20% off). Annual is billed as a single yearly charge.

**Use `lookup_key` on each Price object.** Lookup keys let Edge Functions reference prices by name (`STRIPE_PRICE_PRO_MONTHLY` env var) without hardcoding opaque `price_xxx` IDs. This survives Stripe account migrations and test-to-prod promotions.

Store Price IDs as Supabase secrets / environment variables:

```
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_ANNUAL=price_xxx
STRIPE_PRICE_ELITE_MONTHLY=price_xxx
STRIPE_PRICE_ELITE_ANNUAL=price_xxx
```

**Why 4 separate Price objects and not coupons for the annual discount:** Coupons require coupon management, can be misapplied to the wrong subscription, and add complexity. Separate Price objects are unambiguous — each `price_xxx` ID maps to exactly one billing configuration.

---

## Trial Mechanics: 30-Day Free, No Card Required

Stripe Billing supports no-card-required trials natively. Two parameters control the behavior:

**Subscription creation (Edge Function):**

```typescript
const subscription = await stripe.subscriptions.create({
  customer: trainer.stripe_customer_id,
  items: [{ price: priceId }],
  trial_period_days: 30,
  payment_settings: {
    save_default_payment_method: 'on_subscription', // saves card if one is collected during trial
  },
  trial_settings: {
    end_behavior: {
      missing_payment_method: 'cancel', // cancels if no card by trial end
    },
  },
  expand: ['latest_invoice.payment_intent'],
});
```

### `trial_period_days` vs `trial_end`

- `trial_period_days: 30` — integer, relative from now. Simple and correct for a flat 30-day window.
- `trial_end: <unix_timestamp>` — precise Unix timestamp. Use this only if you need to align trial end with a specific calendar date.

For FitRush, `trial_period_days: 30` is the right choice.

### `trial_settings.end_behavior.missing_payment_method`

Valid values:

| Value | Behavior |
|-------|----------|
| `cancel` | Subscription cancels immediately at trial end if no payment method. **Use this.** |
| `pause` | Subscription enters paused state, generates no invoices. Complicated to surface in UI; zombies the subscription record. |
| `create_invoice` | Generates invoice even without a payment method; moves to `past_due`. Creates bad debt scenarios. |

`cancel` is recommended. Paused subscriptions are a zombie state — they don't generate MRR but show as "active" in some views, and the trainer would need to resubscribe anyway. Cancel-and-re-subscribe is a cleaner flow.

### Collecting a Card During Trial (Optional Flow)

If the trainer wants to add a card during the trial period without being charged, the Customer Portal handles this. No custom UI needed. The portal generates a SetupIntent automatically when the trainer adds a payment method.

**Source:** [Use trial periods on subscriptions | Stripe Documentation](https://docs.stripe.com/billing/subscriptions/trials)

---

## Upgrade / Downgrade: Use the Customer Portal, Not Custom UI

Do not build a custom upgrade/downgrade form. The **Stripe Billing Customer Portal** handles:

- Upgrade (Free → Pro → Elite): applies immediate proration, charges difference
- Downgrade (Elite → Pro): credits the remaining balance, applies at period end
- Cancellation with optional retention flow
- Payment method add/update (card, bank)
- Invoice history with PDF download
- Tax ID management (if Stripe Tax enabled later)

**Backend Edge Function (create-portal-session):**

```typescript
const session = await stripe.billingPortal.sessions.create({
  customer: trainer.stripe_customer_id,
  return_url: `${Deno.env.get('APP_URL')}/trainer/dashboard?tab=subscription`,
});
return new Response(JSON.stringify({ url: session.url }), { status: 200 });
```

**Frontend:** One "Manage Subscription" button. Calls the Edge Function, gets `url`, does `window.location.href = url`. No Elements, no card fields, no proration math in application code.

**Portal configuration (Stripe Dashboard):** Set the allowed products/prices to the 4 FitRush prices. This controls what upgrade/downgrade paths are shown.

**Connect note:** The portal supports an `on_behalf_of` parameter for showing connected account branding. This is NOT needed here — the platform is billing trainers on behalf of the platform, not a connected account. Omit `on_behalf_of`.

**Source:** [Integrate the customer portal with the API | Stripe Documentation](https://docs.stripe.com/customer-management/integrate-customer-portal)

---

## Webhook Events to Handle

Extend the existing `stripe-webhook` Edge Function. The existing function handles `payment_intent.*` and `transfer.*` — add the subscription event handlers as a new `switch` branch.

### Required Event Handlers

| Event | DB Action | Notes |
|-------|-----------|-------|
| `customer.subscription.created` | Write `subscription_tier`, `subscription_status: 'trialing'`, `stripe_subscription_id`, `subscription_current_period_end` to `profiles` | Fires on first signup |
| `customer.subscription.updated` | Sync all subscription fields — tier (from Price → Product metadata), status, period end | Covers trial→active, upgrade, downgrade, cancel-at-period-end schedule |
| `customer.subscription.deleted` | Set `subscription_tier: 'free'`, clear `subscription_status`, `stripe_subscription_id` | Fires when subscription fully ends (not just cancelled-at-period-end) |
| `customer.subscription.trial_will_end` | Send email reminder via Resend — "Your trial ends in 3 days" | Fires exactly 3 days before trial end |
| `customer.subscription.paused` | Set `subscription_status: 'paused'`; restrict tier features | Only fires if `end_behavior: 'pause'` is used; can be ignored with `cancel` mode |
| `invoice.paid` | Confirm `subscription_status: 'active'`; log to `subscription_events` table | Most reliable signal that a billing period succeeded |
| `invoice.payment_failed` | Set `subscription_status: 'past_due'`; send email; restrict Pro/Elite features | Stripe retries automatically; restrict on 1st failure |
| `invoice.payment_action_required` | Send email with portal link for 3DS authentication | Fires when SCA/3DS challenge is required to complete payment |
| `invoice.finalization_failed` | Log and alert; prevents revenue loss | Rare but important; invoice stuck in draft means no charge attempt |

### Minimum Viable Set (if phasing implementation)

Handle these first:

1. `customer.subscription.created` — provision access
2. `customer.subscription.updated` — sync tier on all changes
3. `customer.subscription.deleted` — revoke access
4. `invoice.paid` — confirm active billing
5. `invoice.payment_failed` — degrade access on non-payment
6. `customer.subscription.trial_will_end` — trial-end email

Add `invoice.payment_action_required` and `invoice.finalization_failed` before production launch.

**Source:** [Using webhooks with subscriptions | Stripe Documentation](https://docs.stripe.com/billing/subscriptions/webhooks)

---

## Feature Gating Architecture

### Database Migration (additive)

Add to `public.profiles`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN subscription_tier        text        NOT NULL DEFAULT 'free'
      CHECK (subscription_tier IN ('free', 'pro', 'elite')),
  ADD COLUMN subscription_status      text
      CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  ADD COLUMN stripe_customer_id       text        UNIQUE,
  ADD COLUMN stripe_subscription_id   text        UNIQUE,
  ADD COLUMN subscription_current_period_end  timestamptz;
```

`subscription_tier` is the single source of truth for feature gates. Written **only** by the webhook handler using the service role key. Never by the client. Never by the trainer themselves.

### Why Profiles Column, Not a Separate Subscriptions Table

A separate `subscriptions` table is the right choice when you need invoice history, multiple subscriptions per user, or audit trails. FitRush needs none of that complexity — one tier per trainer, managed through the Customer Portal's built-in invoice history. A column on `profiles` is:

- Directly available in the existing `useAuthStore` profile shape
- Readable in a single `profiles` SELECT — no JOIN
- RLS-compatible with the existing profile-level policies
- The webhook writes one row, not a row per event

If FitRush later needs per-invoice records (e.g., custom invoice history UI), add a `subscription_events` append-only table for logging — but gate features off the `profiles` column, not that table.

### RLS for Data-Layer Gates

Most feature gates are UI-only (show/hide analytics tabs, custom bio fields, priority listing). RLS is not needed for these — application-layer checks are sufficient because the data exists regardless of tier; only presentation differs.

For gates where access to data itself should be tier-restricted (e.g., limiting how many availability slots a free trainer can create), enforce via a Postgres function or RPC that respects `subscription_tier`:

```sql
-- Example: cap free trainers at 10 slots
CREATE POLICY "free_tier_slot_limit" ON public.availability_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT subscription_tier FROM public.profiles WHERE id = auth.uid()) != 'free'
    OR (SELECT COUNT(*) FROM public.availability_slots WHERE trainer_id = (
          SELECT id FROM public.trainer_profiles WHERE user_id = auth.uid()
        )) < 10
  );
```

### React Feature Gate Pattern

No third-party feature flag library is needed. Three-piece pattern:

**1. Hook (reads from auth store, no extra fetch):**

```typescript
// hooks/useSubscription.ts
export function useSubscription() {
  const profile = useAuthStore(s => s.profile);
  return {
    tier: profile?.subscription_tier ?? 'free',
    isPro: ['pro', 'elite'].includes(profile?.subscription_tier ?? 'free'),
    isElite: profile?.subscription_tier === 'elite',
    isTrialing: profile?.subscription_status === 'trialing',
    isPastDue: profile?.subscription_status === 'past_due',
    periodEnd: profile?.subscription_current_period_end ?? null,
  };
}
```

**2. Gate component (renders children or fallback):**

```typescript
// components/FeatureGate.tsx
const TIER_RANK: Record<string, number> = { free: 0, pro: 1, elite: 2 };

export function FeatureGate({
  tier,
  children,
  fallback = null,
}: {
  tier: 'pro' | 'elite';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { tier: userTier } = useSubscription();
  if ((TIER_RANK[userTier] ?? 0) >= TIER_RANK[tier]) return <>{children}</>;
  return <>{fallback}</>;
}
```

**3. Usage:**

```tsx
<FeatureGate tier="pro" fallback={<UpgradePrompt />}>
  <AnalyticsDashboard />
</FeatureGate>
```

Trialing trainers get Pro/Elite access (their `subscription_tier` is set to the subscribed tier immediately on `customer.subscription.created`). The trial status is separate from the tier.

---

## New Edge Functions

| Function | What It Does | Notes |
|----------|--------------|-------|
| `create-subscription` | Creates Stripe Customer if none exists; creates subscription with 30-day trial; writes `stripe_customer_id` to `profiles` | Idempotent — check `stripe_customer_id` before creating |
| `create-portal-session` | Reads `stripe_customer_id` from `profiles`; creates portal session; returns `url` | Auth-gated — trainer only |
| `get-subscription-status` | Returns tier, status, period end for trainer dashboard display | Could be read from the `profiles` row directly; separate function only needed if invoice data from Stripe API is shown |

Extend existing `stripe-webhook` Edge Function — do not create a new webhook function. Stripe has a 16-webhook limit per account (free plan); adding a new endpoint wastes one slot.

---

## React Integration: PaymentElement

`@stripe/react-stripe-js@^5.6.1` is already installed (confirmed in `package.json`). If a custom payment capture UI is ever needed (e.g., a trial-end upgrade screen without redirecting to the Customer Portal), use `PaymentElement`.

**Do not use `CardElement`.** Stripe has officially deprecated the Card Element:

> "The Card Element is a legacy integration with significantly less functionality than Payment Element. Stripe strongly recommends using the Payment Element to accept payments of all kinds, including card payments."

PaymentElement provides: Apple Pay, Google Pay, saved cards, 3DS/SCA handling, 100+ payment methods, and continuous development. CardElement gets only legacy security patches.

For FitRush v2.1, the Customer Portal handles all payment method collection during and after trials. **`PaymentElement` is only needed if a future phase adds a custom card capture flow.** The existing `@stripe/react-stripe-js` install covers this if needed.

**Source:** [Compare the Payment Element and Card Element | Stripe Documentation](https://docs.stripe.com/payments/payment-card-element-comparison)

---

## Annual vs Monthly: Implementation Detail

**Two separate Price objects per product tier.** Monthly and annual are distinct Price IDs:

- Monthly: `interval: 'month'`, amount in cents (`900` for $9.00)
- Annual: `interval: 'year'`, amount in cents (`8640` for $86.40)

The frontend shows a toggle (Monthly / Annual). On toggle, the selected Price ID is passed to `create-subscription`. The "Save 20%" badge is a static UI label — no coupon codes involved.

**Switching between annual and monthly mid-cycle** is handled by the Customer Portal. When a trainer changes interval (e.g., monthly → annual), Stripe:

1. Prorates the remaining monthly period as a credit
2. Creates a new billing cycle starting immediately at the annual rate
3. Issues a prorated invoice

No application code handles this — the portal and Stripe webhooks handle it. The `customer.subscription.updated` webhook fires with the new Price ID, and the webhook handler updates `subscription_tier` and `subscription_current_period_end`.

**Billing cycle anchor:** For new subscriptions, `billing_cycle_anchor` defaults to subscription creation time. This is correct — no need to set it explicitly.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Separate `stripe_customer_id` per trainer (v1 pattern) | Migrate to Accounts v2 | v2 requires recreating all Connect Express accounts — breaks existing trainer payouts, zero benefit |
| Stripe Billing Customer Portal for all upgrade/downgrade UI | Custom upgrade form with `PaymentElement` | Portal handles proration, 3DS, card updates, invoice PDFs out of the box. Custom form adds 3-4 days of implementation for strictly worse UX and more edge cases to own |
| `subscription_tier` column on `profiles` | Separate `subscriptions` table | One subscription per trainer; no multi-subscription use case; column keeps things in the existing profile shape with no JOIN; Customer Portal handles invoice history display |
| `subscription_tier` column on `profiles` | Read tier from Stripe API directly | Stripe is not the source of truth for RLS. DB must own the truth so RLS policies can reference it synchronously |
| `missing_payment_method: 'cancel'` | `'pause'` on trial end | Paused state is a zombie: no invoices, still "exists," complicates MRR reporting, trainer still needs to resubscribe |
| 4 separate Price objects (2 tiers × 2 intervals) | Coupons for annual discount | Coupon approach requires coupon management lifecycle; coupons can be misapplied; separate prices are unambiguous and self-documenting |
| Extend existing `stripe-webhook` Edge Function | New dedicated subscription webhook function | Stripe 16-webhook limit; existing function already has signature verification scaffolding |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `CardElement` | Deprecated legacy component. Gets only security-only patches. | `PaymentElement` (already installed) |
| Accounts v2 `customer_account` parameter | Requires recreating v1 Express accounts | Separate `Customer` object per trainer |
| External feature flag services (LaunchDarkly, Statsig, etc.) | Overkill: no A/B testing, no gradual rollout needed; adds cost and a third-party dependency | `subscription_tier` column + `useSubscription()` hook |
| `collection_method: 'send_invoice'` on subscriptions | Requires trainer to manually pay an emailed invoice; incompatible with auto-renewal UX | Default `charge_automatically` with `payment_method_collection: 'if_required'` via trial |
| Reading Stripe subscription status from Stripe API in request path | High latency; Stripe API is an external call in every authenticated request | `subscription_tier` column on `profiles` — read from DB with the rest of the profile |

---

## Version Compatibility

| Package | Status | Version |
|---------|--------|---------|
| `@stripe/react-stripe-js` | Already in `package.json` | `^5.6.1` |
| `@stripe/stripe-js` | Already in `package.json` | `^8.9.0` |
| `stripe` (server, Deno) | Imported in Edge Functions via `npm:` | `npm:stripe@20.4.1` |
| Stripe API version | Pin explicitly in Edge Functions | `2026-02-25` |
| React | React 19 — fully compatible with react-stripe-js | `^19.2.1` |

---

## Sources

All findings HIGH confidence — verified against official Stripe documentation.

- [Create subscriptions with Stripe Billing | Stripe Documentation](https://docs.stripe.com/connect/subscriptions) — three subscription patterns, separate Customer object requirement for v1 Connect accounts
- [Charge SaaS fees to your connected accounts | Stripe Documentation](https://docs.stripe.com/connect/integrate-billing-connect) — platform billing connected accounts, v1 vs v2 Customer object approach
- [Use trial periods on subscriptions | Stripe Documentation](https://docs.stripe.com/billing/subscriptions/trials) — `trial_period_days`, `trial_settings.end_behavior.missing_payment_method`, `payment_method_collection: 'if_required'`, trial_will_end reminder timing
- [Using webhooks with subscriptions | Stripe Documentation](https://docs.stripe.com/billing/subscriptions/webhooks) — complete event list, minimum recommended set, trial/payment/cancellation events
- [Integrate the customer portal with the API | Stripe Documentation](https://docs.stripe.com/customer-management/integrate-customer-portal) — `billingPortal.sessions.create`, `return_url`, `on_behalf_of` for Connect, supported self-serve features
- [Compare the Payment Element and Card Element | Stripe Documentation](https://docs.stripe.com/payments/payment-card-element-comparison) — Card Element is legacy; PaymentElement is the current standard
- [How products and prices work | Stripe Documentation](https://docs.stripe.com/products-prices/how-products-and-prices-work) — multiple Prices per Product, `lookup_key`, recurring intervals
- [Modify subscriptions | Stripe Documentation](https://docs.stripe.com/billing/subscriptions/change) — proration on upgrade/downgrade, interval changes
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policy pattern for subscription-tier enforcement
- `package.json` (project root) — confirmed `@stripe/react-stripe-js@^5.6.1` and `@stripe/stripe-js@^8.9.0` already installed

---
*Stack research for: FitRush v2.1 — Subscription Tiers (Pro/Elite) on Supabase + Stripe Connect*
*Researched: 2026-03-15*
