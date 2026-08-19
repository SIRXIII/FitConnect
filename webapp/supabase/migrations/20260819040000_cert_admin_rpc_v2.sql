-- get_admin_pending_certs v2: status filter for a reviewed-certs history view,
-- computed incomplete flags (recommend-only badges), and the verification
-- columns from 20260819030000. Default 'queue' preserves the old zero-arg
-- behavior (pending + needs_info, oldest first).
--
-- The old zero-arg overload must be dropped first: with both signatures
-- present, PostgREST cannot disambiguate a parameterless rpc() call.
DROP FUNCTION IF EXISTS public.get_admin_pending_certs();

CREATE OR REPLACE FUNCTION public.get_admin_pending_certs(p_status text DEFAULT 'queue')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Admin access required'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY
      CASE WHEN p_status = 'queue' THEN r.submitted_at END ASC,
      CASE WHEN p_status <> 'queue' THEN r.submitted_at END DESC
    ), '[]'::jsonb)
    FROM (
      SELECT tc.id, tc.trainer_id, tc.cert_code, tc.cert_name, tc.cert_number, tc.file_path, tc.file_url,
        tc.expiry_date, tc.status, tc.submitted_at, tc.reviewed_at, tc.admin_notes,
        tc.verification_status, tc.verification_notes, tc.verification_checked_at,
        (tc.file_path IS NULL) AS missing_document,
        (tc.cert_number IS NULL AND c.accreditation IN ('NCCA','DEAC')) AS missing_cert_number,
        p.full_name AS trainer_name,
        split_part(p.full_name, ' ', array_length(string_to_array(p.full_name, ' '), 1)) AS trainer_last_name,
        c.display_name, c.org, c.accreditation, c.tier, c.kind, c.verify_url, c.verify_fields
      FROM trainer_certifications tc
      JOIN trainer_profiles tp ON tp.id = tc.trainer_id
      JOIN profiles p ON p.id = tp.user_id
      LEFT JOIN certification_catalog c ON c.cert_code = tc.cert_code
      WHERE CASE
        WHEN p_status = 'queue' THEN tc.status IN ('pending', 'needs_info')
        WHEN p_status = 'all' THEN true
        ELSE tc.status = p_status
      END
    ) r
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_pending_certs(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
