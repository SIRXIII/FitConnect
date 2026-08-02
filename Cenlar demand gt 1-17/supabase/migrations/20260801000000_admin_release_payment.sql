-- Admin Release Payment + payout hold + dashboard fixes (2026-08-01)
--
-- Live-state notes (project qecwxvvlpvrnrqyrdxrj, verified 2026-08-01):
--   * payout_transactions.initiated_by already allows 'admin' live and
--     initiated_by_admin_id already exists live — not repeated here.
--   * uniq_payout_active_per_trainer partial unique index already exists live.
--   * The live get_admin_payout_balances() summed bookings.trainer_payout with
--     no payout_transaction_id filter, so balances never decreased after a
--     payout. Replaced below with a payments-based, sweep-aware version.

-- 1. Payout hold — real lock consulted by create-payout and weekly-payouts.
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS payout_on_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_hold_reason text,
  ADD COLUMN IF NOT EXISTS payout_hold_set_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS payout_hold_set_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_set_payout_hold(
  p_trainer_profile_id uuid,
  p_hold boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_role text;
  v_admin uuid := auth.uid();
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = v_admin;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.trainer_profiles
  SET payout_on_hold = p_hold,
      payout_hold_reason = CASE WHEN p_hold THEN p_reason ELSE NULL END,
      payout_hold_set_by = v_admin,
      payout_hold_set_at = now()
  WHERE id = p_trainer_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trainer profile not found';
  END IF;

  INSERT INTO public.audit_log (actor_id, action, table_name, record_id, new_values)
  VALUES (
    v_admin,
    CASE WHEN p_hold THEN 'payout_hold_set' ELSE 'payout_hold_cleared' END,
    'trainer_profiles',
    p_trainer_profile_id::text,
    jsonb_build_object('payout_on_hold', p_hold, 'reason', p_reason)
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.admin_set_payout_hold(uuid, boolean, text) TO authenticated;

-- 2. Sweep-aware admin payout balances with releasable vs not-yet-completed
--    split. Eligibility gate: bookings.status = 'completed' releasable;
--    pending/confirmed shown as "not yet completed"; cancelled/no_show never
--    counted (matches the CANCEL-1/PAYOUT-2 exclusion in the edge functions).
--    pending_balance / unpaid_booking_count keys retained for back-compat.
CREATE OR REPLACE FUNCTION public.get_admin_payout_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    FROM (
      SELECT
        tp.id AS trainer_profile_id,
        tp.user_id AS trainer_user_id,
        pr.full_name AS trainer_name,
        tp.stripe_account_id,
        tp.payout_on_hold,
        tp.payout_hold_reason,
        COALESCE(SUM(pay.trainer_payout) FILTER (WHERE b.status = 'completed'), 0)::numeric AS releasable_balance,
        COALESCE(SUM(pay.trainer_payout) FILTER (WHERE b.status NOT IN ('completed', 'cancelled', 'no_show')), 0)::numeric AS not_yet_completed_balance,
        COUNT(pay.id) FILTER (WHERE b.status = 'completed')::int AS releasable_booking_count,
        COUNT(pay.id) FILTER (WHERE b.status NOT IN ('completed', 'cancelled', 'no_show'))::int AS not_yet_completed_booking_count,
        COALESCE(SUM(pay.trainer_payout) FILTER (WHERE b.status NOT IN ('cancelled', 'no_show')), 0)::numeric AS pending_balance,
        COUNT(pay.id) FILTER (WHERE b.status NOT IN ('cancelled', 'no_show'))::int AS unpaid_booking_count
      FROM public.trainer_profiles tp
      JOIN public.profiles pr ON pr.id = tp.user_id
      LEFT JOIN public.bookings b ON b.trainer_id = tp.id
      LEFT JOIN public.payments pay ON pay.booking_id = b.id
        AND pay.status = 'succeeded'
        AND pay.payout_transaction_id IS NULL
      GROUP BY tp.id, tp.user_id, pr.full_name, tp.stripe_account_id, tp.payout_on_hold, tp.payout_hold_reason
      ORDER BY releasable_balance DESC
    ) r
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_admin_payout_balances() TO authenticated;

-- 3. Users tab avatars.
CREATE OR REPLACE FUNCTION public.get_admin_user_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    FROM (
      SELECT
        p.id, p.full_name, p.role, p.is_suspended, p.created_at,
        p.avatar_url,
        u.email, u.last_sign_in_at,
        tp.subscription_tier, tp.subscription_status,
        tp.tier_overridden_by, tp.tier_overridden_at
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      LEFT JOIN public.trainer_profiles tp ON tp.user_id = p.id
      WHERE p.role IN ('trainer', 'client', 'admin')
      ORDER BY p.created_at DESC
    ) r
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_list() TO authenticated;

-- 4. Admin-initiated support tickets (admin chat with trainers).
DROP POLICY IF EXISTS "Admin create tickets" ON public.support_tickets;
CREATE POLICY "Admin create tickets" ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role
    )
  );

-- 5. Arm the weekly payout cron. The 20260314210000 migration documented the
--    vault secrets as a manual step that was never completed live: the
--    'project_url' secret and the cron job itself were both missing, so
--    weekly auto-payouts have never run.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_url') THEN
    PERFORM vault.create_secret('https://qecwxvvlpvrnrqyrdxrj.supabase.co', 'project_url');
  END IF;
END;
$do$;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-trainer-payouts') THEN
    PERFORM cron.schedule(
      'weekly-trainer-payouts',
      '0 9 * * 1',
      $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/weekly-payouts',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END;
$do$;

NOTIFY pgrst, 'reload schema';
