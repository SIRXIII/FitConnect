-- Fix web booking gate: check trainer visibility (approved, not suspended)
-- instead of availability_status = 'live'.
--
-- WHY: availability_status = 'live' is an "on duty now" broadcast flag that a
-- cron job expires every minute, so it was almost never true for a slot at
-- the time a client actually booked it. Gating _create_booking on that flag
-- meant every web booking failed with "Trainer is no longer available"
-- regardless of whether the trainer or the slot were valid. The replacement
-- check reuses the same trainer-bookable rule already used for public
-- trainer visibility (trainer_profiles.approval_status = 'approved' and
-- profiles.is_suspended is not true), and runs before the slot is marked
-- booked so a rejected booking never touches availability_slots.
--
-- Based on the LIVE definition of public._create_booking (pg_get_functiondef
-- against prod qecwxvvlpvrnrqyrdxrj, 2026-09-11). The create_booking_atomic
-- and accept_booking_request wrapper functions are unchanged; they both call
-- _create_booking internally and inherit this fix without modification.

CREATE OR REPLACE FUNCTION public._create_booking(p_slot_id uuid, p_client_id uuid, p_trainer_id uuid, p_notes text, p_apply_referral boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_slot          availability_slots;
  v_booking_count integer;
  v_booking_id    uuid;
  v_q             record;
BEGIN
  SELECT * INTO v_slot
  FROM availability_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'slot_not_found');
  END IF;

  IF v_slot.deleted_at IS NOT NULL THEN
    RETURN json_build_object('error', 'slot_deleted');
  END IF;

  IF v_slot.is_gcal_blocked THEN
    RETURN json_build_object('error', 'slot_gcal_blocked');
  END IF;

  IF v_slot.trainer_id <> p_trainer_id THEN
    RAISE EXCEPTION 'p_trainer_id does not own p_slot_id' USING ERRCODE = '42501';
  END IF;

  -- The trainer must be bookable at all (same rule as public trainer visibility).
  -- The old gate required availability_status = 'live', an on-duty broadcast that a
  -- cron expires every minute, so no future slot could ever be booked from the web.
  IF NOT EXISTS (
    SELECT 1
    FROM trainer_profiles tp
    JOIN profiles p ON p.id = tp.user_id
    WHERE tp.id = p_trainer_id
      AND tp.approval_status = 'approved'
      AND NOT COALESCE(p.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'This trainer is not accepting bookings right now' USING ERRCODE = 'P0001';
  END IF;

  IF v_slot.slot_type = 'group' THEN
    SELECT COUNT(*)::integer INTO v_booking_count
    FROM bookings
    WHERE slot_id = p_slot_id
      AND status IN ('confirmed', 'pending');

    IF v_booking_count >= v_slot.max_capacity THEN
      RETURN json_build_object('error', 'slot_taken');
    END IF;
  ELSE
    IF v_slot.is_booked THEN
      RETURN json_build_object('error', 'slot_taken');
    END IF;

    UPDATE availability_slots
    SET is_booked = true, updated_at = now()
    WHERE id = p_slot_id;
  END IF;

  SELECT * INTO v_q
  FROM public.quote_booking_price(p_slot_id, p_client_id, p_apply_referral);

  IF v_q.referral_discount > 0 THEN
    UPDATE public.profiles
    SET referral_discount_pending = false,
        referral_discount_trainer_id = NULL
    WHERE id = p_client_id;
  END IF;

  INSERT INTO bookings (
    client_id, trainer_id, slot_id, status,
    rate_charged, platform_fee, trainer_payout, notes,
    is_comp, is_intro
  )
  VALUES (
    p_client_id, p_trainer_id, p_slot_id,
    (CASE WHEN v_slot.is_intro THEN 'confirmed' ELSE 'pending' END)::booking_status,
    v_q.rate_charged, v_q.platform_fee, v_q.trainer_payout,
    COALESCE(p_notes, CASE WHEN v_slot.is_intro THEN 'Complimentary intro session' ELSE NULL END),
    v_slot.is_intro, v_slot.is_intro
  )
  RETURNING id INTO v_booking_id;

  RETURN json_build_object(
    'booking_id',     v_booking_id,
    'rate_charged',   v_q.rate_charged,
    'platform_fee',   v_q.platform_fee,
    'total',          v_q.total,
    'trainer_payout', v_q.trainer_payout
  );
END;
$function$;
