-- Migration: Admin Trainer Detail
-- Adds get_admin_trainer_detail(p_user_id) SECURITY DEFINER RPC so the admin
-- dashboard can show full detail for ANY trainer (pending or already
-- approved): email (auth.users), profile picture, bio, specialty, locations,
-- certifications (both the self-reported array and uploaded
-- trainer_certifications docs), pricing, experience, and Stripe payout sync
-- state (stripe_account_id + payouts_enabled).
-- SECURITY DEFINER: bypasses RLS, so the admin role guard is mandatory.

CREATE OR REPLACE FUNCTION public.get_admin_trainer_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_trainer_detail(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
