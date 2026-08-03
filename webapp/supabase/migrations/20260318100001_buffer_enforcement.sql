-- Phase 19: Buffer time enforcement for booking trigger and visible slots RPC
-- Updates lock_and_mark_slot_on_booking_insert() to reject bookings that violate
-- the trainer's buffer_minutes setting between sessions.
-- Updates get_visible_slots() to hide slots within the buffer window of active bookings.

-- ============================================================
-- Section 1: Replace lock_and_mark_slot_on_booking_insert()
-- ============================================================
-- Preserves ALL existing checks (pending status, slot exists, trainer match,
-- not past, not already booked) and adds buffer enforcement AFTER existing
-- checks, BEFORE the UPDATE.

CREATE OR REPLACE FUNCTION public.lock_and_mark_slot_on_booking_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked_slot public.availability_slots%rowtype;
  v_buffer    interval;
  v_conflict_count int;
BEGIN
  -- Existing check: must be pending
  IF NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'New bookings must be created in pending status';
  END IF;

  -- Existing check: lock and fetch slot
  SELECT *
    INTO locked_slot
  FROM public.availability_slots
  WHERE id = NEW.slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected slot does not exist';
  END IF;

  -- Existing check: trainer must match
  IF locked_slot.trainer_id <> NEW.trainer_id THEN
    RAISE EXCEPTION 'Booking trainer_id does not match slot trainer owner';
  END IF;

  -- Existing check: not in the past
  IF locked_slot.start_time < now() THEN
    RAISE EXCEPTION 'Cannot book a past slot';
  END IF;

  -- Existing check: not already booked
  IF locked_slot.is_booked THEN
    RAISE EXCEPTION 'Slot is already booked';
  END IF;

  -- NEW: Buffer time enforcement
  SELECT COALESCE(tp.buffer_minutes, 0) * interval '1 minute'
  INTO v_buffer
  FROM public.trainer_profiles tp
  WHERE tp.id = locked_slot.trainer_id;

  IF v_buffer > interval '0' THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
    WHERE b.trainer_id = NEW.trainer_id
      AND b.status IN ('pending', 'confirmed')
      AND b.id IS DISTINCT FROM NEW.id
      AND (
        locked_slot.start_time < s.end_time + v_buffer
        AND locked_slot.end_time > s.start_time - v_buffer
      );

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'This slot conflicts with buffer time between sessions. The trainer requires % minutes between bookings.',
        EXTRACT(EPOCH FROM v_buffer) / 60;
    END IF;
  END IF;

  -- Existing: mark slot as booked
  UPDATE public.availability_slots
  SET is_booked = true,
      updated_at = now()
  WHERE id = locked_slot.id;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Section 2: Replace get_visible_slots() with buffer awareness
-- ============================================================
-- Preserves: SECURITY DEFINER, STABLE, tier-based LIMIT, deleted_at IS NULL,
-- is_booked = false, start_time > now(). Adds NOT EXISTS subquery to exclude
-- slots within buffer window of active bookings.

CREATE OR REPLACE FUNCTION public.get_visible_slots(p_trainer_id uuid)
RETURNS SETOF public.availability_slots
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tier   text;
  v_limit  int;
  v_buffer interval;
BEGIN
  SELECT subscription_tier,
         COALESCE(buffer_minutes, 0) * interval '1 minute'
  INTO   v_tier, v_buffer
  FROM   public.trainer_profiles
  WHERE  id = p_trainer_id;

  v_limit := CASE v_tier
    WHEN 'elite' THEN 2147483647
    WHEN 'pro'   THEN 10
    ELSE              3
  END;

  RETURN QUERY
    SELECT s.*
    FROM   public.availability_slots s
    WHERE  s.trainer_id  = p_trainer_id
      AND  s.is_booked   = false
      AND  s.deleted_at  IS NULL
      AND  s.start_time  > now()
      AND  (v_buffer = interval '0' OR NOT EXISTS (
        SELECT 1
        FROM public.bookings b
        JOIN public.availability_slots bs ON bs.id = b.slot_id
        WHERE b.trainer_id = p_trainer_id
          AND b.status IN ('pending', 'confirmed')
          AND (
            s.start_time < bs.end_time + v_buffer
            AND s.end_time > bs.start_time - v_buffer
          )
      ))
    ORDER  BY s.start_time
    LIMIT  v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_slots(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_visible_slots(uuid) TO authenticated;
