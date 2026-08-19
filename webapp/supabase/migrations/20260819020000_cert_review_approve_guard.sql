-- Server-side approval guard. The admin UI's review checklist is client-side
-- state only; nothing stopped an 'approved' decision on a cert with no
-- document or an expired one. Body otherwise identical to
-- 20260807150000_cert_review_notify.sql.
CREATE OR REPLACE FUNCTION public.admin_review_cert(p_cert_id uuid, p_decision text, p_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_trainer_id uuid;
  v_cert_name text;
  v_trainer_user uuid;
  v_title text;
  v_message text;
  v_file_path text;
  v_expiry date;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'needs_info') THEN
    RAISE EXCEPTION 'Invalid decision: must be approved, rejected, or needs_info'; END IF;
  IF p_decision IN ('rejected', 'needs_info') AND (p_notes IS NULL OR trim(p_notes) = '') THEN
    RAISE EXCEPTION 'Review notes required for % decisions', p_decision; END IF;

  IF p_decision = 'approved' THEN
    SELECT file_path, expiry_date INTO v_file_path, v_expiry
    FROM trainer_certifications WHERE id = p_cert_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Certification not found'; END IF;
    IF v_file_path IS NULL THEN
      RAISE EXCEPTION 'Cannot approve: no document on file'; END IF;
    IF v_expiry IS NOT NULL AND v_expiry < current_date THEN
      RAISE EXCEPTION 'Cannot approve: certification is expired'; END IF;
  END IF;

  UPDATE trainer_certifications
  SET status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(),
      admin_notes = COALESCE(NULLIF(trim(p_notes), ''), admin_notes)
  WHERE id = p_cert_id RETURNING trainer_id, cert_name INTO v_trainer_id, v_cert_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Certification not found'; END IF;
  PERFORM public.recompute_credential_score(v_trainer_id);

  IF p_decision IN ('rejected', 'needs_info') THEN
    BEGIN
      SELECT user_id INTO v_trainer_user FROM trainer_profiles WHERE id = v_trainer_id;
      v_title := CASE WHEN p_decision = 'needs_info'
        THEN 'Action needed on your certification'
        ELSE 'Certification not approved' END;
      v_message := format('%s: %s',
        COALESCE(NULLIF(trim(v_cert_name), ''), 'Your certification'), trim(p_notes));
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (v_trainer_user, 'cert_' || p_decision, v_title, v_message, '/trainer/dashboard');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'admin_review_cert: notify failed for cert %: %', p_cert_id, SQLERRM;
    END;
  END IF;
END;
$function$;
