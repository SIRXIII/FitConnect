-- ============================================================================
-- DRAFT — NOT A MIGRATION YET. Kept out of supabase/migrations/ so it cannot
-- auto-apply. Verified by the adversarial DB harness
-- (webapp/supabase/tests/security/booking-fraud.test.ts) turning RED -> GREEN.
-- ============================================================================
--
-- PROBLEM (verified in the harness): `authenticated` holds UPDATE on all ~19
-- columns of public.bookings. The RLS UPDATE policy is correct (ownership,
-- USING + WITH CHECK) but the COLUMN grant is not, so a trainer can:
--   * self-confirm a pending booking (status -> 'confirmed') WITHOUT payment,
--   * self-complete it (status -> 'completed'),
--   * edit money columns (rate_charged / platform_fee / trainer_payout).
-- Confirming a booking is what makes the three server completion paths
-- (complete-booking, auto_complete_past_bookings cron, comp trigger) mint a
-- succeeded payment, so a self-confirmed booking becomes a payout. This is the
-- linchpin the whole lockdown turns on.
--
-- FIX: revoke blanket UPDATE; re-grant ONLY the column a client legitimately
-- edits directly (notes). Everything else (status, money, cancellation,
-- stripe/is_comp) moves server-side:
--   confirmed -> Stripe webhook ONLY (payment == confirmation)
--   completed -> complete-booking edge fn
--   cancelled -> cancel-booking (client) / a trainer-cancel path
--   no_show   -> a guarded RPC
-- Does NOT affect the Flutter client (it never writes bookings.status directly).
--
-- PREREQUISITE BEFORE PROD-APPLY: reroute the WEBAPP TrainerBookings.tsx
-- transitions (currently direct .update()) through the edge fns / RPCs above,
-- and remove the trainer "Confirm" button — otherwise the webapp trainer flow
-- 403s after this lands. The DB lock is proven independent of that reroute.

BEGIN;

REVOKE UPDATE ON public.bookings FROM authenticated;
REVOKE UPDATE ON public.bookings FROM anon;

-- Only column a client edits directly. (If a new client-editable booking field
-- ships later, add it here or that save silently 403s.)
GRANT UPDATE (notes) ON public.bookings TO authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- ROLLBACK (restores the vulnerable state):
--   BEGIN; GRANT UPDATE ON public.bookings TO authenticated; COMMIT;
-- ---------------------------------------------------------------------------
-- SMOKE TEST after apply (run as a real logged-in trainer):
--   1. Mark a session complete via the app  -> must go through complete-booking
--   2. Cancel a booking                     -> must go through cancel path
--   3. Browser console, as that trainer:
--        update bookings set status='confirmed' where id='<own booking>';  -> DENIED
--        update bookings set trainer_payout=9999 where id='<own booking>'; -> DENIED
