-- Phase 3: Soft-delete for availability slots (REQ-SEC-08)
-- Preserves slot records for booking history references.

ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Index: efficient queries filtering out soft-deleted slots
CREATE INDEX IF NOT EXISTS idx_slots_not_deleted
  ON public.availability_slots(trainer_id, start_time)
  WHERE deleted_at IS NULL;

-- Update RLS select policy to exclude soft-deleted slots from all views.
-- Booked slots that were soft-deleted are still accessible via booking join (client can still
-- see their booking details), but the slot itself becomes invisible in availability grids.
DROP POLICY IF EXISTS availability_select_public_or_owner ON public.availability_slots;
CREATE POLICY availability_select_public_or_owner
ON public.availability_slots
FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    is_booked = false
    OR trainer_id IN (
      SELECT tp.id FROM public.trainer_profiles tp WHERE tp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.slot_id = availability_slots.id
        AND b.client_id = auth.uid()
    )
  )
);

-- Prevent inserting soft-deleted slots
DROP POLICY IF EXISTS availability_insert_owner ON public.availability_slots;
CREATE POLICY availability_insert_owner
ON public.availability_slots
FOR INSERT
WITH CHECK (
  deleted_at IS NULL
  AND trainer_id IN (
    SELECT tp.id FROM public.trainer_profiles tp WHERE tp.user_id = auth.uid()
  )
);

-- Allow trainer to soft-delete their own unbooked slots (update deleted_at)
DROP POLICY IF EXISTS availability_update_owner ON public.availability_slots;
CREATE POLICY availability_update_owner
ON public.availability_slots
FOR UPDATE
USING (
  trainer_id IN (
    SELECT tp.id FROM public.trainer_profiles tp WHERE tp.user_id = auth.uid()
  )
)
WITH CHECK (
  trainer_id IN (
    SELECT tp.id FROM public.trainer_profiles tp WHERE tp.user_id = auth.uid()
  )
);

-- Also update the booking insert trigger to skip soft-deleted slots
CREATE OR REPLACE FUNCTION public.lock_and_mark_slot_on_booking_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked_slot public.availability_slots%rowtype;
BEGIN
  IF new.status <> 'pending' THEN
    RAISE EXCEPTION 'New bookings must be created in pending status';
  END IF;

  SELECT *
    INTO locked_slot
  FROM public.availability_slots
  WHERE id = new.slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected slot does not exist';
  END IF;

  IF locked_slot.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Selected slot has been removed';
  END IF;

  IF locked_slot.trainer_id <> new.trainer_id THEN
    RAISE EXCEPTION 'Booking trainer_id does not match slot trainer owner';
  END IF;

  IF locked_slot.start_time < now() THEN
    RAISE EXCEPTION 'Cannot book a past slot';
  END IF;

  IF locked_slot.is_booked THEN
    RAISE EXCEPTION 'Slot is already booked';
  END IF;

  UPDATE public.availability_slots
  SET is_booked = true,
      updated_at = now()
  WHERE id = locked_slot.id;

  RETURN new;
END;
$$;
