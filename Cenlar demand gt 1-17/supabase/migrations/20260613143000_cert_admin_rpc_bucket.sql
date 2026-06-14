-- Migration: 20260613143000_cert_admin_rpc_bucket.sql
-- a. Make trainer-certifications bucket private.
-- b. get_admin_pending_certs() — returns pending/needs_info certs with catalog + trainer meta.
-- c. admin_review_cert()       — approve/reject/needs_info with score recompute.

-- ── a. Private bucket ─────────────────────────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'trainer-certifications';

-- ── b. get_admin_pending_certs() ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_pending_certs()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.submitted_at), '[]'::jsonb)
    FROM (
      SELECT
        tc.id,
        tc.trainer_id,
        tc.cert_code,
        tc.cert_name,
        tc.cert_number,
        tc.file_path,
        tc.file_url,
        tc.expiry_date,
        tc.status,
        tc.submitted_at,
        tc.admin_notes,
        p.full_name                                                                         AS trainer_name,
        split_part(p.full_name, ' ', array_length(string_to_array(p.full_name, ' '), 1))   AS trainer_last_name,
        c.display_name,
        c.org,
        c.accreditation,
        c.tier,
        c.kind,
        c.verify_url,
        c.verify_fields
      FROM trainer_certifications tc
      JOIN trainer_profiles tp ON tp.id = tc.trainer_id
      JOIN profiles p           ON p.id  = tp.user_id
      LEFT JOIN certification_catalog c ON c.cert_code = tc.cert_code
      WHERE tc.status IN ('pending', 'needs_info')
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_pending_certs() TO authenticated;

-- ── c. admin_review_cert() ────────────────────────────────────────────────────
-- Validates decision, updates the cert row, recomputes credential_score.
-- Does NOT touch trainer_profiles.is_verified — approval is a separate admin flow.

CREATE OR REPLACE FUNCTION public.admin_review_cert(
  p_cert_id  uuid,
  p_decision text,
  p_notes    text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role       text;
  v_trainer_id uuid;
BEGIN
  -- ── Admin guard ──────────────────────────────────────────────────────────────
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- ── Validate decision ────────────────────────────────────────────────────────
  IF p_decision NOT IN ('approved', 'rejected', 'needs_info') THEN
    RAISE EXCEPTION 'Invalid decision: must be approved, rejected, or needs_info';
  END IF;

  -- ── Notes required for non-approval decisions ────────────────────────────────
  IF p_decision IN ('rejected', 'needs_info') AND (p_notes IS NULL OR trim(p_notes) = '') THEN
    RAISE EXCEPTION 'Review notes required for % decisions', p_decision;
  END IF;

  -- ── Apply the decision ───────────────────────────────────────────────────────
  UPDATE trainer_certifications
  SET
    status      = p_decision,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    admin_notes = COALESCE(NULLIF(trim(p_notes), ''), admin_notes)
  WHERE id = p_cert_id
  RETURNING trainer_id INTO v_trainer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Certification not found';
  END IF;

  -- ── Recompute score for the affected trainer ──────────────────────────────────
  PERFORM public.recompute_credential_score(v_trainer_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_cert(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
