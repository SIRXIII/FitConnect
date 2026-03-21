-- Additive migration: add group session fields to availability_slots
-- No breaking changes — all new columns are nullable or have defaults

ALTER TABLE availability_slots
  ADD COLUMN IF NOT EXISTS slot_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (slot_type IN ('individual', 'group')),
  ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT NULL
    CHECK (max_capacity IS NULL OR (max_capacity >= 2 AND max_capacity <= 10)),
  ADD COLUMN IF NOT EXISTS group_rate NUMERIC(10,2) DEFAULT NULL;

-- Add constraint: group slots must have max_capacity and group_rate
ALTER TABLE availability_slots
  ADD CONSTRAINT group_slot_requires_capacity
    CHECK (slot_type != 'group' OR (max_capacity IS NOT NULL AND group_rate IS NOT NULL));

-- Helper RPC: get confirmed booking count for a slot
CREATE OR REPLACE FUNCTION get_slot_booking_count(p_slot_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM bookings
  WHERE slot_id = p_slot_id
    AND status IN ('confirmed', 'pending');
$$;

-- Helper RPC: check if a group slot has open capacity
CREATE OR REPLACE FUNCTION is_group_slot_available(p_slot_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    s.slot_type = 'group' AND
    s.is_available = true AND
    get_slot_booking_count(p_slot_id) < s.max_capacity
  FROM availability_slots s
  WHERE s.id = p_slot_id;
$$;

COMMENT ON COLUMN availability_slots.slot_type IS 'individual (default) or group';
COMMENT ON COLUMN availability_slots.max_capacity IS 'Group slots only: 2-10 participants';
COMMENT ON COLUMN availability_slots.group_rate IS 'Group slots only: per-person price';

-- Update create_booking_atomic to support group slots
-- Group slots: allow multiple bookings up to max_capacity, do NOT flip is_booked
-- Individual slots: existing logic unchanged (is_booked check + flip)
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_slot_id        uuid,
  p_client_id      uuid,
  p_trainer_id     uuid,
  p_rate_charged   numeric,
  p_platform_fee   numeric,
  p_trainer_payout numeric,
  p_notes          text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot availability_slots;
  v_booking_count integer;
  v_booking_id uuid;
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

  IF v_slot.slot_type = 'group' THEN
    -- Group slot: check capacity instead of is_booked flag
    SELECT COUNT(*)::integer INTO v_booking_count
    FROM bookings
    WHERE slot_id = p_slot_id
      AND status IN ('confirmed', 'pending');

    IF v_booking_count >= v_slot.max_capacity THEN
      RETURN json_build_object('error', 'slot_taken');
    END IF;
    -- Group slots keep is_booked = false (managed by trigger when truly full)
  ELSE
    -- Individual slot: original behaviour
    IF v_slot.is_booked THEN
      RETURN json_build_object('error', 'slot_taken');
    END IF;

    UPDATE availability_slots
    SET is_booked = true, updated_at = now()
    WHERE id = p_slot_id;
  END IF;

  INSERT INTO bookings (
    client_id, trainer_id, slot_id, status,
    rate_charged, platform_fee, trainer_payout, notes
  )
  VALUES (
    p_client_id, p_trainer_id, p_slot_id, 'pending',
    p_rate_charged, p_platform_fee, p_trainer_payout, p_notes
  )
  RETURNING id INTO v_booking_id;

  RETURN json_build_object('booking_id', v_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic(uuid, uuid, uuid, numeric, numeric, numeric, text) TO authenticated;
