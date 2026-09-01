-- Companion to 20260902000000: also express the approval + onboarding gate directly in
-- the map discovery RPC.
--
-- trainers_in_view runs SECURITY INVOKER, so the new trainer_profiles SELECT policy
-- already excludes unapproved / non-onboarded trainers from this function's tp reads.
-- This explicit predicate documents the intent at the query and stays correct if the
-- function is ever switched to SECURITY DEFINER. Keeps the existing live + not-suspended
-- gates unchanged.
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
    AND p.onboarding_complete
    AND NOT p.is_suspended
    AND wl.geo_point OPERATOR(extensions.&&)
        extensions.ST_SetSRID(
          extensions.ST_MakeBox2D(
            extensions.ST_Point(min_lng, min_lat),
            extensions.ST_Point(max_lng, max_lat)
          ), 4326
        )
$function$;
