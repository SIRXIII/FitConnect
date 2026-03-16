# Architecture Research

**Domain:** Stripe Billing subscription tiers on existing Stripe Connect + Supabase app
**Researched:** 2026-03-15
**Confidence:** HIGH (official Stripe docs + existing codebase inspection)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        React SPA (Netlify)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │ TrainerDash  │  │SubscribeFlow │  │   FeatureGate hooks   │   │
│  │ (existing)   │  │  (new UI)    │  │  useSubscriptionTier  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘   │
└─────────┼────────────────┼──────────────────────┼────────────────┘
          │                │ Auth JWT              │ RLS read
          ▼                ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Supabase Edge Functions                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │ create-      │  │ manage-      │  │  stripe-webhook      │    │
│  │ subscription │  │ subscription │  │  (EXTENDED — new     │    │
│  │ (new)        │  │ (new)        │  │   billing events)    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘    │
└─────────┼────────────────┼──────────────────────┼────────────────┘
          │ Stripe API      │ Stripe API            │ Stripe webhook
          ▼                 ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Stripe (platform account)                 │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐    │
│  │  Customer    │   │ Subscription │   │  Connect Account   │    │
│  │  cus_xxx     │   │  sub_xxx     │   │  acct_xxx          │    │
│  │  (billing)   │   │  (tiers)     │   │  (payouts)         │    │
│  └──────┬───────┘   └──────┬───────┘   └────────────────────┘    │
│         │                  │                  SEPARATE OBJECTS     │
└─────────┼──────────────────┼─────────────────────────────────────┘
          │ stored            │ drives
          ▼                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL                           │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ trainer_profiles (EXTENDED)                                 │   │
│  │  + stripe_customer_id  text                                 │   │
│  │  + subscription_tier   text  (free/pro/elite)              │   │
│  │  + subscription_status text  (trialing/active/canceled/…)  │   │
│  │  + subscription_id     text                                 │   │
│  │  + trial_ends_at       timestamptz                          │   │
│  │  + tier_override_by    uuid  (admin manual grant)          │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Type |
|-----------|----------------|------|
| `trainer_profiles` (extended) | Source of truth for current tier + trial state | DB table (altered) |
| `subscription_events` | Audit log of every webhook state change | DB table (new) |
| `create-subscription` Edge Function | Create Stripe Customer + Subscription, write stripe_customer_id back to DB | New Edge Function |
| `manage-subscription` Edge Function | Cancel, upgrade/downgrade, fetch invoice history, billing portal URL | New Edge Function |
| `stripe-webhook` (extended) | Handle 6 new Billing event types alongside existing Connect events | Modified Edge Function |
| `get_admin_analytics` (extended) | Add MRR + subscriber counts to existing admin RPC | Modified DB function |
| `useSubscriptionTier` hook | Read tier from `trainer_profiles` via RLS, expose gate checks | New frontend hook |
| `SubscriptionGate` component | Wrap gated UI sections, render upgrade prompt when blocked | New frontend component |

## Stripe Customer vs. Connect Account — The Critical Distinction

This is the most important architectural decision for this milestone.

FitRush uses **Stripe Connect Express** (`stripe_account_id` on `trainer_profiles`) for destination charges and trainer payouts. These `acct_xxx` objects represent the trainer as a *payment recipient*.

Stripe Billing requires a **Customer** (`cus_xxx`) object on the *platform* account. This Customer represents the trainer as a *billing subscriber paying the platform fee*.

**These are two separate Stripe objects for the same trainer. They must both exist and be stored separately.**

| Object | ID prefix | Lives on | Purpose | Stored in |
|--------|-----------|----------|---------|-----------|
| Connect Account | `acct_` | Platform (linked) | Trainer receives payouts | `trainer_profiles.stripe_account_id` |
| Billing Customer | `cus_` | Platform account | Trainer pays subscription fee | `trainer_profiles.stripe_customer_id` (new) |
| Subscription | `sub_` | Platform account | Tier + billing cycle | `trainer_profiles.subscription_id` (new) |

A trainer in free trial has no Connect account yet (they may not have set up payouts). A trainer on Pro with payouts enabled has both objects. The `stripe_customer_id` must be created at subscription time if it does not yet exist.

Source: [Stripe Billing + Connect docs](https://docs.stripe.com/connect/subscriptions) — "to create a subscription for the connected account to pay a recurring fee to the platform, you must create a Customer object to represent the connected account."

## DB Schema Changes

### Migration: `trainer_profiles` additions

```sql
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text,
  ADD COLUMN IF NOT EXISTS subscription_tier     text NOT NULL DEFAULT 'free'
                             CHECK (subscription_tier IN ('free', 'pro', 'elite')),
  ADD COLUMN IF NOT EXISTS subscription_status   text NOT NULL DEFAULT 'inactive'
                             CHECK (subscription_status IN (
                               'inactive', 'trialing', 'active',
                               'past_due', 'canceled', 'paused'
                             )),
  ADD COLUMN IF NOT EXISTS subscription_id       text,
  ADD COLUMN IF NOT EXISTS subscription_interval text
                             CHECK (subscription_interval IN ('month', 'year', NULL)),
  ADD COLUMN IF NOT EXISTS trial_ends_at         timestamptz,
  ADD COLUMN IF NOT EXISTS tier_overridden_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tier_overridden_at    timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS trainer_profiles_stripe_customer_id_idx
  ON public.trainer_profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trainer_profiles_subscription_tier_idx
  ON public.trainer_profiles(subscription_tier);
```

### New Table: `subscription_events` (audit log)

```sql
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id       uuid        NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
  stripe_event_id  text        NOT NULL UNIQUE,   -- idempotency key
  event_type       text        NOT NULL,
  payload          jsonb,
  processed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_events_trainer_id_idx
  ON public.subscription_events(trainer_id, processed_at DESC);
CREATE INDEX IF NOT EXISTS subscription_events_stripe_event_id_idx
  ON public.subscription_events(stripe_event_id);
```

The `stripe_event_id` unique constraint provides idempotency — if the webhook fires twice for the same event, the second `INSERT` fails and the handler exits cleanly.

### RLS additions

```sql
-- Trainers can read their own subscription columns (already covered by existing
-- trainer_profiles SELECT policy — no new policy needed if policy is column-agnostic)

-- subscription_events: trainers see their own, service role manages
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_events_select_own
  ON public.subscription_events FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.trainer_profiles WHERE id = trainer_id
    )
  );
```

## New Edge Functions

### `create-subscription`

**Trigger:** Trainer clicks "Start Trial" or "Subscribe" in UI.
**Auth:** Requires trainer JWT (same pattern as `create-connect-account`).

Flow:
1. Verify JWT, resolve `trainer_profiles.id` for the authenticated user.
2. If `stripe_customer_id` is null: `stripe.customers.create({ email, name, metadata: { trainer_id } })` and write `stripe_customer_id` back to DB.
3. Resolve Price ID for requested tier + interval from env vars (`STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_ELITE_MONTHLY`, `STRIPE_PRICE_ELITE_YEARLY`).
4. Call `stripe.subscriptions.create({ customer: cus_xxx, items: [{ price }], trial_period_days: 30, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } }, payment_behavior: 'default_incomplete', expand: ['latest_invoice.payment_intent'] })`.
5. Write `subscription_id`, `subscription_tier`, `subscription_status: 'trialing'`, `trial_ends_at` to `trainer_profiles`.
6. Return `{ subscription_id, client_secret? }` — client_secret is only present if card collection is enabled (not for free trial with no card required).

**Note:** For 30-day no-card trial, `payment_method_collection: 'if_required'` on the Checkout Session or `trial_settings.end_behavior.missing_payment_method: 'cancel'` on the subscription. Card is collected only when trial ends and trainer chooses to continue.

### `manage-subscription`

**Trigger:** Trainer UI actions: cancel, upgrade, downgrade, fetch invoices, billing portal.
**Auth:** Requires trainer JWT.

Actions dispatched via `action` body field:

| Action | Stripe Call | DB Effect |
|--------|-------------|-----------|
| `cancel` | `stripe.subscriptions.update(sub_id, { cancel_at_period_end: true })` | Set `subscription_status: 'canceled'` after period end (webhook confirms) |
| `upgrade` | `stripe.subscriptions.update(sub_id, { items: [{ id: item_id, price: new_price }], proration_behavior: 'create_prorations' })` | Webhook `customer.subscription.updated` writes new tier |
| `downgrade` | Same as upgrade with lower-tier price | Same |
| `billing_portal` | `stripe.billingPortal.sessions.create({ customer: cus_xxx, return_url })` | Returns portal URL to redirect |
| `invoices` | `stripe.invoices.list({ customer: cus_xxx, limit: 10 })` | Returns invoice list to UI |

**Billing Portal is strongly preferred over custom upgrade/downgrade UI** — it handles proration, payment method collection, and cancellation confirmation flows that are complex to replicate. Use it for all subscription management except initial subscription creation.

### `stripe-webhook` (extended)

The existing function handles `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, and `payout.paid`. Add a new `case` block for each Billing event.

**New webhook events to handle:**

| Event | Trigger | DB Action |
|-------|---------|-----------|
| `customer.subscription.created` | New subscription created | Write `subscription_id`, `subscription_tier`, `subscription_status`, `trial_ends_at` |
| `customer.subscription.updated` | Tier change, trial → active, payment method added | Sync `subscription_tier`, `subscription_status`, `subscription_interval` |
| `customer.subscription.deleted` | Cancellation effective | Set `subscription_tier: 'free'`, `subscription_status: 'inactive'`, clear `subscription_id` |
| `customer.subscription.trial_will_end` | 3 days before trial ends | Send email/notification prompt to add payment method |
| `invoice.paid` | Successful charge | Insert to `subscription_events` audit log; optionally send receipt email |
| `invoice.payment_failed` | Charge failed | Set `subscription_status: 'past_due'`; send failure notification |

**Idempotency pattern** (use for all 6 new events):

```typescript
// At the top of each case block:
const { error: dupError } = await adminClient
  .from('subscription_events')
  .insert({ trainer_id, stripe_event_id: event.id, event_type: event.type, payload: event.data.object });

if (dupError?.code === '23505') {
  // Unique constraint violation — already processed this event
  break;
}
```

**Webhook endpoint registration:** The existing webhook endpoint handles Connect events (via the `event.account` field). Billing events do NOT have an `event.account` field — they originate on the platform account. Both can be handled by the same endpoint. Register the billing events in the same Stripe Dashboard webhook endpoint alongside existing events, OR create a separate endpoint. Using the same endpoint is simpler and the existing `switch(event.type)` pattern handles routing cleanly.

**STRIPE_BILLING_WEBHOOK_SECRET vs. STRIPE_WEBHOOK_SECRET:** If using one endpoint for both Connect and Billing events, one shared secret works. If separate endpoints, add `STRIPE_BILLING_WEBHOOK_SECRET` to Supabase secrets. Using one endpoint is recommended to avoid secret management overhead.

## Feature Gate Architecture

Feature gates must be checked server-side (RLS + Edge Function guard) AND client-side (UI gating). Never rely on client-side only.

### Server-side: DB column is the gate

The `trainer_profiles.subscription_tier` column is the authoritative gate. All feature-restricted queries filter by it.

```sql
-- Slot visibility: Free trainers show max 3 slots, Pro max 10, Elite unlimited
-- Implemented in the slots query, not via separate table:
CREATE OR REPLACE FUNCTION public.get_visible_slots(p_trainer_id uuid)
RETURNS SETOF public.availability_slots AS $$
DECLARE
  v_tier text;
  v_limit int;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM public.trainer_profiles WHERE id = p_trainer_id;

  v_limit := CASE v_tier
    WHEN 'elite' THEN 2147483647   -- unlimited
    WHEN 'pro'   THEN 10
    ELSE              3
  END;

  RETURN QUERY
  SELECT * FROM public.availability_slots
  WHERE trainer_id = p_trainer_id
    AND is_booked = false
    AND start_time > now()
  ORDER BY start_time
  LIMIT v_limit;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER STABLE;
```

### Client-side: `useSubscriptionTier` hook

```typescript
// Reads from trainer_profiles query already in TrainerDashboard
// Exposes: tier, isTrialing, trialEndsAt, canAccess(feature)
```

### Feature gate map

| Feature | Free | Pro | Elite | Enforcement Layer |
|---------|------|-----|-------|-------------------|
| Slots visible to clients | 3 | 10 | Unlimited | `get_visible_slots` RPC + UI |
| Custom bio length | 280 chars | 1000 chars | 1000 chars | UI + Edge Function input guard |
| Custom branding / profile URL | No | No | Yes | RLS on `trainer_profiles` update |
| Priority search ranking | No | Yes | No (Featured instead) | `get_trainer_search` ORDER BY query |
| Featured on landing page | No | No | Yes | Landing page query filter |
| Advanced analytics | Basic | Full | Full | `get_trainer_analytics` — tier check inside function |
| Priority support | No | No | Yes | Tag in notification metadata |

## Data Flow

### Subscription Creation Flow

```
Trainer clicks "Start Free Trial"
    |
    v
create-subscription Edge Function (JWT auth)
    |-- GET trainer_profiles WHERE user_id = auth.uid()
    |-- if stripe_customer_id is null:
    |     stripe.customers.create() -> cus_xxx
    |     UPDATE trainer_profiles SET stripe_customer_id = cus_xxx
    |
    |-- stripe.subscriptions.create(cus_xxx, price_id, trial_period_days: 30)
    |     -> sub_xxx, status: 'trialing', trial_end: timestamp
    |
    |-- UPDATE trainer_profiles SET
    |     subscription_id = sub_xxx
    |     subscription_tier = 'pro' (or 'elite')
    |     subscription_status = 'trialing'
    |     trial_ends_at = trial_end
    |
    v
Return { subscription_id } to UI
    |
    v
Stripe fires customer.subscription.created webhook
    |
    v
stripe-webhook confirms/syncs state (idempotent)
```

### Trial-End → Active Flow

```
Day 27: Stripe fires customer.subscription.trial_will_end
    |
    v
stripe-webhook: send trainer email "Add payment method — 3 days left"
    |
    v
Day 30 (trial_ends_at):
    |-- If card attached: Stripe charges, fires invoice.paid
    |     stripe-webhook: subscription_status -> 'active'
    |
    |-- If no card: Stripe fires customer.subscription.deleted
          stripe-webhook: subscription_tier -> 'free', subscription_status -> 'inactive'
```

### Webhook State Machine

```
[inactive]
    |-- create-subscription called
    v
[trialing]
    |-- invoice.paid (card on file at trial end)
    v                                               |-- invoice.payment_failed
[active] <--(invoice.paid on renewal)               v
    |                                           [past_due]
    |-- cancel at period end                        |-- invoice.paid (retry succeeds)
    v                                               |-- max retries exceeded
[canceled] -> tier set to 'free'                    v
                                                [canceled] -> tier 'free'
```

## Build Order (Dependency-Driven)

This order minimizes risk by ensuring each layer is independently testable before the next builds on it.

| Step | Component | Type | Depends On |
|------|-----------|------|-----------|
| 1 | DB migration: extend `trainer_profiles` | DB | Nothing — additive only |
| 2 | DB migration: create `subscription_events` table + RLS | DB | Step 1 |
| 3 | Create Stripe Products + Prices in Dashboard | Stripe | Nothing |
| 4 | Add price IDs as Supabase secrets | Config | Step 3 |
| 5 | `create-subscription` Edge Function | Edge Function | Steps 1–4 |
| 6 | Register Billing webhook events in Stripe Dashboard | Config | Step 5 |
| 7 | Extend `stripe-webhook` with Billing event handlers | Edge Function | Steps 1–2, 6 |
| 8 | `manage-subscription` Edge Function | Edge Function | Steps 1, 3–4 |
| 9 | `get_visible_slots` RPC (slot gate) | DB function | Step 1 |
| 10 | Extend `get_admin_analytics` with MRR + subscriber counts | DB function | Step 1 |
| 11 | `useSubscriptionTier` hook + `SubscriptionGate` component | Frontend | Steps 1, 5 |
| 12 | Subscription UI: plan picker, trial CTA, billing portal link | Frontend | Steps 5, 8, 11 |
| 13 | Feature gate enforcement in search, landing page, analytics | Frontend + DB | Steps 9, 11 |
| 14 | Admin UI: tier badge per trainer, manual override, MRR widget | Frontend | Step 10 |

## Anti-Patterns

### Anti-Pattern 1: Storing Tier Only in Stripe, Not in DB

**What people do:** Skip the `subscription_tier` column, query Stripe API on every request to check tier.
**Why it's wrong:** Adds 100-500ms latency to every gated page load; Stripe API outage breaks feature access; RLS cannot reference Stripe state.
**Do this instead:** Store `subscription_tier` in `trainer_profiles`, keep it synced via webhook. DB is the read path; Stripe is the write/billing path.

### Anti-Pattern 2: One Webhook Endpoint Per Event Type

**What people do:** Create separate Edge Functions for billing webhooks vs. Connect webhooks.
**Why it's wrong:** Two functions to maintain, two webhook secrets, two registrations, and the existing `stripe-webhook` function already has the Supabase client setup pattern.
**Do this instead:** Add `case` blocks to the existing `stripe-webhook` function. The `switch(event.type)` pattern scales cleanly.

### Anti-Pattern 3: Confusing `acct_xxx` and `cus_xxx`

**What people do:** Try to create a Subscription with `customer: acct_xxx` (the Connect account ID).
**Why it's wrong:** Connect Accounts (`acct_`) are not Billing Customers (`cus_`). Stripe will reject the request or create unexpected behavior.
**Do this instead:** Always create a separate `cus_xxx` Customer on the platform account. Store both IDs in `trainer_profiles`: `stripe_account_id` (existing) and `stripe_customer_id` (new).

### Anti-Pattern 4: Skipping Idempotency on Webhook Handlers

**What people do:** Process webhook events without checking for duplicates (Stripe retries on non-200 responses).
**Why it's wrong:** A retry causes double-processing: double email sends, double DB writes, potentially double tier changes.
**Do this instead:** Use `subscription_events.stripe_event_id` unique constraint. Insert first; if unique violation, skip processing and return 200.

### Anti-Pattern 5: Client-Side-Only Feature Gates

**What people do:** Check tier in React component only, no server enforcement.
**Why it's wrong:** Any user can edit their `trainer_profiles.subscription_tier` if RLS allows it, or observe the client-side check in DevTools and bypass.
**Do this instead:** Enforce gates in DB functions (`get_visible_slots` LIMIT) and Edge Function input validation. Client gates are UX, not security.

### Anti-Pattern 6: Using Stripe Entitlements API for This Use Case

**What people do:** Adopt Stripe's Entitlements API to avoid DB tier storage.
**Why it's wrong:** Entitlements add a Stripe API call to every feature check, their `entitlements.active_entitlement_summary.updated` event fires async so there's a race, and it's a newer API with less production history. FitRush's tier model (3 tiers, 7 features) is simple enough that a single DB column is the right tool.
**Do this instead:** Store `subscription_tier` in `trainer_profiles`. Webhook keeps it in sync. No Stripe API call needed at read time.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Stripe Billing (new) | Platform-account Customer + Subscription; webhook events on platform webhook endpoint | Completely separate from Connect; same STRIPE_SECRET_KEY |
| Stripe Connect (existing) | `acct_xxx` on `trainer_profiles.stripe_account_id`; destination charges; `payout.paid` webhook | Unchanged — do not modify Connect flow |
| Resend email | Send `trial_will_end` warning email (3 days before) and `invoice.payment_failed` email | Same pattern as existing payout emails in `stripe-webhook` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `create-subscription` -> DB | service-role adminClient writes `stripe_customer_id`, `subscription_id`, `subscription_tier`, `subscription_status`, `trial_ends_at` | Write on subscription creation; webhook may overwrite — idempotent by design |
| `stripe-webhook` -> `trainer_profiles` | service-role UPDATE based on webhook event | Always use `stripe_event_id` idempotency guard via `subscription_events` insert-first |
| `manage-subscription` -> Stripe Billing Portal | Returns portal URL; all management UI delegates to Stripe's hosted portal | Avoids building upgrade/downgrade/cancel flows from scratch |
| Frontend -> `trainer_profiles` | RLS SELECT — reads `subscription_tier`, `subscription_status`, `trial_ends_at` directly | No extra API call; already fetched as part of trainer profile |
| Admin -> `trainer_profiles` | Admin-role UPDATE on `subscription_tier` + set `tier_overridden_by`, `tier_overridden_at` | Manual override bypasses Stripe; must not create a Stripe subscription on admin's behalf |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–500 trainers | Single `stripe-webhook` function handles all events; DB tier column + indexes sufficient |
| 500–10k trainers | Add `subscription_tier` to search index; consider read replica for analytics queries |
| 10k+ trainers | Separate Billing webhook function from Connect webhook function; consider caching tier in Redis/edge cache |

### Scaling Priorities

1. **First bottleneck:** Trainer search with tier-based ranking — add composite index `(subscription_tier, rating DESC)` early.
2. **Second bottleneck:** `get_admin_analytics` MRR aggregation over all `trainer_profiles` — add materialized view if query becomes slow at scale.

## Sources

- [Stripe: Charge SaaS fees to connected accounts](https://docs.stripe.com/connect/integrate-billing-connect) — Customer vs. Connect Account distinction
- [Stripe: Subscription lifecycle webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) — Event names and timing
- [Stripe: Trial periods](https://docs.stripe.com/billing/subscriptions/trials) — No-card trial configuration
- [Stripe: Billing Entitlements](https://docs.stripe.com/billing/entitlements) — Evaluated and rejected for this use case
- [Stripe: Build a subscriptions integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — Customer + Subscription creation flow
- Existing codebase: `stripe-webhook/index.ts`, `create-connect-account/index.ts`, `payout_system.sql`, `referral_system.sql` — patterns for auth, idempotency, and RLS

---
*Architecture research for: Stripe Billing subscription tiers on FitRush (Supabase + Stripe Connect)*
*Researched: 2026-03-15*
