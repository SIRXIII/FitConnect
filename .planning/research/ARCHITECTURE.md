# Architecture Patterns: Subscription Tiers v2.1

**Domain:** Stripe Billing subscription tiers on existing Stripe Connect + Supabase app
**Researched:** 2026-03-15
**Overall Confidence:** HIGH (official Stripe docs + full codebase inspection)

---

## System Overview

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
│  │ subscription │  │ subscription │  │  (extended — adds    │    │
│  │ (new)        │  │ (new)        │  │   6 billing events)  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘    │
└─────────┼────────────────┼──────────────────────┼────────────────┘
          │ Stripe API      │ Stripe API            │ Stripe webhook
          ▼                 ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Stripe (platform account)                     │
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
│  ┌─────────────────────────┐  ┌──────────────────────────────┐   │
│  │ trainer_profiles (alt.) │  │ subscription_events (new)    │   │
│  │  + stripe_customer_id   │  │  stripe_event_id UNIQUE      │   │
│  │  + subscription_tier    │  │  (idempotency key)           │   │
│  │  + subscription_status  │  └──────────────────────────────┘   │
│  │  + subscription_id      │                                      │
│  │  + subscription_interval│                                      │
│  │  + trial_ends_at        │                                      │
│  │  + tier_overridden_by   │                                      │
│  └─────────────────────────┘                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Type |
|-----------|----------------|------|
| `trainer_profiles` (extended) | Denormalized source of truth for current tier, trial state, Stripe IDs | DB table (altered) |
| `subscription_events` | Audit log + idempotency store for every Stripe Billing webhook | DB table (new) |
| `create-subscription` Edge Function | Create Stripe Customer + Subscription, write IDs back to DB | New Edge Function |
| `manage-subscription` Edge Function | Cancel, upgrade/downgrade, billing portal URL | New Edge Function |
| `stripe-webhook` (extended) | Handle 6 new Billing event types alongside existing Connect events | Modified Edge Function |
| `get_visible_slots` RPC | Enforce per-trainer slot limits based on tier | New DB function |
| `get_trainer_search` (extended) | Tier-weighted search ranking | Modified DB function |
| `get_admin_mrr` RPC | MRR calculation from mix of monthly/annual subscriptions | New DB function |
| `get_admin_analytics` (extended) | Add subscriber counts to existing admin dashboard | Modified DB function |
| `useSubscriptionTier` hook | Read tier from trainer_profiles via RLS, expose gate helpers | New frontend hook |

---

## 1. Subscriptions Table Design

### Recommendation: Extend `trainer_profiles`, not a separate table

For FitRush's model — one subscription per trainer at a time — a separate `subscriptions` table adds a join on every feature-gated query without meaningful benefit. The right design is to add billing columns directly to `trainer_profiles` (denormalization) plus a separate `subscription_events` table for the audit log and idempotency.

If you ever need subscription history (multiple past subscriptions per trainer), `subscription_events` already records every state transition from webhooks. A separate `subscriptions` table is only warranted when one user can have multiple active subscriptions simultaneously — not the case here.

### Migration: `trainer_profiles` additions

```sql
-- Migration: 20260316100000_subscription_tiers.sql

ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS subscription_tier      text NOT NULL DEFAULT 'free'
                              CHECK (subscription_tier IN ('free', 'pro', 'elite')),
  ADD COLUMN IF NOT EXISTS subscription_status    text NOT NULL DEFAULT 'inactive'
                              CHECK (subscription_status IN (
                                'inactive', 'trialing', 'active',
                                'past_due', 'canceled', 'paused', 'incomplete'
                              )),
  ADD COLUMN IF NOT EXISTS subscription_id        text,           -- sub_xxx
  ADD COLUMN IF NOT EXISTS subscription_interval  text
                              CHECK (subscription_interval IN ('month', 'year', NULL)),
  ADD COLUMN IF NOT EXISTS trial_ends_at          timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end     timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tier_overridden_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tier_overridden_at     timestamptz;

-- Unique constraint prevents duplicate customer objects for one trainer
CREATE UNIQUE INDEX IF NOT EXISTS trainer_profiles_stripe_customer_id_idx
  ON public.trainer_profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Index for tier-based queries (search ranking, slot gating, admin MRR)
CREATE INDEX IF NOT EXISTS trainer_profiles_subscription_tier_idx
  ON public.trainer_profiles(subscription_tier);

-- Composite index for search ranking query
CREATE INDEX IF NOT EXISTS trainer_profiles_tier_rating_idx
  ON public.trainer_profiles(subscription_tier, rating DESC);
```

**Column rationale vs. the "subscriptions table" schema proposed in the brief:**

| Proposed column | Where it lives in this design | Notes |
|-----------------|-------------------------------|-------|
| `id` | N/A — trainer_profiles.id is the key | |
| `trainer_id` | N/A — trainer_profiles IS the trainer | |
| `stripe_customer_id` | `trainer_profiles.stripe_customer_id` | Stored here |
| `stripe_subscription_id` | `trainer_profiles.subscription_id` | Named `subscription_id` |
| `tier` | `trainer_profiles.subscription_tier` | |
| `status` | `trainer_profiles.subscription_status` | |
| `billing_period` | `trainer_profiles.subscription_interval` | month or year |
| `trial_end` | `trainer_profiles.trial_ends_at` | |
| `current_period_end` | `trainer_profiles.current_period_end` | Added — needed for cancel UI |
| `cancel_at_period_end` | `trainer_profiles.cancel_at_period_end` | Added — drives "cancels on X" UI |

**Missing columns from the brief that should be added:** `current_period_end` and `cancel_at_period_end`. Both come directly from Stripe's subscription object and are needed for the trainer dashboard "Your plan ends on [date]" display.

### New Table: `subscription_events` (audit log + idempotency)

```sql
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id       uuid        NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
  stripe_event_id  text        NOT NULL,   -- e.g. evt_1xxxxxx
  event_type       text        NOT NULL,   -- e.g. customer.subscription.updated
  payload          jsonb,                  -- full event.data.object for audit
  processed_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT subscription_events_stripe_event_id_unique UNIQUE (stripe_event_id)
);

CREATE INDEX IF NOT EXISTS subscription_events_trainer_id_idx
  ON public.subscription_events(trainer_id, processed_at DESC);
```

The `UNIQUE (stripe_event_id)` constraint is the idempotency mechanism (see section 7).

---

## 2. Stripe Customer for Trainers — The Critical Distinction

FitRush already stores `trainer_profiles.stripe_account_id` (an `acct_xxx` object). This is a Stripe Connect Express account — it represents the trainer as a **payment recipient** (for destination charges and payouts).

Stripe Billing requires a **Customer** object (`cus_xxx`) on the **platform account**. This represents the trainer as a **billing subscriber paying the platform**. These are two completely separate Stripe objects.

Source (HIGH confidence, official docs): "to create a subscription for the connected account to pay a recurring fee to the platform, you must create a Customer object to represent the connected account. The Account object allows the connected account to collect payments from its customers, but the platform cannot use it to collect recurring payments from the connected account."
— https://docs.stripe.com/connect/subscriptions

| Object | ID prefix | Lives on | Purpose | Stored in |
|--------|-----------|----------|---------|-----------|
| Connect Account | `acct_` | Platform (linked) | Trainer receives payouts | `trainer_profiles.stripe_account_id` (existing) |
| Billing Customer | `cus_` | Platform account | Trainer pays subscription fee | `trainer_profiles.stripe_customer_id` (new) |
| Subscription | `sub_` | Platform account | Tier + billing cycle | `trainer_profiles.subscription_id` (new) |

### Creation flow in `create-subscription` Edge Function

```typescript
// Step 1: Check if Customer already exists
const { data: trainerProfile } = await adminClient
  .from('trainer_profiles')
  .select('id, stripe_customer_id, stripe_account_id')
  .eq('user_id', userId)
  .single();

let customerId = trainerProfile.stripe_customer_id;

// Step 2: Create Customer on platform account if missing
if (!customerId) {
  const customer = await stripe.customers.create({
    email: userEmail,
    name: userFullName,
    metadata: { trainer_profile_id: trainerProfile.id },
    // Do NOT pass stripeAccount header — this must live on the platform account
  });
  customerId = customer.id;

  await adminClient
    .from('trainer_profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', trainerProfile.id);
}

// Step 3: Create Subscription using platform Customer (not the acct_ ID)
const subscription = await stripe.subscriptions.create({
  customer: customerId,  // cus_xxx, NOT acct_xxx
  items: [{ price: priceId }],
  trial_period_days: 30,
  trial_settings: {
    end_behavior: { missing_payment_method: 'cancel' }
  },
  payment_behavior: 'default_incomplete',
  payment_settings: { save_default_payment_method: 'on_subscription' },
  expand: ['latest_invoice.payment_intent'],
});
```

**Key:** Never pass `{ stripeAccount: acct_xxx }` as a Stripe API header when creating Billing objects. That header routes the API call to the connected account, where the Customer and Subscription would not be visible to your platform.

---

## 3. Denormalization vs. Computed Tier

### Recommendation: Denormalized column (`trainer_profiles.subscription_tier`), updated by webhook

**Why denormalization wins for this use case:**

| Concern | Denormalized column | Computed from subscriptions table |
|---------|---------------------|-----------------------------------|
| RLS policy simplicity | `subscription_tier = 'pro'` in WHERE — trivial | Requires subquery to subscriptions table on every policy check |
| Query performance | Single column index scan | JOIN to subscriptions + subquery in every RLS-gated query |
| Slot gating RPC | `SELECT subscription_tier FROM trainer_profiles WHERE id = p_trainer_id` | Multi-table query inside SECURITY INVOKER function |
| Search ranking | `ORDER BY tier_weight DESC` with simple CASE expression | Additional join on every search query |
| Stripe API outage | Zero impact on read path | Zero impact (data is in DB either way) |
| Consistency risk | Webhook sync lag (< 5 seconds normally) | Always consistent but costs a join |
| Admin override | Write `tier_overridden_by` + update column directly | Must decide: bypass subscriptions table or write a fake subscription row |

The consistency risk (webhook lag) is acceptable for a feature gate system. If a trainer's trial ends at 11:59 PM and the webhook fires at 12:00 AM, they may have an extra few seconds of Pro access. This is not a financial risk — Stripe's billing is already settled. Use `current_period_end` to display accurate timing in the UI.

**The one case where a separate subscriptions table is needed:** if FitRush ever offers add-ons (multiple active subscriptions per trainer). Not planned for v2.1.

---

## 4. RLS Policies for Subscriptions

The subscription columns live on `trainer_profiles`, which already has RLS enabled. The existing policies cover reads (public select) and writes (owner-only update). One addition is needed: prevent trainers from writing their own tier.

```sql
-- Migration: after ALTER TABLE trainer_profiles ADD COLUMN subscription_tier...

-- Trainers must NOT be able to self-promote their tier.
-- The existing trainer_profiles_update_own policy allows trainers to update
-- their own row. We need a check to block subscription column writes from
-- non-service-role callers.

-- Option A (recommended): Use a separate RLS policy with a WITH CHECK that
-- rejects subscription column changes from authenticated users.
-- Supabase does not support column-level RLS directly, but we can enforce
-- this in a BEFORE UPDATE trigger:

CREATE OR REPLACE FUNCTION public.guard_subscription_tier_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role and admin can write subscription columns freely
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Authenticated trainers cannot self-modify subscription columns
  IF NEW.subscription_tier     IS DISTINCT FROM OLD.subscription_tier     OR
     NEW.subscription_status   IS DISTINCT FROM OLD.subscription_status   OR
     NEW.subscription_id       IS DISTINCT FROM OLD.subscription_id       OR
     NEW.stripe_customer_id    IS DISTINCT FROM OLD.stripe_customer_id    OR
     NEW.trial_ends_at         IS DISTINCT FROM OLD.trial_ends_at         OR
     NEW.current_period_end    IS DISTINCT FROM OLD.current_period_end    OR
     NEW.cancel_at_period_end  IS DISTINCT FROM OLD.cancel_at_period_end  THEN
    RAISE EXCEPTION 'Subscription fields can only be modified by the platform';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trainer_profiles_guard_subscription_write ON public.trainer_profiles;
CREATE TRIGGER trainer_profiles_guard_subscription_write
  BEFORE UPDATE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_tier_write();
```

**For `subscription_events` table:**

```sql
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Trainers can read their own audit log
DROP POLICY IF EXISTS subscription_events_select_own ON public.subscription_events;
CREATE POLICY subscription_events_select_own
  ON public.subscription_events
  FOR SELECT
  USING (
    (SELECT user_id FROM public.trainer_profiles WHERE id = trainer_id) = (SELECT auth.uid())
  );

-- Admins can read all subscription events
DROP POLICY IF EXISTS subscription_events_select_admin ON public.subscription_events;
CREATE POLICY subscription_events_select_admin
  ON public.subscription_events
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

-- INSERT/UPDATE: service role only (webhook handler uses adminClient)
-- No explicit INSERT policy needed — service_role bypasses RLS by default.
-- But add it defensively for clarity:
DROP POLICY IF EXISTS subscription_events_insert_service ON public.subscription_events;
CREATE POLICY subscription_events_insert_service
  ON public.subscription_events
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

**Performance note (HIGH confidence, from Supabase official docs):** Wrap `auth.uid()` and subqueries used in RLS policies in `(SELECT ...)` to trigger Postgres `initPlan` optimization, caching the result per statement rather than re-evaluating per row. This gives up to 95% speedup on tables with many rows. See the `(SELECT auth.uid())` pattern in the policies above — this is the correct form.

---

## 5. Slot Visibility Gating at DB Level

### Recommendation: RPC function (`get_visible_slots`)

Three options evaluated:

| Option | Mechanism | Pros | Cons |
|--------|-----------|------|------|
| (a) RPC with tier check | `get_visible_slots(trainer_id)` PL/pgSQL function | Enforcement in DB, callable by anon, composable | One extra RPC call vs. direct table query |
| (b) DB view | `CREATE VIEW visible_slots AS ... LIMIT (tier_based)` | Transparent to frontend | PostgreSQL views cannot apply per-row LIMIT based on a different row's tier; would require complex window function |
| (c) Frontend filter | React filters after fetching all slots | Simple | No server enforcement; circumventable; returns more data than needed |

Option (b) is technically infeasible for a per-trainer limit — a view cannot apply a different LIMIT per trainer_id group without a window function approach that still returns all rows. Option (c) is not enforcement. **Use (a).**

```sql
-- Migration: add after trainer_profiles ALTER TABLE

CREATE OR REPLACE FUNCTION public.get_visible_slots(p_trainer_id uuid)
RETURNS SETOF public.availability_slots
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_tier  text;
  v_limit int;
BEGIN
  SELECT subscription_tier
  INTO   v_tier
  FROM   public.trainer_profiles
  WHERE  id = p_trainer_id;

  v_limit := CASE v_tier
    WHEN 'elite' THEN 2147483647   -- effectively unlimited
    WHEN 'pro'   THEN 10
    ELSE              3            -- free tier default
  END;

  RETURN QUERY
    SELECT s.*
    FROM   public.availability_slots s
    WHERE  s.trainer_id  = p_trainer_id
      AND  s.is_booked   = false
      AND  s.start_time  > now()
    ORDER  BY s.start_time
    LIMIT  v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_slots(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_visible_slots(uuid) TO authenticated;
```

**Frontend usage:**
```typescript
const { data: slots } = await supabase.rpc('get_visible_slots', {
  p_trainer_id: trainerId
});
```

This replaces the direct `supabase.from('availability_slots').select(...)` query on trainer profile pages. Existing trainer-owned slot queries (for the trainer's own dashboard) should continue to use the direct table query — the limit only applies to the client-facing view.

---

## 6. Search Ranking with Tier Boost

The existing trainer search (likely `ORDER BY tp.rating DESC`) needs a tier multiplier. The pattern is a computed score column in the ORDER BY clause.

```sql
CREATE OR REPLACE FUNCTION public.get_trainer_search(
  p_specialty text    DEFAULT NULL,
  p_location  text    DEFAULT NULL,
  p_limit     int     DEFAULT 20,
  p_offset    int     DEFAULT 0
)
RETURNS TABLE (
  id               uuid,
  user_id          uuid,
  full_name        text,
  specialty        text,
  bio              text,
  hourly_rate      numeric,
  location         text,
  rating           numeric,
  review_count     int,
  subscription_tier text,
  is_featured      boolean,
  avatar_url       text,
  search_score     numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    tp.id,
    tp.user_id,
    p.full_name,
    tp.specialty,
    tp.bio,
    tp.hourly_rate,
    tp.location,
    tp.rating,
    tp.review_count,
    tp.subscription_tier,
    tp.is_featured,
    p.avatar_url,
    -- Weighted search score: tier multiplier * quality signals
    (
      CASE tp.subscription_tier
        WHEN 'elite' THEN 3.0
        WHEN 'pro'   THEN 2.0
        ELSE              1.0
      END
      -- Rating weight: 0-5 scale, normalized to 0-1, then multiplied
      * (0.6 * (tp.rating / 5.0) + 0.4 * LEAST(tp.review_count::numeric / 20.0, 1.0))
    ) AS search_score
  FROM public.trainer_profiles tp
  JOIN public.profiles p ON p.id = tp.user_id
  WHERE tp.verified = true
    AND (p_specialty IS NULL OR tp.specialty = p_specialty)
    AND (p_location  IS NULL OR tp.location ILIKE '%' || p_location || '%')
  ORDER BY
    tp.is_featured DESC,          -- featured (elite) trainers first
    search_score   DESC,          -- tier * quality
    tp.rating      DESC           -- tiebreaker
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_trainer_search(text, text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_trainer_search(text, text, int, int) TO authenticated;
```

**Score formula explained:**
- Elite trainers get 3x multiplier, Pro gets 2x, Free gets 1x
- Rating component (60% weight): a 5-star trainer scores 1.0
- Review volume component (40% weight): caps at 20 reviews to prevent high-volume low-quality trainers from dominating
- `is_featured` (Elite perk) sorts before the score, ensuring Elite featured trainers always appear at the top

The composite index `(subscription_tier, rating DESC)` created in section 1 serves this query.

---

## 7. Webhook Idempotency

Stripe guarantees at-least-once delivery — the same event can fire multiple times (network retry, Stripe retry on non-200). The subscription state machine means a double-processed `customer.subscription.deleted` could incorrectly downgrade an active trainer.

### Pattern: Insert-first into `subscription_events`

```typescript
// stripe-webhook/index.ts — add to each billing event case block

async function handleBillingEvent(
  event: Stripe.Event,
  adminClient: SupabaseClient,
  trainerId: string
): Promise<boolean> {
  // Attempt to record the event — unique constraint on stripe_event_id
  const { error } = await adminClient
    .from('subscription_events')
    .insert({
      trainer_id:      trainerId,
      stripe_event_id: event.id,
      event_type:      event.type,
      payload:         event.data.object,
    });

  if (error?.code === '23505') {
    // PostgreSQL unique_violation: this event was already processed
    // Return 200 to Stripe (do not retry), skip all processing
    return false; // caller skips the update
  }

  if (error) {
    // Unexpected error — throw to trigger Stripe retry
    throw error;
  }

  return true; // caller proceeds with state update
}
```

**Usage in the switch block:**

```typescript
case 'customer.subscription.updated': {
  const sub = event.data.object as Stripe.Subscription;
  const trainerId = await resolveTrainerByCustomerId(sub.customer as string, adminClient);

  const shouldProcess = await handleBillingEvent(event, adminClient, trainerId);
  if (!shouldProcess) break;

  // Safe to process — not a duplicate
  await adminClient.from('trainer_profiles').update({
    subscription_tier:     resolvetier(sub),
    subscription_status:   sub.status,
    subscription_interval: sub.items.data[0]?.price.recurring?.interval ?? null,
    current_period_end:    new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end:  sub.cancel_at_period_end,
    trial_ends_at:         sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null,
  }).eq('id', trainerId);

  break;
}
```

**Always return HTTP 200 to Stripe**, even for duplicates. Returning 4xx causes Stripe to retry indefinitely (up to 3 days). The insert-first pattern handles deduplication at the DB level. Source: https://docs.stripe.com/webhooks

**The six billing events to handle (and their idempotency guards):**

| Event | DB action | Notes |
|-------|-----------|-------|
| `customer.subscription.created` | Write `subscription_id`, `subscription_tier`, `subscription_status: 'trialing'`, `trial_ends_at` | Fires after `create-subscription` Edge Function; Edge Function writes first, webhook confirms |
| `customer.subscription.updated` | Sync `subscription_tier`, `subscription_status`, `subscription_interval`, `current_period_end`, `cancel_at_period_end` | Primary event for all state changes |
| `customer.subscription.deleted` | `subscription_tier → 'free'`, `subscription_status → 'inactive'`, `subscription_id → NULL`, clear `cancel_at_period_end` | Terminal state |
| `customer.subscription.trial_will_end` | Send notification to trainer (3 days warning); no tier change | Fires ~72h before trial_end |
| `invoice.paid` | `subscription_status → 'active'` if currently `trialing` or `past_due` | Also fires on normal renewals |
| `invoice.payment_failed` | `subscription_status → 'past_due'`; send failure notification | Does NOT change tier yet |

---

## 8. Migration Strategy

With 14 existing migrations, v2.1 requires exactly **2 new migration files**. Both are additive — no existing columns or constraints are modified.

### Migration 15: `20260316100000_subscription_tiers.sql`

```sql
-- Migration 15: Subscription Tier DB Foundation
-- Adds subscription columns to trainer_profiles and creates subscription_events

BEGIN;

-- ============================================================
-- 1. Extend trainer_profiles with subscription fields
-- ============================================================

ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS subscription_tier      text NOT NULL DEFAULT 'free'
                              CHECK (subscription_tier IN ('free', 'pro', 'elite')),
  ADD COLUMN IF NOT EXISTS subscription_status    text NOT NULL DEFAULT 'inactive'
                              CHECK (subscription_status IN (
                                'inactive', 'trialing', 'active',
                                'past_due', 'canceled', 'paused', 'incomplete'
                              )),
  ADD COLUMN IF NOT EXISTS subscription_id        text,
  ADD COLUMN IF NOT EXISTS subscription_interval  text
                              CHECK (subscription_interval IN ('month', 'year', NULL)),
  ADD COLUMN IF NOT EXISTS trial_ends_at          timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end     timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tier_overridden_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tier_overridden_at     timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS trainer_profiles_stripe_customer_id_idx
  ON public.trainer_profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trainer_profiles_subscription_tier_idx
  ON public.trainer_profiles(subscription_tier);

CREATE INDEX IF NOT EXISTS trainer_profiles_tier_rating_idx
  ON public.trainer_profiles(subscription_tier, rating DESC);

-- ============================================================
-- 2. Trigger: prevent trainer self-modification of subscription fields
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_subscription_tier_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin' THEN
    RETURN NEW;
  END IF;
  IF NEW.subscription_tier     IS DISTINCT FROM OLD.subscription_tier    OR
     NEW.subscription_status   IS DISTINCT FROM OLD.subscription_status  OR
     NEW.subscription_id       IS DISTINCT FROM OLD.subscription_id      OR
     NEW.stripe_customer_id    IS DISTINCT FROM OLD.stripe_customer_id   OR
     NEW.trial_ends_at         IS DISTINCT FROM OLD.trial_ends_at        OR
     NEW.current_period_end    IS DISTINCT FROM OLD.current_period_end   OR
     NEW.cancel_at_period_end  IS DISTINCT FROM OLD.cancel_at_period_end THEN
    RAISE EXCEPTION 'Subscription fields are managed by the platform only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trainer_profiles_guard_subscription_write ON public.trainer_profiles;
CREATE TRIGGER trainer_profiles_guard_subscription_write
  BEFORE UPDATE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_tier_write();

-- ============================================================
-- 3. subscription_events table (audit log + idempotency)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id       uuid        NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
  stripe_event_id  text        NOT NULL,
  event_type       text        NOT NULL,
  payload          jsonb,
  processed_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_events_stripe_event_id_unique UNIQUE (stripe_event_id)
);

CREATE INDEX IF NOT EXISTS subscription_events_trainer_id_idx
  ON public.subscription_events(trainer_id, processed_at DESC);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_events_select_own
  ON public.subscription_events FOR SELECT
  USING (
    (SELECT user_id FROM public.trainer_profiles WHERE id = trainer_id)
      = (SELECT auth.uid())
  );

CREATE POLICY subscription_events_select_admin
  ON public.subscription_events FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin'
  );

CREATE POLICY subscription_events_insert_service
  ON public.subscription_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 4. get_visible_slots RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_visible_slots(p_trainer_id uuid)
RETURNS SETOF public.availability_slots
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_tier  text;
  v_limit int;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM   public.trainer_profiles
  WHERE  id = p_trainer_id;

  v_limit := CASE v_tier
    WHEN 'elite' THEN 2147483647
    WHEN 'pro'   THEN 10
    ELSE              3
  END;

  RETURN QUERY
    SELECT s.*
    FROM   public.availability_slots s
    WHERE  s.trainer_id = p_trainer_id
      AND  s.is_booked  = false
      AND  s.start_time > now()
    ORDER BY s.start_time
    LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_slots(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_visible_slots(uuid) TO authenticated;

COMMIT;
```

### Migration 16: `20260316110000_subscription_rpcs.sql`

```sql
-- Migration 16: Subscription RPCs (search ranking + admin MRR)

BEGIN;

-- ============================================================
-- 1. get_trainer_search (tier-boosted ranking)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_trainer_search(
  p_specialty text DEFAULT NULL,
  p_location  text DEFAULT NULL,
  p_limit     int  DEFAULT 20,
  p_offset    int  DEFAULT 0
)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  full_name         text,
  specialty         text,
  bio               text,
  hourly_rate       numeric,
  location          text,
  rating            numeric,
  review_count      int,
  subscription_tier text,
  is_featured       boolean,
  avatar_url        text,
  search_score      numeric
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    tp.id,
    tp.user_id,
    p.full_name,
    tp.specialty,
    tp.bio,
    tp.hourly_rate,
    tp.location,
    tp.rating,
    tp.review_count,
    tp.subscription_tier,
    tp.is_featured,
    p.avatar_url,
    (
      CASE tp.subscription_tier
        WHEN 'elite' THEN 3.0
        WHEN 'pro'   THEN 2.0
        ELSE              1.0
      END
      * (0.6 * (tp.rating / 5.0) + 0.4 * LEAST(tp.review_count::numeric / 20.0, 1.0))
    ) AS search_score
  FROM public.trainer_profiles tp
  JOIN public.profiles p ON p.id = tp.user_id
  WHERE tp.verified = true
    AND (p_specialty IS NULL OR tp.specialty = p_specialty)
    AND (p_location  IS NULL OR tp.location ILIKE '%' || p_location || '%')
  ORDER BY
    tp.is_featured DESC,
    search_score   DESC,
    tp.rating      DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_trainer_search(text, text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_trainer_search(text, text, int, int) TO authenticated;

-- ============================================================
-- 2. get_admin_mrr — MRR from monthly + annual subscriptions
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_mrr()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_result jsonb;
BEGIN
  -- Admin-only
  SELECT role INTO v_role FROM public.profiles WHERE id = (SELECT auth.uid());
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  WITH active_subs AS (
    -- Only count trainers with an active billing relationship
    -- Trials are excluded (no payment yet)
    SELECT
      tp.subscription_tier,
      tp.subscription_interval,
      tp.subscription_status
    FROM public.trainer_profiles tp
    WHERE tp.subscription_status IN ('active', 'past_due')
      AND tp.subscription_tier    IN ('pro', 'elite')
      AND tp.tier_overridden_by  IS NULL   -- exclude admin-granted free overrides
  ),
  mrr_by_tier AS (
    SELECT
      subscription_tier,
      subscription_interval,
      COUNT(*) AS subscriber_count,
      -- Normalize all plans to monthly equivalent
      COUNT(*) * CASE
        WHEN subscription_tier = 'pro'   AND subscription_interval = 'month' THEN 9.00
        WHEN subscription_tier = 'pro'   AND subscription_interval = 'year'  THEN 86.40  / 12.0
        WHEN subscription_tier = 'elite' AND subscription_interval = 'month' THEN 29.00
        WHEN subscription_tier = 'elite' AND subscription_interval = 'year'  THEN 278.40 / 12.0
        ELSE 0
      END AS mrr_contribution
    FROM active_subs
    GROUP BY subscription_tier, subscription_interval
  )
  SELECT jsonb_build_object(
    'mrr_total',    COALESCE(SUM(mrr_contribution), 0),
    'arr_estimate', COALESCE(SUM(mrr_contribution) * 12, 0),
    'breakdown',    COALESCE(
      jsonb_agg(jsonb_build_object(
        'tier',             subscription_tier,
        'interval',         subscription_interval,
        'subscriber_count', subscriber_count,
        'mrr_contribution', mrr_contribution
      ) ORDER BY mrr_contribution DESC),
      '[]'::jsonb
    ),
    'trial_count',  (
      SELECT COUNT(*)
      FROM public.trainer_profiles
      WHERE subscription_status = 'trialing'
    ),
    'past_due_count', (
      SELECT COUNT(*)
      FROM public.trainer_profiles
      WHERE subscription_status = 'past_due'
    )
  ) INTO v_result
  FROM mrr_by_tier;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_mrr() TO authenticated;

COMMIT;
```

**Summary of all SQL changes for v2.1:**

| Change | Type | Migration |
|--------|------|-----------|
| 9 new columns on `trainer_profiles` | ALTER TABLE | 15 |
| 2 new indexes on `trainer_profiles` | CREATE INDEX | 15 |
| 1 UNIQUE index on `stripe_customer_id` | CREATE UNIQUE INDEX | 15 |
| `guard_subscription_tier_write` trigger | CREATE FUNCTION + TRIGGER | 15 |
| `subscription_events` table + 2 indexes | CREATE TABLE | 15 |
| 3 RLS policies on `subscription_events` | CREATE POLICY | 15 |
| `get_visible_slots` RPC | CREATE FUNCTION | 15 |
| `get_trainer_search` RPC | CREATE FUNCTION | 16 |
| `get_admin_mrr` RPC | CREATE FUNCTION | 16 |

No existing tables are modified destructively. All changes are additive.

---

## 9. Trial Period Enforcement

### Status Values Needed

| Status | Meaning | How DB gets there |
|--------|---------|-------------------|
| `inactive` | No subscription, free tier | Default; also set by `customer.subscription.deleted` |
| `trialing` | Within 30-day trial, no charge yet | `create-subscription` Edge Function writes on creation; `customer.subscription.created` webhook confirms |
| `active` | Paying subscriber in good standing | `invoice.paid` after successful charge |
| `past_due` | Last payment failed, retrying | `invoice.payment_failed` webhook |
| `canceled` | Trial expired without card, or trainer canceled at period end | `customer.subscription.deleted` webhook — also sets tier → 'free' |
| `paused` | Trial ended without payment method AND `missing_payment_method: 'pause'` was configured | `customer.subscription.paused` webhook |
| `incomplete` | Subscription created but initial payment not yet confirmed | Write from `create-subscription` if `payment_behavior: 'default_incomplete'` — cleared by `customer.subscription.updated` once payment confirmed |

### Recommended trial configuration

Use `missing_payment_method: 'cancel'` (not `pause`) for simplicity. The canceled flow is cleaner for trainers — they clearly lose access and must re-subscribe, preventing confusion about "paused" state. Only use `pause` if you want to allow trainers to resume from the exact subscription state after adding a card.

### Payment Failure Flow

```
Day 30 — trial ends, card on file:
  Stripe charges → invoice.paid
  webhook: subscription_status → 'active'

Day 30 — trial ends, no card:
  Stripe fires customer.subscription.deleted
  webhook: subscription_tier → 'free', subscription_status → 'inactive'
  Trainer loses Pro/Elite features immediately

Renewal failure (active subscription, card declined):
  invoice.payment_failed
  webhook: subscription_status → 'past_due'
  Stripe retries per Smart Retries schedule (default: day 1, 3, 5, 7)
  All retries: invoice.payment_failed (idempotency guard prevents duplicate DB writes)
  Max retries exceeded → customer.subscription.deleted
  webhook: subscription_tier → 'free', subscription_status → 'inactive'
```

**Access during `past_due`:** Keep tier access active while `past_due`. Trainers should see a banner "Payment failed — update your payment method or lose access." Stripping access immediately on first failure is bad UX and loses revenue on retried payments. Revoke access only on `canceled`.

---

## 10. Admin MRR RPC

The `get_admin_mrr()` function is defined in full in section 8 (Migration 16). Key design decisions:

**Annual plan normalization:** Divide annual revenue by 12 to get monthly equivalent (MRR). Do not count the full annual payment in the month it's charged — that would distort MRR.
- Pro monthly: $9.00/month MRR per subscriber
- Pro annual: $86.40 / 12 = $7.20/month MRR per subscriber (discounted)
- Elite monthly: $29.00/month MRR per subscriber
- Elite annual: $278.40 / 12 = $23.20/month MRR per subscriber (discounted)

**Exclusions from MRR:**
- `trialing` status: no payment made yet; counted separately as `trial_count`
- `inactive` / `canceled`: no revenue
- `tier_overridden_by IS NOT NULL`: admin-granted tiers that bypassed Stripe billing should not inflate MRR (they generate no revenue)
- `past_due` is INCLUDED: the payment is expected to succeed on retry; this is standard MRR accounting practice

**Return shape:**
```json
{
  "mrr_total": 1247.60,
  "arr_estimate": 14971.20,
  "breakdown": [
    { "tier": "elite", "interval": "month", "subscriber_count": 12, "mrr_contribution": 348.00 },
    { "tier": "pro",   "interval": "month", "subscriber_count": 89, "mrr_contribution": 801.00 },
    { "tier": "pro",   "interval": "year",  "subscriber_count": 14, "mrr_contribution":  98.60 }
  ],
  "trial_count": 23,
  "past_due_count": 4
}
```

---

## Build Order (Dependency-Driven)

| Step | Component | Type | Depends On |
|------|-----------|------|-----------|
| 1 | Create Stripe Products + Prices in Dashboard | Stripe config | Nothing |
| 2 | Add price IDs as Supabase secrets | Config | Step 1 |
| 3 | Migration 15: `trainer_profiles` columns + `subscription_events` + `get_visible_slots` | DB | Nothing — additive |
| 4 | Migration 16: `get_trainer_search` + `get_admin_mrr` RPCs | DB | Step 3 |
| 5 | `create-subscription` Edge Function | Edge Function | Steps 2, 3 |
| 6 | Register billing webhook events in Stripe Dashboard | Stripe config | Step 5 |
| 7 | Extend `stripe-webhook` with 6 billing event handlers | Edge Function | Steps 3, 6 |
| 8 | `manage-subscription` Edge Function (cancel, billing portal) | Edge Function | Steps 2, 3 |
| 9 | `useSubscriptionTier` hook + `SubscriptionGate` component | Frontend | Steps 3, 5 |
| 10 | Subscription UI: plan picker, trial CTA, billing portal link | Frontend | Steps 5, 8, 9 |
| 11 | Feature gate enforcement: slot gating, search ranking, analytics guard | Frontend + DB | Steps 4, 9 |
| 12 | Admin UI: tier badge, manual override, MRR widget | Frontend | Step 4 |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Tier Only in Stripe

**What goes wrong:** Skip `subscription_tier` column, query Stripe API to check tier on each request.
**Consequences:** 100–500ms latency on every gated page load; Stripe outage blocks feature access; RLS cannot reference Stripe state.
**Prevention:** Store tier in DB. DB is the read path. Stripe is the write/billing path. Webhook keeps them in sync.

### Anti-Pattern 2: Using `acct_xxx` as Billing Customer

**What goes wrong:** Pass `customer: acct_xxx` when creating a Subscription.
**Consequences:** Stripe rejects or routes to the wrong account; platform cannot bill the trainer.
**Prevention:** Always create a separate `cus_xxx` Customer on the platform account. Store both `stripe_account_id` (existing) and `stripe_customer_id` (new) on `trainer_profiles`.

### Anti-Pattern 3: Skipping Idempotency

**What goes wrong:** Process webhook events without duplicate check. Stripe retries on timeout or server errors.
**Consequences:** Double email sends, double tier changes, double audit log entries.
**Prevention:** Insert into `subscription_events` first. PostgreSQL `23505` unique violation = already processed. Exit cleanly.

### Anti-Pattern 4: Client-Side-Only Feature Gates

**What goes wrong:** Check tier in React component only.
**Consequences:** Any user can observe and bypass the JS check in DevTools. A compromised JWT with a manipulated profile query could expose unlimited slots.
**Prevention:** `get_visible_slots` RPC enforces the limit at DB level. `get_trainer_analytics` checks tier inside the function. Client gates are UX, not security.

### Anti-Pattern 5: Revoking Access on First Payment Failure

**What goes wrong:** Drop tier to 'free' immediately when `invoice.payment_failed` fires.
**Consequences:** Stripe retries payments 3–4 times over a week. Revoking access immediately for a card that was just declined due to a transient issue loses real revenue and creates bad UX.
**Prevention:** `past_due` status keeps tier active. Only downgrade to 'free' on `customer.subscription.deleted` (all retries exhausted).

### Anti-Pattern 6: Not Backfilling `subscription_tier` to 'free'

**What goes wrong:** Migration adds `subscription_tier` with DEFAULT 'free', but existing 14 migrations have trainer_profiles rows without it.
**Consequences:** None — `DEFAULT 'free'` in the column definition handles existing rows. PostgreSQL applies the default to all existing NULLs when the column has `NOT NULL DEFAULT`. Verify this works in dev before deploying.

---

## Scaling Considerations

| Scale | Concern | Approach |
|-------|---------|----------|
| 0–500 trainers | Webhook throughput | Single `stripe-webhook` function handles all events; within Supabase Edge Function limits |
| 500–10k trainers | Search performance | `(subscription_tier, rating DESC)` index serves `get_trainer_search`; pg stats will drive planner |
| 10k+ trainers | MRR aggregation | `get_admin_mrr` scans all `trainer_profiles`; consider materialized view refreshed hourly |
| 10k+ trainers | Webhook event volume | Separate Billing webhook function from Connect webhook function; current combined function becomes a hot path |

---

## Sources

- [Stripe: Charge SaaS fees to connected accounts](https://docs.stripe.com/connect/integrate-billing-connect) — HIGH confidence. Customer vs. Connect Account distinction; must create separate `cus_xxx`.
- [Stripe: Subscription lifecycle webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) — HIGH confidence. Event names, timing, trial_will_end timing.
- [Stripe: How subscriptions work](https://docs.stripe.com/billing/subscriptions/overview) — HIGH confidence. All status values: trialing, active, past_due, incomplete, incomplete_expired, unpaid, canceled, paused.
- [Stripe: Trial periods](https://docs.stripe.com/billing/subscriptions/trials) — HIGH confidence. `trial_settings.end_behavior.missing_payment_method: 'cancel'` vs `'pause'`.
- [Stripe: Handling webhooks](https://docs.stripe.com/webhooks) — HIGH confidence. Idempotency guidance; return 200 for duplicates.
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence. `(SELECT auth.uid())` initPlan optimization; 95% speedup claim.
- [Supabase: RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — HIGH confidence. Subquery wrapping pattern for policy performance.
- Existing codebase (migration files 1–14) — HIGH confidence. Admin role pattern, service-role policy pattern, SECURITY DEFINER function pattern, `initiated_by` constraint pattern.

---

*Architecture research for: FitRush v2.1 — Subscription Tiers (Supabase + Stripe Connect + Stripe Billing)*
*Researched: 2026-03-15*
