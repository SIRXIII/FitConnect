-- Backfill: approve_trainer / reject_trainer already exist in live DB (created out-of-band).
-- Committed here so the definitions survive DB resets/branches. CREATE OR REPLACE = no behavior change.

CREATE OR REPLACE FUNCTION public.approve_trainer(p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = (SELECT auth.uid());
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'approve_trainer: admin access required' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.trainer_profiles
  SET is_verified = true, approval_status = 'approved'
  WHERE user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_trainer(p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = (SELECT auth.uid());
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'reject_trainer: admin access required' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.trainer_profiles
  SET is_verified = false, approval_status = 'rejected'
  WHERE user_id = p_user_id AND approval_status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reject_trainer: no pending trainer for user %', p_user_id USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.approve_trainer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_trainer(uuid) TO authenticated;
