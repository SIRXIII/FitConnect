-- Correction to 20260902000100: drop onboarding_complete from the map discovery RPC,
-- matching the relaxed public gate (approval_status='approved' AND NOT is_suspended).
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
    AND tp.approval_status = 'approved'
    AND NOT p.is_suspended
    AND wl.geo_point OPERATOR(extensions.&&)
        extensions.ST_SetSRID(
          extensions.ST_MakeBox2D(
            extensions.ST_Point(min_lng, min_lat),
            extensions.ST_Point(max_lng, max_lat)
          ), 4326
        )
$function$;
