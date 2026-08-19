-- Hide suspended trainers from the map discovery RPC.
-- Companion to the marketplace browse/recommend filter (useTrainers / useMatchedTrainers),
-- which now exclude profiles.is_suspended = true. Previously is_suspended was cosmetic:
-- suspended trainers still appeared in the map. Add a profiles join + NOT is_suspended.
-- profiles has a public SELECT policy (qual = true), so this is safe under invoker rights.
-- Runs with search_path = '' so every name is fully qualified.
CREATE OR REPLACE FUNCTION public.trainers_in_view(min_lat double precision, min_lng double precision, max_lat double precision, max_lng double precision)
 RETURNS TABLE(trainer_id uuid, latitude double precision, longitude double precision, location_type text, nickname text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT tp.id, wl.latitude, wl.longitude, wl.location_type, wl.nickname
  FROM public.trainer_profiles tp
  JOIN public.workout_locations wl ON wl.id = tp.active_location_id
  JOIN public.profiles p ON p.id = tp.user_id
  WHERE tp.availability_status = 'live'
    AND NOT p.is_suspended
    AND wl.geo_point OPERATOR(extensions.&&)
        extensions.ST_SetSRID(
          extensions.ST_MakeBox2D(
            extensions.ST_Point(min_lng, min_lat),
            extensions.ST_Point(max_lng, max_lat)
          ), 4326
        )
$function$;
