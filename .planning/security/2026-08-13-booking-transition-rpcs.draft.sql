-- ============================================================================
-- DRAFT — NOT A MIGRATION YET. Guarded booking-transition RPCs that replace the
-- webapp's direct bookings.status writes once the column-lockdown lands.
-- Verified by webapp/supabase/tests/security/booking-fraud.test.ts.
-- ============================================================================
--
-- After 2026-08-13-bookings-status-money-lockdown.draft.sql revokes UPDATE on
-- bookings.status, the webapp trainer transitions must go through server-side
-- guards instead of `supabase.from('bookings').update({status})`. These two RPCs
-- are SECURITY DEFINER (so they can write status after the REVOKE) but each
-- verifies the caller is the booking's trainer and enforces the allowed
-- transition. Completion still goes through the complete-booking edge fn; the
-- CONFIRMED-booking cancel (paid -> needs a Stripe refund) still needs a
-- trainer-cancel EDGE fn (money-path, separate) — NOT covered here.

-- confirmed -> no_show, by the booking's trainer only.
CREATE OR REPLACE FUNCTION public.mark_booking_no_show(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_profile_id uuid;
  v_status text;
  v_booking_trainer uuid;
BEGIN
  SELECT id INTO v_trainer_profile_id
    FROM trainer_profiles WHERE user_id = auth.uid();
  IF v_trainer_profile_id IS NULL THEN
    RAISE EXCEPTION 'not a trainer' USING ERRCODE = '42501';
  END IF;

  SELECT status, trainer_id INTO v_status, v_booking_trainer
    FROM bookings WHERE id = p_booking_id;
  IF v_booking_trainer IS NULL OR v_booking_trainer <> v_trainer_profile_id THEN
    RAISE EXCEPTION 'not your booking' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'confirmed' THEN
    RAISE EXCEPTION 'only a confirmed booking can be marked no_show (was %)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE bookings
     SET status = 'no_show', updated_at = now()
   WHERE id = p_booking_id AND status = 'confirmed';
END;
$$;

-- pending -> cancelled (trainer declines an unpaid request; no refund needed).
CREATE OR REPLACE FUNCTION public.decline_pending_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_profile_id uuid;
  v_status text;
  v_booking_trainer uuid;
BEGIN
  SELECT id INTO v_trainer_profile_id
    FROM trainer_profiles WHERE user_id = auth.uid();
  IF v_trainer_profile_id IS NULL THEN
    RAISE EXCEPTION 'not a trainer' USING ERRCODE = '42501';
  END IF;

  SELECT status, trainer_id INTO v_status, v_booking_trainer
    FROM bookings WHERE id = p_booking_id;
  IF v_booking_trainer IS NULL OR v_booking_trainer <> v_trainer_profile_id THEN
    RAISE EXCEPTION 'not your booking' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'only a pending booking can be declined (was %)', v_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE bookings
     SET status = 'cancelled',
         cancellation_reason = 'Declined by trainer',
         cancelled_by = auth.uid(),
         updated_at = now()
   WHERE id = p_booking_id AND status = 'pending';
END;
$$;

-- SECURITY DEFINER in public is callable by PUBLIC by default — restrict to
-- authenticated (each function checks the caller is the booking's trainer).
REVOKE ALL ON FUNCTION public.mark_booking_no_show(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_pending_booking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_booking_no_show(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_pending_booking(uuid) TO authenticated;
