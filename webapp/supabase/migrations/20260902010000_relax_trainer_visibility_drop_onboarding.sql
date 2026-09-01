-- Correction to 20260902000000: drop the onboarding_complete requirement from the
-- public trainer-visibility gate.
--
-- Why: profiles.onboarding_complete is only set true by the TrainerOnboarding wizard's
-- final step, which post-dates most trainers. In live data only 1 of 15 approved
-- trainers had it true, while real, actively-booked trainers (e.g. one with 12 bookings
-- and 16 slots) had it false. Gating on it hid almost every approved trainer -- the
-- opposite of the intent. Admin approval is the trust signal we actually control, so the
-- public gate is now: approval_status='approved' AND NOT is_suspended.
--
-- Escape hatches unchanged: own row, admins, and clients who already booked the trainer.

DROP POLICY IF EXISTS trainer_profiles_select_consolidated ON public.trainer_profiles;

CREATE POLICY trainer_profiles_select_consolidated
ON public.trainer_profiles
FOR SELECT
TO public
USING (
  -- Public: approved + not suspended
  (
    approval_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = trainer_profiles.user_id
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
