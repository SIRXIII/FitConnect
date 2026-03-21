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
