-- Migration: 20260316100000_subscription_foundation.sql
-- Phase 12: Subscription Foundation
-- Adds subscription infrastructure to trainer_profiles; creates subscription_events table;
-- creates guard_subscription_tier_write trigger; creates get_visible_slots RPC.
-- All columns use ADD COLUMN IF NOT EXISTS — zero impact on existing rows.

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
-- WHY a trigger, not RLS: Supabase RLS has no column-level UPDATE restriction.
-- A WITH CHECK on the existing update policy cannot inspect which columns changed.
-- The BEFORE UPDATE trigger with IS DISTINCT FROM is the only enforceable mechanism.
CREATE OR REPLACE FUNCTION public.guard_subscription_tier_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role always bypasses (webhook handlers, scheduled jobs)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admin bypass (Phase 16 manual tier override)
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Block any authenticated user from touching billing columns
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
-- SECURITY DEFINER: enforces tier-based slot limits regardless of caller's RLS context.
-- Anonymous clients browsing trainer profiles need to see up to 3 slots for free trainers;
-- SECURITY INVOKER would block anon if availability_slots has restrictive anon RLS.
-- Filters deleted_at IS NULL (soft-delete pattern from migration 20260313100001).
-- Does NOT filter is_active — no such column exists on availability_slots.
-- Elite uses INT max (2147483647) to avoid a conditional LIMIT clause.
CREATE OR REPLACE FUNCTION public.get_visible_slots(p_trainer_id uuid)
RETURNS SETOF public.availability_slots
LANGUAGE plpgsql
SECURITY DEFINER
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
