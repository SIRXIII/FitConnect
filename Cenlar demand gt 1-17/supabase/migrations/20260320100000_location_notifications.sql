-- Phase 27: Location-Based Notifications
-- client_notification_preferences table, notify_nearby_clients trigger, RLS

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. client_notification_preferences table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.client_notification_preferences (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  notif_enabled       boolean     NOT NULL DEFAULT false,
  area_label          text,
  area_lat            double precision,
  area_lng            double precision,
  notif_radius_miles  int         NOT NULL DEFAULT 5 CHECK (notif_radius_miles >= 1 AND notif_radius_miles <= 10),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- updated_at auto-trigger (reuses existing set_updated_at function)
CREATE TRIGGER set_client_notification_preferences_updated_at
  BEFORE UPDATE ON public.client_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.client_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client manages own notif prefs"
  ON public.client_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. notify_nearby_clients() trigger function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_nearby_clients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_name  text;
  v_rate          numeric;
  v_address       text;
  v_trainer_lat   double precision;
  v_trainer_lng   double precision;
  v_daily_count   int;
  v_trainer_count int;
  pref            RECORD;
BEGIN
  -- Guard: only fire when transitioning to 'live'
  IF NEW.availability_status != 'live' OR OLD.availability_status = 'live' THEN
    RETURN NEW;
  END IF;

  -- Guard: must have an active location set
  IF NEW.active_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch trainer name and rate
  SELECT p.full_name, tp.hourly_rate
  INTO v_trainer_name, v_rate
  FROM public.profiles p
  JOIN public.trainer_profiles tp ON tp.user_id = p.id
  WHERE tp.id = NEW.id;

  -- Fetch active workout location
  SELECT wl.address, wl.latitude, wl.longitude
  INTO v_address, v_trainer_lat, v_trainer_lng
  FROM public.workout_locations wl
  WHERE wl.id = NEW.active_location_id;

  -- Exit if location data not found
  IF v_address IS NULL THEN
    RETURN NEW;
  END IF;

  -- Loop over clients with notifications enabled and location set
  FOR pref IN
    SELECT *
    FROM public.client_notification_preferences
    WHERE notif_enabled = true
      AND area_lat IS NOT NULL
      AND area_lng IS NOT NULL
  LOOP
    -- PostGIS radius check (miles converted to meters: 1 mile = 1609.34 meters)
    IF NOT extensions.ST_DWithin(
      extensions.ST_MakePoint(v_trainer_lng, v_trainer_lat)::extensions.geography,
      extensions.ST_MakePoint(pref.area_lng, pref.area_lat)::extensions.geography,
      pref.notif_radius_miles * 1609.34
    ) THEN
      CONTINUE;
    END IF;

    -- Daily cap: max 3 trainer_live_nearby notifications per client per 24 hours
    SELECT COUNT(*)
    INTO v_daily_count
    FROM public.notifications
    WHERE user_id = pref.user_id
      AND type = 'trainer_live_nearby'
      AND created_at > now() - INTERVAL '24 hours';

    IF v_daily_count >= 3 THEN
      CONTINUE;
    END IF;

    -- Trainer cooldown: max 1 notification per trainer per client per 4 hours
    SELECT COUNT(*)
    INTO v_trainer_count
    FROM public.notifications
    WHERE user_id = pref.user_id
      AND type = 'trainer_live_nearby'
      AND link LIKE '%' || NEW.id || '%'
      AND created_at > now() - INTERVAL '4 hours';

    IF v_trainer_count > 0 THEN
      CONTINUE;
    END IF;

    -- Insert notification
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      pref.user_id,
      'trainer_live_nearby',
      v_trainer_name || ' just went live nearby',
      v_address || ' -- $' || v_rate || '/hr',
      '/search?trainer=' || NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger on trainer_profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TRIGGER trainer_went_live_notify_clients
  AFTER UPDATE ON public.trainer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_nearby_clients();
