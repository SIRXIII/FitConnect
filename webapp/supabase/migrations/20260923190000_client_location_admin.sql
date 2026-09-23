-- Client location validation and admin profile visibility.
-- Location remains nullable so existing incomplete and historic rows are not
-- rewritten. New completed client writes must provide a trimmed city/service
-- area, while historic completed rows with no location remain editable.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location text;

CREATE OR REPLACE FUNCTION public.validate_client_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_new_role text;
  v_old_role text;
  v_old_onboarding_complete boolean;
  v_new_is_completed_client boolean;
  v_old_is_completed_client boolean;
  v_location_changed boolean;
  v_newly_completed_client boolean;
  v_should_validate_location boolean;
BEGIN
  v_new_role := NEW.role::text;
  v_new_is_completed_client :=
    v_new_role = 'client' AND COALESCE(NEW.onboarding_complete, false);

  IF TG_OP = 'UPDATE' THEN
    v_old_role := OLD.role::text;
    v_old_onboarding_complete := COALESCE(OLD.onboarding_complete, false);
    v_old_is_completed_client :=
      v_old_role = 'client' AND v_old_onboarding_complete;
    v_location_changed := OLD.location IS DISTINCT FROM NEW.location;
  ELSE
    v_old_onboarding_complete := false;
    v_old_is_completed_client := false;
    v_location_changed := true;
  END IF;

  -- This covers INSERTs, false -> true completion, and role changes into a
  -- completed client. It intentionally does not treat an existing completed
  -- client with a NULL location as newly completed, preserving that historic
  -- account's ability to update unrelated profile fields.
  v_newly_completed_client :=
    v_new_is_completed_client
    AND (
      TG_OP = 'INSERT'
      OR v_old_role IS DISTINCT FROM 'client'
      OR NOT v_old_onboarding_complete
    );

  v_should_validate_location :=
    (v_new_role = 'client' OR v_old_role = 'client')
    AND (TG_OP = 'INSERT' OR v_location_changed OR v_newly_completed_client);

  IF v_should_validate_location AND NEW.location IS NOT NULL THEN
    NEW.location := NULLIF(
      regexp_replace(NEW.location, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
      ''
    );
    IF NEW.location IS NOT NULL AND char_length(NEW.location) > 100 THEN
      RAISE EXCEPTION 'Client location must be 100 characters or fewer';
    END IF;
  END IF;

  -- Do not fabricate a missing value for an historic completed client, but do
  -- reject a missing value on a new completion or an attempted clear/change
  -- after completion.
  IF NEW.location IS NULL
     AND (
       (
         v_new_is_completed_client
         AND (TG_OP = 'INSERT' OR NOT v_old_is_completed_client OR v_location_changed)
       )
       OR (v_old_is_completed_client AND v_location_changed)
     ) THEN
    RAISE EXCEPTION 'Client location is required when onboarding is complete';
  END IF;

  RETURN NEW;
END;
$fn$;

ALTER FUNCTION public.validate_client_location() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validate_client_location() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_require_client_location ON public.profiles;
CREATE TRIGGER profiles_require_client_location
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_client_location();

-- Latest live get_admin_client_detail definition is based on
-- 20260825070000_profile_phone_privacy.sql. Keep the admin guard, definer
-- execution, pinned search_path, and private phone join while exposing only
-- the requested non-medical client profile fields.
CREATE OR REPLACE FUNCTION public.get_admin_client_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT to_jsonb(r) FROM (
      SELECT
        p.id AS user_id, p.full_name, p.avatar_url,
        COALESCE(ppd.phone, p.phone) AS phone,
        NULLIF(p.location, '') AS location,
        p.onboarding_complete, p.is_suspended,
        p.created_at, u.email, u.last_sign_in_at,
        cp.bio, cp.fitness_level, cp.training_frequency,
        cp.fitness_goals, cp.workout_types,
        COALESCE(bc.total_bookings, 0)  AS total_bookings,
        COALESCE(bc.completed_count, 0) AS completed_count,
        COALESCE(bc.cancelled_count, 0) AS cancelled_count,
        COALESCE(bc.no_show_count, 0)   AS no_show_count,
        COALESCE(bc.total_spend, 0)     AS total_spend,
        COALESCE(rb.recent_bookings, '[]'::jsonb) AS recent_bookings,
        COALESCE(rv.reviews, '[]'::jsonb) AS reviews
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      LEFT JOIN public.profile_private_details ppd ON ppd.user_id = p.id
      LEFT JOIN public.client_profiles cp ON cp.user_id = p.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total_bookings,
               COUNT(*) FILTER (WHERE b.status = 'completed') AS completed_count,
               COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled_count,
               COUNT(*) FILTER (WHERE b.status = 'no_show')   AS no_show_count,
               COALESCE(SUM(b.rate_charged) FILTER (WHERE b.status = 'completed'), 0) AS total_spend
        FROM public.bookings b WHERE b.client_id = p.id
      ) bc ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'id', b.id, 'status', b.status, 'rate_charged', b.rate_charged,
          'start_time', s.start_time, 'trainer_name', tpr.full_name
        ) ORDER BY s.start_time DESC) AS recent_bookings
        FROM (SELECT * FROM public.bookings bx WHERE bx.client_id = p.id
              ORDER BY bx.created_at DESC LIMIT 10) b
        JOIN public.availability_slots s ON s.id = b.slot_id
        JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
        JOIN public.profiles tpr ON tpr.id = tp.user_id
      ) rb ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'id', r.id, 'rating', r.rating, 'comment', r.comment,
          'created_at', r.created_at, 'trainer_name', tpr2.full_name
        ) ORDER BY r.created_at DESC) AS reviews
        FROM public.reviews r
        JOIN public.trainer_profiles tp2 ON tp2.id = r.trainer_id
        JOIN public.profiles tpr2 ON tpr2.id = tp2.user_id
        WHERE r.client_id = p.id
      ) rv ON true
      WHERE p.id = p_user_id AND p.role = 'client'
    ) r
  );
END;
$fn$;

-- Latest live get_admin_user_list definition is based on
-- 20260910120000_admin_user_list_phone.sql. Clients use profiles.location;
-- trainers prefer trainer_profiles.location with the profile value as a
-- compatibility fallback.
CREATE OR REPLACE FUNCTION public.get_admin_user_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    FROM (
      SELECT
        p.id, p.full_name, p.role, p.is_suspended, p.created_at,
        p.avatar_url,
        COALESCE(ppd.phone, tpd.phone, p.phone) AS phone,
        CASE
          WHEN p.role::text = 'trainer'
            THEN COALESCE(NULLIF(tp.location, ''), NULLIF(p.location, ''))
          ELSE NULLIF(p.location, '')
        END AS location,
        u.email, u.last_sign_in_at,
        tp.subscription_tier, tp.subscription_status,
        tp.tier_overridden_by, tp.tier_overridden_at
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      LEFT JOIN public.trainer_profiles tp ON tp.user_id = p.id
      LEFT JOIN public.profile_private_details ppd ON ppd.user_id = p.id
      LEFT JOIN public.trainer_private_details tpd ON tpd.user_id = p.id
      WHERE p.role IN ('trainer', 'client', 'admin')
      ORDER BY p.created_at DESC
    ) r
  );
END;
$fn$;

-- Preserve the authenticated admin RPC surface while closing implicit
-- PUBLIC/anon execution grants.
REVOKE ALL ON FUNCTION public.get_admin_client_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_client_detail(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_admin_user_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_list() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
