-- Fix 42P17 "infinite recursion detected in policy for relation trainer_profiles"
-- (introduced by 20260902010000). The trainer_profiles SELECT policy subqueried
-- public.bookings; bookings_select_consolidated subqueries trainer_profiles, so RLS
-- recursed for role authenticated (anon has no bookings policy, so it never recursed).
-- Every logged-in client and trainer was blocked from reading trainer_profiles
-- (dashboard, bookings, slots, discover embeds, trainers_in_view map RPC).
--
-- Fix: evaluate "client already booked this trainer" via a SECURITY DEFINER predicate
-- that bypasses bookings RLS. Same visibility semantics, no cycle. Not inlinable
-- (SECURITY DEFINER + SET), so the planner cannot re-introduce the bookings policy.

BEGIN;

CREATE OR REPLACE FUNCTION public.client_has_booking_with_trainer(p_trainer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.trainer_id = p_trainer_id
      AND b.client_id = (SELECT auth.uid())
  );
$$;

-- EXECUTE is checked at parse time for every role that evaluates the policy;
-- anon must be granted or every anon SELECT on trainer_profiles errors.
REVOKE ALL ON FUNCTION public.client_has_booking_with_trainer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_has_booking_with_trainer(uuid) TO anon, authenticated, service_role;

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
  OR public.client_has_booking_with_trainer(trainer_profiles.id)
);

COMMIT;

NOTIFY pgrst, 'reload schema';
