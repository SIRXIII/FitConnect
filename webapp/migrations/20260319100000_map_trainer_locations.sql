-- Phase 23: Map View + Trainer Locations
-- PostGIS extension, workout_locations table, trainers_in_view RPC

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Create workout_locations table
CREATE TABLE public.workout_locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id    uuid NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
  nickname      text,
  address       text NOT NULL,
  latitude      double precision NOT NULL,
  longitude     double precision NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('gym', 'park', 'in-home')),
  geo_point     extensions.geography(POINT, 4326)
                  GENERATED ALWAYS AS (
                    extensions.ST_SetSRID(
                      extensions.ST_MakePoint(longitude, latitude), 4326
                    )::extensions.geography
                  ) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Spatial index (GIST) for geo_point queries
CREATE INDEX workout_locations_geo_index ON public.workout_locations USING GIST (geo_point);

-- Lookup index for trainer_id
CREATE INDEX workout_locations_trainer_id_idx ON public.workout_locations (trainer_id);

-- Max-5 locations per trainer enforcement trigger
CREATE OR REPLACE FUNCTION public.check_location_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.workout_locations WHERE trainer_id = NEW.trainer_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 workout locations allowed per trainer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_location_limit
  BEFORE INSERT ON public.workout_locations
  FOR EACH ROW EXECUTE FUNCTION public.check_location_limit();

-- Add active_location_id to trainer_profiles (FK set after workout_locations exists)
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS active_location_id uuid REFERENCES public.workout_locations(id);

-- trainers_in_view RPC: returns live trainers within a lat/lng bounding box
CREATE OR REPLACE FUNCTION public.trainers_in_view(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
RETURNS TABLE (
  trainer_id    uuid,
  latitude      double precision,
  longitude     double precision,
  location_type text,
  nickname      text
)
SET search_path TO ''
LANGUAGE sql STABLE
AS $$
  SELECT tp.id, wl.latitude, wl.longitude, wl.location_type, wl.nickname
  FROM public.trainer_profiles tp
  JOIN public.workout_locations wl ON wl.id = tp.active_location_id
  WHERE tp.availability_status = 'live'
    AND wl.geo_point OPERATOR(extensions.&&)
        extensions.ST_SetSRID(
          extensions.ST_MakeBox2D(
            extensions.ST_Point(min_lng, min_lat),
            extensions.ST_Point(max_lng, max_lat)
          ), 4326
        )
$$;

GRANT EXECUTE ON FUNCTION public.trainers_in_view(double precision, double precision, double precision, double precision) TO authenticated, anon;

-- Row Level Security for workout_locations
ALTER TABLE public.workout_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage own locations" ON public.workout_locations
  FOR ALL USING (trainer_id IN (
    SELECT id FROM public.trainer_profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (trainer_id IN (
    SELECT id FROM public.trainer_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Anyone can read workout locations" ON public.workout_locations
  FOR SELECT USING (true);

-- Updated_at auto-trigger (reuses existing set_updated_at function)
CREATE TRIGGER set_workout_locations_updated_at
  BEFORE UPDATE ON public.workout_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
