-- Migration: 20260728000002_admin_cert_file_path_and_trust_counters.sql
--
-- Two additions to the two admin trainer RPCs:
--
--   1. cert_documents[].file_path — the trainer-certifications bucket went private
--      in 20260613143000_cert_admin_rpc_bucket.sql, so the file_url these RPCs
--      return is unusable. Admin UI needs the object path to mint a signed URL
--      (the pending-certs review queue already works this way).
--
--   2. verified_cert_count / credentials_verified_at / profile_completeness —
--      added in 20260728000001; surfaced here so an admin can see the effect of a
--      cert decision without a second query.
--
-- IMPORTANT: both bodies below were rebuilt from the LIVE pg_get_functiondef
-- output, not from this repo's migration history, which has drifted. In
-- particular the repo's older copy of get_admin_pending_trainers is missing
-- optimized_rate, discount_percentage, credential_score, intro_video_url and
-- intro_video_thumbnail_url, all of which the live function does return.
-- Replacing it from the repo copy would silently drop five fields from the admin
-- pending queue. Everything live is preserved verbatim here.

CREATE OR REPLACE FUNCTION public.get_admin_trainer_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT to_jsonb(r)
    FROM (
      SELECT
        tp.user_id,
        tp.id AS trainer_profile_id,
        tp.approval_status,
        tp.created_at,
        p.full_name,
        p.avatar_url,
        p.phone,
        u.email,
        u.last_sign_in_at,
        tp.bio,
        tp.specialty::text AS specialty,
        NULLIF(tp.location, '') AS trainer_location,
        NULLIF(p.location, '') AS profile_location,
        tp.hourly_rate,
        tp.optimized_rate,
        tp.discount_percentage,
        tp.years_experience,
        tp.expertise_tags,
        tp.credential_score,
        tp.verified_cert_count,
        tp.credentials_verified_at,
        tp.profile_completeness,
        tp.intro_video_url,
        tp.intro_video_thumbnail_url,
        tp.certifications,
        tp.certification_number,
        tp.certification_url,
        tp.gym_memberships,
        tp.stripe_account_id,
        tp.payouts_enabled,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', tc.id,
            'cert_name', tc.cert_name,
            'cert_code', tc.cert_code,
            'cert_number', tc.cert_number,
            'status', tc.status,
            'expiry_date', tc.expiry_date,
            'file_url', tc.file_url,
            'file_path', tc.file_path,
            'submitted_at', tc.submitted_at
          ) ORDER BY tc.submitted_at DESC)
          FROM public.trainer_certifications tc
          WHERE tc.trainer_id = tp.id
        ), '[]'::jsonb) AS cert_documents
      FROM public.trainer_profiles tp
      JOIN public.profiles p ON p.id = tp.user_id
      JOIN auth.users u ON u.id = tp.user_id
      WHERE tp.user_id = p_user_id
    ) r
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_trainer_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_pending_trainers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
    FROM (
      SELECT
        tp.user_id,
        tp.id AS trainer_profile_id,
        tp.approval_status,
        tp.created_at,
        p.full_name,
        p.avatar_url,
        p.phone,
        u.email,
        u.last_sign_in_at,
        tp.bio,
        tp.specialty::text AS specialty,
        NULLIF(tp.location, '') AS trainer_location,
        NULLIF(p.location, '') AS profile_location,
        tp.hourly_rate,
        tp.optimized_rate,
        tp.discount_percentage,
        tp.credential_score,
        tp.verified_cert_count,
        tp.credentials_verified_at,
        tp.profile_completeness,
        tp.intro_video_url,
        tp.intro_video_thumbnail_url,
        tp.certifications,
        tp.certification_number,
        tp.certification_url,
        tp.gym_memberships,
        tp.stripe_account_id,
        tp.payouts_enabled,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', tc.id,
            'cert_name', tc.cert_name,
            'cert_code', tc.cert_code,
            'cert_number', tc.cert_number,
            'status', tc.status,
            'expiry_date', tc.expiry_date,
            'file_url', tc.file_url,
            'file_path', tc.file_path,
            'submitted_at', tc.submitted_at
          ) ORDER BY tc.submitted_at DESC)
          FROM public.trainer_certifications tc
          WHERE tc.trainer_id = tp.id
        ), '[]'::jsonb) AS cert_documents
      FROM public.trainer_profiles tp
      JOIN public.profiles p ON p.id = tp.user_id
      JOIN auth.users u ON u.id = tp.user_id
      WHERE tp.approval_status = 'pending'
      ORDER BY tp.created_at DESC
    ) r
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_pending_trainers() TO authenticated;

NOTIFY pgrst, 'reload schema';
