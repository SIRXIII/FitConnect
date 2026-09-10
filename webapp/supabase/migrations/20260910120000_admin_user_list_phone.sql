-- Admin Users tab has no Phone column because get_admin_user_list() never
-- selected one. Same 3-way COALESCE pattern as get_admin_pending_trainers /
-- get_admin_trainer_detail (20260826000000_admin_phone_reads_trainer_private_details.sql):
-- this list mixes clients (phone lives in profile_private_details) and
-- trainers (phone lives in trainer_private_details), with legacy profiles.phone
-- as the final fallback.

BEGIN;

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

GRANT EXECUTE ON FUNCTION public.get_admin_user_list() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
