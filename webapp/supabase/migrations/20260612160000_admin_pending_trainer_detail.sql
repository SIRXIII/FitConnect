-- Migration: Admin Pending Trainer Detail
-- Adds get_admin_pending_trainers() SECURITY DEFINER RPC so the admin
-- dashboard can show full detail for new trainer sign-ups: email (auth.users),
-- profile picture, bio, specialty, locations, certifications (both the
-- self-reported array and uploaded trainer_certifications docs), hourly rate,
-- and Stripe payout sync state (stripe_account_id + payouts_enabled).
-- SECURITY DEFINER: bypasses RLS — admin role guard is mandatory.

CREATE OR REPLACE FUNCTION public.get_admin_pending_trainers()
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
      WHERE tp.approval_status = 'pending'
      ORDER BY tp.created_at DESC
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_pending_trainers() TO authenticated;

NOTIFY pgrst, 'reload schema';
