# Phase 12: Subscription Foundation — Research

**Researched:** 2026-03-15
**Domain:** PostgreSQL migrations + Stripe Dashboard configuration for subscription tier infrastructure
**Confidence:** HIGH

---

## Summary

Phase 12 is pure infrastructure. It lays the database schema contract and Stripe configuration that every subsequent v2.1 phase builds on. No Edge Functions, no React code — just migrations and manual Stripe Dashboard steps. The entire phase is deterministic: every SQL statement and every Stripe configuration option is fully specified before a single line is written.

The three high-stakes decisions already made in the SUMMARY.md research apply directly here: (1) subscription columns go on `trainer_profiles`, not a new table; (2) `subscription_tier` must be service-role-only writable via a BEFORE UPDATE trigger — not an RLS policy, because Supabase RLS does not support column-level UPDATE restrictions; (3) the billing webhook endpoint must be separate from the existing Connect webhook with its own `whsec_*` secret. All three are one-way doors: getting them wrong after Phase 13 lands requires production reconciliation.

The existing codebase was read in full. The `trainer_profiles` table currently has: `id`, `user_id`, `specialty`, `bio`, `hourly_rate`, `optimized_rate`, `location`, `latitude`, `longitude`, `certifications`, `verified`, `rating`, `review_count`, `stripe_account_id`, `certification_number`, `certification_url`, `created_at`, `updated_at`. None of the 9 subscription columns exist yet. The `availability_slots` table has `deleted_at` (soft delete) and no `is_active` column. The `get_visible_slots` RPC must filter by `deleted_at IS NULL`, not `is_active`. The client_profiles table (onboarding migration) already uses `stripe_customer_id` — that column name is available on trainer_profiles without conflict.

**Primary recommendation:** Ship this phase as a single migration file (`20260316100000_subscription_tiers.sql`) plus the 5 manual Stripe Dashboard steps. The migration is additive-only: all new columns use `ADD COLUMN IF NOT EXISTS` with safe defaults so zero existing rows are affected.

---

## Standard Stack

### Core

| Component | Version/Tool | Purpose | Why |
|-----------|-------------|---------|-----|
| Supabase Migration | SQL file | Extend trainer_profiles + create subscription_events | Project-established migration pattern (14 existing files) |
| PostgreSQL BEFORE UPDATE trigger | plpgsql | Guard subscription column writes to service-role only | Supabase RLS has no column-level UPDATE restriction; trigger is the only mechanism |
| SECURITY DEFINER function | plpgsql | `get_visible_slots` RPC enforcing 3/10/unlimited limits | Ensures limit enforced regardless of caller's RLS context |
| Stripe Dashboard (manual) | Web UI | Create Products, Prices, billing webhook endpoint | No API needed for one-time setup; dashboard is the authoritative source of truth for Price IDs |
| Supabase Vault secrets | CLI / Dashboard | Store 5 new secrets | Follows project-established pattern from v2.0 (VAULT secrets are NOT in migration files) |

### Migration Timestamp

The next migration must use a timestamp after `20260316000000` (referral system). Safe timestamp: `20260316100000_subscription_tiers.sql`.

---

## Architecture Patterns

### Recommended Migration Structure

```
supabase/migrations/
└── 20260316100000_subscription_tiers.sql
    ├── Section 1: ALTER TABLE trainer_profiles (9 new columns)
    ├── Section 2: Indexes (3 new indexes)
    ├── Section 3: CREATE TABLE subscription_events
    ├── Section 4: RLS for subscription_events
    ├── Section 5: guard_subscription_tier_write() trigger function
    ├── Section 6: CREATE TRIGGER trainer_profiles_guard_subscription_write
    └── Section 7: get_visible_slots() RPC
```

### Pattern 1: trainer_profiles Column Additions

**What:** 9 new columns added with `ADD COLUMN IF NOT EXISTS` and safe defaults.
**When to use:** Additive-only migration — no data backfill, no existing rows affected.

```sql
-- Source: ARCHITECTURE.md (verified against current schema)
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
```

**Column count:** 10 columns listed above — `stripe_customer_id`, `subscription_tier`, `subscription_status`, `subscription_id`, `subscription_interval`, `trial_ends_at`, `current_period_end`, `cancel_at_period_end`, `tier_overridden_by`, `tier_overridden_at`. The success criterion says "9 new columns" — the 10th is `tier_overridden_at` which pairs with `tier_overridden_by`. Include all 10; the planner should note this delta vs. the success criterion wording.

**Required indexes:**

```sql
-- Source: ARCHITECTURE.md
CREATE UNIQUE INDEX IF NOT EXISTS trainer_profiles_stripe_customer_id_idx
  ON public.trainer_profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trainer_profiles_subscription_tier_idx
  ON public.trainer_profiles(subscription_tier);

CREATE INDEX IF NOT EXISTS trainer_profiles_tier_rating_idx
  ON public.trainer_profiles(subscription_tier, rating DESC);
```

### Pattern 2: subscription_events Table

**What:** New audit log + idempotency table. The `UNIQUE (stripe_event_id)` constraint is the idempotency mechanism.
**When to use:** Every Stripe billing webhook INSERT attempts this table first; a duplicate key error (code `23505`) means the event was already processed.

```sql
-- Source: ARCHITECTURE.md
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

DROP POLICY IF EXISTS subscription_events_select_own ON public.subscription_events;
CREATE POLICY subscription_events_select_own
  ON public.subscription_events FOR SELECT
  USING ((SELECT user_id FROM public.trainer_profiles WHERE id = trainer_id) = (SELECT auth.uid()));

DROP POLICY IF EXISTS subscription_events_select_admin ON public.subscription_events;
CREATE POLICY subscription_events_select_admin
  ON public.subscription_events FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin');

DROP POLICY IF EXISTS subscription_events_insert_service ON public.subscription_events;
CREATE POLICY subscription_events_insert_service
  ON public.subscription_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

### Pattern 3: Subscription Column Write Guard Trigger

**What:** BEFORE UPDATE trigger blocks authenticated users from modifying subscription columns. Service-role and admin bypass. This is the critical security gate.
**Why a trigger, not RLS:** Supabase RLS does not support column-level UPDATE restrictions. A WITH CHECK on the existing `trainer_profiles_update_own` policy cannot inspect which columns changed. The trigger is the only enforced path.

```sql
-- Source: ARCHITECTURE.md (official Supabase pattern)
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

  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

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

**Verification test (from success criteria):** An authenticated-role UPDATE to `subscription_tier` should be rejected. Verify with:
```sql
-- Run as authenticated trainer user (not service-role):
UPDATE public.trainer_profiles SET subscription_tier = 'pro' WHERE user_id = auth.uid();
-- Expected: ERROR: Subscription fields can only be modified by the platform
```

### Pattern 4: get_visible_slots RPC

**What:** SECURITY INVOKER function that reads trainer tier and returns a LIMIT-filtered set of future unbooked slots.
**Critical detail:** Must filter `deleted_at IS NULL` — the project uses soft deletes on availability_slots (migration `20260313100001`). Must NOT filter by `is_active` (no such column exists on this table).

```sql
-- Source: ARCHITECTURE.md + verified against availability_slots schema
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
    WHEN 'elite' THEN 2147483647
    WHEN 'pro'   THEN 10
    ELSE              3
  END;

  RETURN QUERY
    SELECT s.*
    FROM   public.availability_slots s
    WHERE  s.trainer_id  = p_trainer_id
      AND  s.is_booked   = false
      AND  s.deleted_at  IS NULL
      AND  s.start_time  > now()
    ORDER  BY s.start_time
    LIMIT  v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_slots(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_visible_slots(uuid) TO authenticated;
```

**Verification test (from success criteria):**
```sql
SELECT get_visible_slots('<free_trainer_id>');   -- must return at most 3 rows
SELECT get_visible_slots('<pro_trainer_id>');    -- must return at most 10 rows
SELECT get_visible_slots('<elite_trainer_id>'); -- returns all rows
```

### Pattern 5: Stripe Dashboard Configuration (Manual Steps)

**What:** 5 sequential manual actions in Stripe Dashboard. No automation needed.

**Step 1 — Create Products (Stripe Dashboard > Products)**
- Product 1: Name = "FitRush Pro", Statement descriptor = "FITRUSH PRO"
- Product 2: Name = "FitRush Elite", Statement descriptor = "FITRUSH ELITE"

**Step 2 — Create 4 Price objects (one per Product per interval)**

| Price ID env var | Product | Amount | Interval |
|-----------------|---------|--------|----------|
| `STRIPE_PRICE_PRO_MONTHLY` | FitRush Pro | $9.00/mo | monthly |
| `STRIPE_PRICE_PRO_YEARLY` | FitRush Pro | $86.40/yr ($7.20/mo × 12) | yearly |
| `STRIPE_PRICE_ELITE_MONTHLY` | FitRush Elite | $29.00/mo | monthly |
| `STRIPE_PRICE_ELITE_YEARLY` | FitRush Elite | $278.40/yr ($23.20/mo × 12) | yearly |

Annual prices reflect 20% discount as per BILL-04 requirement. Each Price ID (`price_xxx`) is the value stored as a Supabase secret.

**Step 3 — Configure Revenue Recovery (Stripe Dashboard > Billing > Revenue recovery > Retries)**
- Terminal action after retries exhausted: set to **Cancel** (not "unpaid" or "past_due")
- This ensures `customer.subscription.deleted` always fires at the end of dunning — the webhook handler only needs to handle that single terminal event, not multiple status states

**Step 4 — Configure Customer Portal (Stripe Dashboard > Settings > Billing > Customer portal)**
- Enable: Cancel subscriptions, Update payment methods, View invoices
- Cancellation behavior: Cancel at end of billing period (not immediately)
- Business information: Link to fitrush-app.netlify.app privacy policy and terms

**Step 5 — Create Billing Webhook Endpoint (Stripe Dashboard > Developers > Webhooks > Add endpoint)**
- Endpoint URL: `https://qecwxvvlpvrnrqyrdxrj.supabase.co/functions/v1/stripe-billing-webhook`
  - NOTE: This URL uses the new `stripe-billing-webhook` function (not the existing `stripe-webhook`). Phase 13 creates this function. Phase 12 just registers the endpoint to obtain the `whsec_*` secret.
- Events to listen for (minimum set for Phase 13):
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.trial_will_end`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Signing secret (`whsec_*`) = value for `STRIPE_BILLING_WEBHOOK_SECRET`

### Pattern 6: Supabase Vault Secrets

**How secrets are added:** Per project convention (established in v2.0), secrets are NOT stored in migration files. They are added manually via Supabase Dashboard > Edge Functions > Secrets, or via the CLI:

```bash
# CLI pattern (same as used for STRIPE_WEBHOOK_SECRET, RESEND_API_KEY etc.)
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_PRO_YEARLY=price_xxx
supabase secrets set STRIPE_PRICE_ELITE_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_ELITE_YEARLY=price_xxx
supabase secrets set STRIPE_BILLING_WEBHOOK_SECRET=whsec_xxx
```

**5 secrets to add in this phase:**
1. `STRIPE_PRICE_PRO_MONTHLY` — from Step 2 Price creation
2. `STRIPE_PRICE_PRO_YEARLY` — from Step 2 Price creation
3. `STRIPE_PRICE_ELITE_MONTHLY` — from Step 2 Price creation
4. `STRIPE_PRICE_ELITE_YEARLY` — from Step 2 Price creation
5. `STRIPE_BILLING_WEBHOOK_SECRET` — from Step 5 webhook creation

### Anti-Patterns to Avoid

- **Using the existing `stripe-webhook` endpoint URL for billing events:** Connect events and billing events need separate signing secrets. The webhook endpoint registered in Stripe Dashboard must point to `stripe-billing-webhook`, not the existing `stripe-webhook`.
- **Filtering `availability_slots` by `is_active`:** No such column exists. Filter by `deleted_at IS NULL` and `is_booked = false`.
- **Putting stripe secrets in the migration file as SQL comments:** The project convention is manual setup only. Migration files are committed to git; secrets must not appear there.
- **Using `subscription_tier` values other than `free`, `pro`, `elite`:** The CHECK constraint only allows these three. The webhook handler in Phase 13 must map `trialing` Stripe status to `subscription_status`, not `subscription_tier`. During trial, `subscription_tier = 'pro'` (or `'elite'`) and `subscription_status = 'trialing'`.
- **Creating the Stripe Customer at signup:** Create it lazily — only when the trainer first attempts to subscribe. The `create-subscription` Edge Function (Phase 13) handles this. Phase 12 only adds the `stripe_customer_id` column.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column-level write restriction | Custom RLS WITH CHECK per column | BEFORE UPDATE trigger with `IS DISTINCT FROM` check | Supabase RLS has no column-level UPDATE support; trigger is the authoritative pattern |
| Per-trainer row LIMIT in a view | PostgreSQL VIEW with conditional LIMIT | SECURITY INVOKER RPC function | Views cannot apply different LIMITs per row group; RPC is the only enforceable pattern |
| Idempotency logic in webhook code | Application-level deduplication cache | UNIQUE constraint on `stripe_event_id` | DB constraint is atomic and survives function restarts; application cache is lost on cold start |
| Webhook secret validation routing | Parsing event fields to determine secret | Separate Stripe webhook endpoints per event origin | One-time setup; eliminates all runtime routing complexity |

---

## Common Pitfalls

### Pitfall 1: `subscription_tier` vs `subscription_status` Confusion

**What goes wrong:** Using `subscription_tier` to store `'trialing'` status. The CHECK constraint rejects it.
**Why it happens:** Stripe's subscription object has a `status` field that includes `trialing`. Developers map this directly to `subscription_tier`.
**How to avoid:** `subscription_tier` = the plan level (`free`, `pro`, `elite`). `subscription_status` = the lifecycle state (`inactive`, `trialing`, `active`, `past_due`, `canceled`, `paused`, `incomplete`). During a Pro trial: `subscription_tier = 'pro'`, `subscription_status = 'trialing'`.
**Warning signs:** CHECK constraint violation on INSERT/UPDATE to `subscription_tier` column.

### Pitfall 2: get_visible_slots Filtering on Wrong Column

**What goes wrong:** Using `is_active = true` or no soft-delete filter — returns slots that were soft-deleted.
**Why it happens:** Other systems use `is_active`; this codebase uses `deleted_at IS NULL` (migration `20260313100001`).
**How to avoid:** Always filter `deleted_at IS NULL` in availability_slots queries.
**Warning signs:** Soft-deleted slots appearing in slot listings.

### Pitfall 3: Missing Stripe Revenue Recovery Configuration

**What goes wrong:** Leaving Retries terminal action at default. If default is `unpaid` (not `cancel`), the `customer.subscription.deleted` event never fires after dunning exhaustion. Trainers retain paid features indefinitely.
**Why it happens:** Stripe Dashboard default varies by account age and region.
**How to avoid:** Explicitly set Billing > Revenue recovery > Retries > terminal action to **Cancel** in the same session as creating the webhook endpoint.
**Warning signs:** No `customer.subscription.deleted` event in webhook logs when a test subscription exhausts retries.

### Pitfall 4: Webhook Endpoint URL Points to Non-Existent Function

**What goes wrong:** Registering the billing webhook URL before Phase 13 deploys the function. Stripe retries for 72 hours on non-200 responses.
**Why it happens:** The endpoint must be registered to get the `whsec_*` secret, but the function doesn't exist yet.
**How to avoid:** This is expected behavior in Phase 12. The endpoint will return 404 until Phase 13 deploys the function. Stripe events during this window will be retried and eventually succeed once Phase 13 is deployed. The 72-hour retry window is sufficient. Alternatively, deploy a stub function that returns 200 immediately — but this is not required.
**Warning signs:** Stripe Dashboard showing 404 errors on the billing webhook endpoint is expected until Phase 13.

### Pitfall 5: Wrong Migration Timestamp

**What goes wrong:** Using a timestamp earlier than `20260316000000` — migration runs out of order, subscription columns added before referral system columns, or migration is silently skipped.
**How to avoid:** Use `20260316100000` or later. The referral system migration is `20260316000000`.

---

## Code Examples

### Complete migration file structure

```sql
-- Migration: 20260316100000_subscription_tiers.sql
-- Phase 12: Subscription Foundation
-- Adds subscription infrastructure to trainer_profiles; creates subscription_events table;
-- creates get_visible_slots RPC; guards subscription column writes.

-- ============================================================
-- Section 1: Extend trainer_profiles with subscription columns
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

-- ============================================================
-- Section 2: Indexes
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS trainer_profiles_stripe_customer_id_idx
  ON public.trainer_profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS trainer_profiles_subscription_tier_idx
  ON public.trainer_profiles(subscription_tier);

CREATE INDEX IF NOT EXISTS trainer_profiles_tier_rating_idx
  ON public.trainer_profiles(subscription_tier, rating DESC);

-- ============================================================
-- Section 3: subscription_events table
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

-- ============================================================
-- Section 4: RLS for subscription_events
-- ============================================================
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_events_select_own ON public.subscription_events;
CREATE POLICY subscription_events_select_own
  ON public.subscription_events FOR SELECT
  USING ((SELECT user_id FROM public.trainer_profiles WHERE id = trainer_id) = (SELECT auth.uid()));

DROP POLICY IF EXISTS subscription_events_select_admin ON public.subscription_events;
CREATE POLICY subscription_events_select_admin
  ON public.subscription_events FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin');

DROP POLICY IF EXISTS subscription_events_insert_service ON public.subscription_events;
CREATE POLICY subscription_events_insert_service
  ON public.subscription_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Section 5: guard_subscription_tier_write() trigger function
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

  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

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

-- ============================================================
-- Section 6: Attach guard trigger
-- ============================================================
DROP TRIGGER IF EXISTS trainer_profiles_guard_subscription_write ON public.trainer_profiles;
CREATE TRIGGER trainer_profiles_guard_subscription_write
  BEFORE UPDATE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_tier_write();

-- ============================================================
-- Section 7: get_visible_slots RPC
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
  SELECT subscription_tier
  INTO   v_tier
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
    WHERE  s.trainer_id  = p_trainer_id
      AND  s.is_booked   = false
      AND  s.deleted_at  IS NULL
      AND  s.start_time  > now()
    ORDER  BY s.start_time
    LIMIT  v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_slots(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_visible_slots(uuid) TO authenticated;
```

### Verifying the tier guard (manual test after migration)

```sql
-- Run this as the authenticated trainer user (not service-role) in Supabase SQL editor
-- Should throw: "Subscription fields can only be modified by the platform"
BEGIN;
  SET LOCAL role = authenticated;
  -- Simulate a trainer trying to self-upgrade
  UPDATE public.trainer_profiles
  SET subscription_tier = 'pro'
  WHERE id = '<any_trainer_profile_id>';
ROLLBACK;
```

### Verifying get_visible_slots limits (manual test after migration)

```sql
-- Set a trainer to free tier (they already are by default)
-- Confirm at most 3 rows returned for a trainer with many future slots
SELECT count(*) FROM get_visible_slots('<trainer_with_10_future_slots>');
-- Expected: 3

-- Set subscription_tier = 'pro' via service-role, then re-check
UPDATE public.trainer_profiles
SET subscription_tier = 'pro'
WHERE id = '<trainer_id>';
SELECT count(*) FROM get_visible_slots('<trainer_id>');
-- Expected: 10 (or however many future slots exist, up to 10)
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Separate `subscriptions` table with JOIN | Denormalized columns on `trainer_profiles` | RLS policy checks are single-column lookups — no joins needed |
| Column-level RLS (not supported by Supabase) | BEFORE UPDATE trigger with IS DISTINCT FROM | Actual enforcement; not possible any other way in Supabase |
| `is_active` column for soft deletes | `deleted_at IS NULL` soft delete (migration 20260313100001) | All slot queries must use `deleted_at IS NULL` filter |
| Embedding subscription tier in JWT claims | Query DB directly via `auth.uid()` in RLS | No 1-hour stale window on downgrade |

---

## Open Questions

1. **Success criterion says "9 new columns" but schema design has 10**
   - What we know: ARCHITECTURE.md specifies 10 columns (`tier_overridden_at` is the 10th alongside `tier_overridden_by`).
   - What's unclear: Whether the success criterion was written before `tier_overridden_at` was added to the design.
   - Recommendation: Include all 10 columns. The admin override pattern (Phase 16) requires both columns. The `\d trainer_profiles` command will show 10 new columns. Document this in the plan's verification step.

2. **Billing webhook URL before Phase 13 deploys the function**
   - What we know: The endpoint must be registered in Stripe to get `whsec_*`, but the function `stripe-billing-webhook` does not exist until Phase 13.
   - What's unclear: Whether to deploy a stub function now or accept 404s during the gap.
   - Recommendation: Accept 404s. Stripe retries for 72 hours. Phase 13 follows immediately. The gap between Phase 12 completion and Phase 13 deployment will be minutes to hours, not days.

3. **Grandfathering existing trainers**
   - What we know: All existing trainers will get `subscription_tier = 'free'` and `subscription_status = 'inactive'` as defaults when this migration runs.
   - What's unclear: Whether any production trainers existed before this migration and will have behavior changes.
   - Recommendation: The defaults are correct. All existing trainers start on Free. TIER-01 behavior (max 3 slots visible) was not enforced before v2.1 — `get_visible_slots` is a new RPC that nothing calls yet. No behavioral regression for existing users until Phase 14 wires the feature gates.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | No automated test framework detected in project |
| Config file | None — all validation is manual SQL in Supabase SQL editor or `supabase db diff` |
| Quick run command | `supabase db diff` (schema drift check) |
| Full suite command | Manual SQL verification queries (see Code Examples section) |

### Phase Requirements to Test Map

Phase 12 has no BILL/TIER/SRCH/ADMN requirement IDs — it is the infrastructure foundation. However the success criteria map directly to manual verification steps:

| Success Criterion | Test Type | Verification Command | File Exists? |
|-------------------|-----------|---------------------|-------------|
| `\d trainer_profiles` shows all new columns | manual | `SELECT column_name FROM information_schema.columns WHERE table_name = 'trainer_profiles' ORDER BY ordinal_position;` | N/A — run post-migration |
| Service-role UPDATE to `subscription_tier` succeeds | manual | `UPDATE trainer_profiles SET subscription_tier = 'pro' WHERE id = '<id>'` (run as service-role) | N/A |
| Authenticated-role UPDATE to `subscription_tier` is rejected | manual | Run UPDATE as authenticated user — must throw exception | N/A |
| `get_visible_slots` returns correct limits | manual | Call RPC with trainers at each tier | N/A |
| `subscription_events` table exists with UNIQUE on `stripe_event_id` | manual | `\d subscription_events` in psql | N/A |
| Stripe Dashboard shows 2 Products, 4 Prices, portal, billing webhook | manual | Visual inspection of Stripe Dashboard | N/A |

### Sampling Rate

- **Per wave merge:** Run all 5 manual SQL verification queries above in Supabase SQL editor
- **Phase gate:** All 6 success criteria verified before marking Phase 12 complete

### Wave 0 Gaps

None — this phase has no automated tests. All verification is manual SQL against the running Supabase instance. The existing project has no test infrastructure. Manual verification against the success criteria is the correct approach for a pure-migration phase.

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/ARCHITECTURE.md` — Full DDL, RLS policies, trigger function, RPC, and idempotency pattern
- `.planning/research/PITFALLS.md` — Critical pitfalls P1 through P19 with prevention code
- `.planning/research/SUMMARY.md` — Confirmed approach table, phase ordering rationale
- `Cenlar demand gt 1-17/supabase/migrations/20260311143000_fitconnect_current_schema.sql` — Current trainer_profiles columns (confirmed no subscription columns exist)
- `Cenlar demand gt 1-17/supabase/migrations/20260313100001_availability_soft_delete.sql` — Confirmed `deleted_at IS NULL` soft-delete pattern (no `is_active` column)
- `Cenlar demand gt 1-17/supabase/migrations/20260315120000_onboarding.sql` — Confirmed `stripe_customer_id` column name is already used on `client_profiles` but NOT on `trainer_profiles` (no conflict)
- `Cenlar demand gt 1-17/supabase/migrations/20260316000000_referral_system.sql` — Confirmed latest migration timestamp for ordering
- [Stripe: Create subscriptions with Billing (Connect)](https://docs.stripe.com/connect/subscriptions) — Customer object requirement
- [Stripe: Revenue recovery / Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries) — Terminal action configuration
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — initPlan optimization for auth.uid() in policies

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Vault secrets convention (NOT in migration files) established in v2.0

---

## Metadata

**Confidence breakdown:**
- Migration DDL: HIGH — directly verified against current schema; all column names, types, and constraints are specified
- RLS and trigger patterns: HIGH — sourced from ARCHITECTURE.md which cites official Supabase docs; verified against existing migration patterns
- Stripe Dashboard steps: HIGH — sourced from official Stripe docs; Price IDs and amounts derive directly from REQUIREMENTS.md (BILL-04)
- Vault secrets pattern: HIGH — established project convention confirmed in STATE.md

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable — Stripe Dashboard UI may change but API objects do not)
