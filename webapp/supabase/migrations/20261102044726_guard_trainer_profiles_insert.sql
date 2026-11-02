-- Block self-granted privileged columns on trainer_profiles INSERT (2026-11-02).
--
-- Gap: the INSERT RLS policy only checks (select auth.uid()) = user_id. The three
-- BEFORE UPDATE guards (guard_trainer_approval_write, guard_subscription_tier_write
-- and the UPDATE branch of trainer_profiles_rank_and_guard) never fire on INSERT, so
-- any signed-in user without a row could insert their own row already approved,
-- verified, payout-enabled or on a paid tier.
--
-- Fix: a BEFORE INSERT counterpart with the same bypasses as the UPDATE guards
-- (service_role, admin). Everyone else gets a hard RAISE EXCEPTION, not a silent
-- reset, if the new row sets a protected column to anything but its column default.
-- The trigger name sorts before trainer_profiles_sync_specialties and
-- trainer_profiles_zz_rank, so it fires first (BEFORE triggers run in name order)
-- and sees exactly what the client sent.
--
-- The two legitimate client-side inserts still pass: the promote_to_trainer() RPC
-- (inserts approval_status = 'pending' and is_verified = false) and the Flutter
-- ensureTrainerProfileExists fallback (sends only user_id, at most specialty /
-- hourly_rate / optimized_rate / location).
--
-- Policies, other triggers and other tables are untouched. The function is
-- trigger-only, so EXECUTE is revoked from PUBLIC, anon and authenticated, like the
-- other internal guards (20260819070000).

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_trainer_profile_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Service role always bypasses (webhooks, edge functions, scheduled jobs).
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admin bypass.
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Approval, verification, payouts: a new row starts pending, unverified, payouts off.
  IF NEW.approval_status IS DISTINCT FROM 'pending'
     OR COALESCE(NEW.is_verified, false) IS DISTINCT FROM false
     OR NEW.payouts_enabled IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'approval_status, is_verified and payouts_enabled can only be set by an admin or the platform';
  END IF;

  -- Billing: a new row starts on the free tier, inactive, with no Stripe linkage.
  IF NEW.subscription_tier     IS DISTINCT FROM 'free'     OR
     NEW.subscription_status   IS DISTINCT FROM 'inactive' OR
     NEW.subscription_id       IS NOT NULL                 OR
     NEW.stripe_customer_id    IS NOT NULL                 OR
     NEW.trial_ends_at         IS NOT NULL                 OR
     NEW.current_period_end    IS NOT NULL                 OR
     NEW.cancel_at_period_end  IS DISTINCT FROM false      THEN
    RAISE EXCEPTION 'Subscription fields can only be set by the platform';
  END IF;

  -- Credentials: a new row starts with zero verified certs and no verification
  -- timestamp, unless the platform recompute path has flipped the same
  -- app.recompute_credentials switch the UPDATE guard honours.
  IF COALESCE(current_setting('app.recompute_credentials', true), '') <> 'on'
     AND (NEW.verified_cert_count IS DISTINCT FROM 0
          OR NEW.credentials_verified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Credential fields can only be set by the platform';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_trainer_profile_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trainer_profiles_guard_insert ON public.trainer_profiles;
CREATE TRIGGER trainer_profiles_guard_insert
  BEFORE INSERT ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_trainer_profile_insert();

COMMIT;
