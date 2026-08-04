-- Migration: Admin Dashboard Live Data
-- Phase 33 Plan 01 — Admin Dashboard Live Data
-- Adds admin RLS policies on payout_transactions, held status, and SECURITY DEFINER RPCs
-- for admin user list and payout balance aggregation.

-- ============================================================
-- 1. Admin RLS policies on payout_transactions
-- ============================================================

CREATE POLICY "Admins can view all payout transactions"
  ON public.payout_transactions
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can insert payout transactions"
  ON public.payout_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update payout transactions"
  ON public.payout_transactions
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ============================================================
-- 2. Add 'held' status to payout_transactions check constraint
-- ============================================================

ALTER TABLE public.payout_transactions
  DROP CONSTRAINT IF EXISTS payout_transactions_status_check;

ALTER TABLE public.payout_transactions
  ADD CONSTRAINT payout_transactions_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'held'));

-- ============================================================
-- 3. get_admin_user_list() SECURITY DEFINER RPC
-- Returns all users with email + last_sign_in_at from auth.users
-- and subscription info from trainer_profiles.
-- SECURITY DEFINER: bypasses RLS — admin role guard is mandatory.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_user_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    FROM (
      SELECT
        p.id, p.full_name, p.role, p.is_suspended, p.created_at,
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
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_list() TO authenticated;

-- ============================================================
-- 4. get_admin_payout_balances() SECURITY DEFINER RPC
-- Returns aggregated pending payout balance per trainer:
-- sum of trainer_payout from succeeded payments not yet swept
-- into a payout transaction (payout_transaction_id IS NULL).
-- SECURITY DEFINER: bypasses RLS — admin role guard is mandatory.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_payout_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
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
        COALESCE(SUM(pay.trainer_payout), 0)::numeric AS pending_balance,
        COUNT(pay.id)::int AS unpaid_booking_count
      FROM public.trainer_profiles tp
      JOIN public.profiles pr ON pr.id = tp.user_id
      LEFT JOIN public.bookings b ON b.trainer_id = tp.id
      LEFT JOIN public.payments pay ON pay.booking_id = b.id
        AND pay.status = 'succeeded'
        AND pay.payout_transaction_id IS NULL
      GROUP BY tp.id, tp.user_id, pr.full_name, tp.stripe_account_id
      ORDER BY pending_balance DESC
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_payout_balances() TO authenticated;

-- ============================================================
-- 5. Notify PostgREST to reload schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';
