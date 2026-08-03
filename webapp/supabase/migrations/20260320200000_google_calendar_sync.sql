-- Phase 28: Google Calendar Bidirectional Sync — Foundation
-- Creates google_calendar_connections, gcal_blocked_slots tables,
-- adds gcal_event_id to bookings, is_gcal_blocked to availability_slots,
-- apply_gcal_blocks RPC, updates get_visible_slots, schedules pg_cron polling.

-- ============================================================
-- Section 1: google_calendar_connections table
-- ============================================================

CREATE TABLE public.google_calendar_connections (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id           uuid        NOT NULL UNIQUE REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
  access_token         text        NOT NULL,
  refresh_token        text        NOT NULL,
  expires_at           timestamptz NOT NULL,
  is_active            boolean     NOT NULL DEFAULT true,
  disconnected_reason  text,
  connected_at         timestamptz NOT NULL DEFAULT now(),
  last_sync_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer can manage own gcal connection"
  ON public.google_calendar_connections
  FOR ALL
  USING (
    trainer_id IN (
      SELECT id FROM public.trainer_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service_role full access to gcal connections"
  ON public.google_calendar_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Section 2: gcal_blocked_slots table
-- ============================================================

CREATE TABLE public.gcal_blocked_slots (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id     uuid        NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
  gcal_event_id  text        NOT NULL,
  gcal_summary   text,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, gcal_event_id)
);

ALTER TABLE public.gcal_blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer can view own gcal blocks"
  ON public.gcal_blocked_slots
  FOR SELECT
  USING (
    trainer_id IN (
      SELECT id FROM public.trainer_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service_role full access to gcal blocked slots"
  ON public.gcal_blocked_slots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Section 3: bookings.gcal_event_id column
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS gcal_event_id text;

-- ============================================================
-- Section 4: availability_slots.is_gcal_blocked column
-- ============================================================

ALTER TABLE public.availability_slots
  ADD COLUMN IF NOT EXISTS is_gcal_blocked boolean NOT NULL DEFAULT false;

-- ============================================================
-- Section 5: apply_gcal_blocks RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_gcal_blocks(p_trainer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark slots as blocked where a GCal event overlaps (and slot not already booked)
  UPDATE public.availability_slots s
  SET is_gcal_blocked = true,
      updated_at = now()
  FROM public.gcal_blocked_slots b
  WHERE s.trainer_id = p_trainer_id
    AND b.trainer_id = p_trainer_id
    AND NOT s.is_booked
    AND tstzrange(s.start_time, s.end_time) && tstzrange(b.starts_at, b.ends_at);

  -- Unmark slots that are blocked but no longer have an overlapping GCal event
  UPDATE public.availability_slots s
  SET is_gcal_blocked = false,
      updated_at = now()
  WHERE s.trainer_id = p_trainer_id
    AND s.is_gcal_blocked = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.gcal_blocked_slots b
      WHERE b.trainer_id = p_trainer_id
        AND tstzrange(s.start_time, s.end_time) && tstzrange(b.starts_at, b.ends_at)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_gcal_blocks(uuid) TO authenticated;

-- ============================================================
-- Section 6: Update get_visible_slots to filter is_gcal_blocked
-- ============================================================
-- Preserves: SECURITY DEFINER, STABLE, tier-based LIMIT, deleted_at IS NULL,
-- is_booked = false, start_time > now(), buffer window. Adds is_gcal_blocked = false.

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
    WHERE  s.trainer_id      = p_trainer_id
      AND  s.is_booked       = false
      AND  s.deleted_at      IS NULL
      AND  s.start_time      > now()
      AND  s.is_gcal_blocked = false
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

-- ============================================================
-- Section 7: pg_cron for sync-gcal-events (graceful fallback)
-- ============================================================
-- Schedules a polling job every 15 minutes to pull GCal events for all
-- connected trainers. Falls back gracefully if pg_cron or pg_net not available.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule(
      'sync-gcal-events-poll',
      '*/15 * * * *',
      $cron$
        SELECT net.http_post(
          url    := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/sync-gcal-events',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1)
          ),
          body   := '{}'::jsonb
        );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron or pg_net not available — schedule sync-gcal-events manually or via Supabase Edge Function cron trigger';
  END IF;
END $$;
