-- Phase 22: Availability Toggle Foundation
-- Adds availability toggle state to trainer_profiles, booking_requests table,
-- atomic booking RPC, stale session expiry function, and pg_cron scheduling.

-- ============================================================
-- 1. trainer_profiles — 4 new columns
-- ============================================================

ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'offline'
    CHECK (availability_status IN ('offline', 'live')),
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'instant'
    CHECK (booking_mode IN ('instant', 'request')),
  ADD COLUMN IF NOT EXISTS sleep_timer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS availability_session_started_at timestamptz;

-- ============================================================
-- 2. booking_requests table
-- ============================================================

CREATE TABLE public.booking_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id     uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  client_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_id        uuid NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined')),
  decline_reason text,
  declined_at    timestamptz,
  accepted_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer can manage their requests"
  ON public.booking_requests
  FOR ALL
  USING (trainer_id IN (
    SELECT id FROM trainer_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "client can view their own requests"
  ON public.booking_requests
  FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "client can insert requests"
  ON public.booking_requests
  FOR INSERT
  WITH CHECK (client_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_requests;

-- Ensure availability_slots is published for Realtime slot greying
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'availability_slots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_slots;
  END IF;
END $$;

-- ============================================================
-- 3. create_booking_atomic RPC
-- ============================================================

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
  v_booking_id uuid;
BEGIN
  SELECT * INTO v_slot
  FROM availability_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'slot_not_found');
  END IF;

  IF v_slot.is_booked THEN
    RETURN json_build_object('error', 'slot_taken');
  END IF;

  IF v_slot.deleted_at IS NOT NULL THEN
    RETURN json_build_object('error', 'slot_deleted');
  END IF;

  UPDATE availability_slots
  SET is_booked = true, updated_at = now()
  WHERE id = p_slot_id;

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

-- ============================================================
-- 4. expire_stale_availability function
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_stale_availability()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE trainer_profiles
  SET
    availability_status = 'offline',
    sleep_timer_expires_at = NULL,
    availability_session_started_at = NULL
  WHERE
    availability_status = 'live'
    AND (
      (sleep_timer_expires_at IS NOT NULL AND sleep_timer_expires_at < now())
      OR
      (availability_session_started_at IS NOT NULL
        AND availability_session_started_at < now() - INTERVAL '12 hours')
    );

  UPDATE booking_requests br
  SET status = 'declined', declined_at = now(), decline_reason = 'trainer_went_offline'
  FROM trainer_profiles tp
  WHERE br.trainer_id = tp.id
    AND tp.availability_status = 'offline'
    AND br.status = 'pending';

  UPDATE booking_requests
  SET status = 'declined', declined_at = now(), decline_reason = 'auto_timeout'
  WHERE status = 'pending'
    AND created_at < now() - INTERVAL '30 minutes';
END;
$$;

-- ============================================================
-- 5. pg_cron scheduling (graceful fallback if not available)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-stale-availability',
      '*/5 * * * *',
      $cron$ SELECT public.expire_stale_availability(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available — schedule expire_stale_availability manually or via Edge Function';
  END IF;
END $$;

-- ============================================================
-- 6. Ensure trainer_profiles Realtime publication (for live status broadcast)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trainer_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trainer_profiles;
  END IF;
END $$;
