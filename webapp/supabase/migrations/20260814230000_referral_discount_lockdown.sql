-- Referral discount column lockdown.
--
-- profiles_update_own (auth.uid() = id, no column scoping) lets any
-- authenticated user set their own profiles.referral_discount_pending = true
-- directly, any number of times -- a repeatable self-granted $5 booking
-- discount. Legit writers today:
--   (a) RoleSelect.tsx sets it true at signup for a referred client (give
--       side of give/get) -- moved to the claim_signup_referral_discount()
--       RPC below.
--   (b) BookSession.tsx / BookingWizard clear it true -> false (and null out
--       referral_discount_trainer_id) after booking -- left untouched.
--   (c) process-referral-reward (service role) sets it true -- left
--       untouched.
--
-- 1. A BEFORE UPDATE trigger blocks non-privileged false->true flips and
--    non-privileged writes to referral_discount_trainer_id other than
--    clearing it to null. true->false transitions are always allowed so
--    BookSession/BookingWizard keep working unmodified. Non-flag profile
--    updates are completely unaffected.
-- 2. A SECURITY DEFINER RPC, claim_signup_referral_discount(), replaces the
--    direct self-write for the signup give-side flow, with guards so it
--    can only fire once per referred, bookings-free user.

BEGIN;

-- ============================================================
-- 1. Lockdown trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_referral_discount_lockdown()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Service role / migrations / triggers running as postgres are exempt.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Only a false -> true flip is blocked; true -> false (the booking-time
  -- clear) is always allowed.
  IF NEW.referral_discount_pending IS DISTINCT FROM OLD.referral_discount_pending
     AND NEW.referral_discount_pending = true THEN
    RAISE EXCEPTION 'referral_discount_pending can only be set to true server-side'
      USING ERRCODE = '42501';
  END IF;

  -- referral_discount_trainer_id may only be cleared to null by a
  -- non-privileged caller; setting it to any value is server-side only.
  IF NEW.referral_discount_trainer_id IS DISTINCT FROM OLD.referral_discount_trainer_id
     AND NEW.referral_discount_trainer_id IS NOT NULL THEN
    RAISE EXCEPTION 'referral_discount_trainer_id can only be set server-side'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_referral_discount_lockdown ON public.profiles;
CREATE TRIGGER trg_enforce_referral_discount_lockdown
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_referral_discount_lockdown();

-- ============================================================
-- 2. claim_signup_referral_discount(): signup give-side RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_signup_referral_discount()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid              uuid;
  v_already_pending  boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_uid) THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.bookings WHERE client_id = v_uid) THEN
    RETURN false;
  END IF;

  SELECT referral_discount_pending INTO v_already_pending
  FROM public.profiles
  WHERE id = v_uid;

  IF v_already_pending IS TRUE THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET referral_discount_pending = true
  WHERE id = v_uid;

  RETURN true;
END;
$$;

ALTER FUNCTION public.claim_signup_referral_discount() OWNER TO postgres;

COMMENT ON FUNCTION public.claim_signup_referral_discount() IS
  'Accepted ceiling: a bookings-free user who self-inserts a referrals row '
  '(referred_id = auth.uid()) can claim one $5 discount once -- the same '
  'value as the legit signup path. What this closes is the repeatable '
  'per-booking self-grant (direct UPDATE profiles.referral_discount_pending), '
  'not that one-time self-referral edge case.';

REVOKE ALL ON FUNCTION public.claim_signup_referral_discount() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_signup_referral_discount() TO authenticated;

COMMIT;
