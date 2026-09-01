-- Gate public trainer visibility on admin approval + completed onboarding.
--
-- Root cause: the trainer_profiles SELECT policy was USING (true), so every row
-- (including approval_status='pending' and onboarding-incomplete placeholder rows)
-- was world-readable. promote_to_trainer() creates every trainer as 'pending', but
-- no public surface read approval_status, so trainers appeared the instant they
-- picked the "trainer" role -- before onboarding and before any admin approval.
--
-- New rule for the public: a trainer row is visible only when
--   approval_status = 'approved' AND profiles.onboarding_complete AND NOT is_suspended.
-- Escape hatches preserve non-public reads:
--   * the trainer's own row (any status),
--   * admins doing direct reads (admin dashboards mostly use SECURITY DEFINER RPCs,
--     which bypass RLS anyway),
--   * any client who already booked the trainer, so bookings/history/receipts keep
--     resolving the trainer's name even if the trainer later goes pending/suspended.
--
-- The map RPC trainers_in_view runs SECURITY INVOKER, so this policy already gates it;
-- a companion migration also states the predicate there explicitly.

DROP POLICY IF EXISTS trainer_profiles_select_consolidated ON public.trainer_profiles;

CREATE POLICY trainer_profiles_select_consolidated
ON public.trainer_profiles
FOR SELECT
TO public
USING (
  -- Public: approved + onboarded + not suspended
  (
    approval_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = trainer_profiles.user_id
        AND p.onboarding_complete
        AND NOT p.is_suspended
    )
  )
  -- Trainer sees their own row (any status)
  OR user_id = (SELECT auth.uid())
  -- Admin direct reads
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
  )
  -- Client who already booked this trainer keeps seeing them (history/receipts)
  OR EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.trainer_id = trainer_profiles.id
      AND b.client_id = (SELECT auth.uid())
  )
);
