-- Migration: 20260613142000_credential_score.sql
-- Creates recompute_credential_score(p_tp uuid) which scores a trainer's approved certs
-- and writes the result to trainer_profiles.credential_score.
--
-- Scoring model (per plan §4.5):
--   Primary (best single CPT/advanced cert):
--     NCCA/DEAC approved + valid expiry (or no expiry)  → 50 pts
--     NCCA/DEAC approved + expired ≤90 days             → 35 pts
--     NCCA/DEAC pending or needs_info                   → 15 pts
--     NCCA/DEAC approved + expired >90 days             →  5 pts
--     Any other approved                                →  5 pts
--   Additional specialty/advanced/cpt (excluding primary, cap 20):
--     advanced approved+valid → 8, specialty → 5, cpt → 6
--   Nutrition approved+valid (cap 10): 8 per cert
--   CPR/safety approved+valid: flat 10
--   Total capped at 100.

CREATE OR REPLACE FUNCTION public.recompute_credential_score(p_tp uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_primary   numeric := 0;
  v_add       numeric := 0;
  v_nutr      numeric := 0;
  v_cpr       numeric := 0;
  v_score     numeric;
  v_primary_id uuid;
BEGIN
  -- ── Primary: best single CPT/advanced cert ─────────────────────────────────
  SELECT COALESCE(MAX(
    CASE
      WHEN c.accreditation IN ('NCCA','DEAC')
           AND tc.status = 'approved'
           AND (tc.expiry_date IS NULL OR tc.expiry_date >= current_date)
        THEN 50
      WHEN c.accreditation IN ('NCCA','DEAC')
           AND tc.status = 'approved'
           AND tc.expiry_date >= current_date - 90
        THEN 35
      WHEN c.accreditation IN ('NCCA','DEAC')
           AND tc.status IN ('pending','needs_info')
        THEN 15
      WHEN c.accreditation IN ('NCCA','DEAC')
           AND tc.status = 'approved'
        THEN 5
      WHEN tc.status = 'approved'
        THEN 5
      ELSE 0
    END
  ), 0)
  INTO v_primary
  FROM trainer_certifications tc
  JOIN certification_catalog c ON c.cert_code = tc.cert_code
  WHERE tc.trainer_id = p_tp
    AND c.kind IN ('cpt','advanced');

  -- Identify the single primary cert row to exclude from the additive pool.
  -- Prefer approved status, then earliest created_at as tiebreak.
  SELECT tc.id
  INTO v_primary_id
  FROM trainer_certifications tc
  JOIN certification_catalog c2 ON c2.cert_code = tc.cert_code
  WHERE tc.trainer_id = p_tp
    AND c2.kind IN ('cpt','advanced')
  ORDER BY (tc.status = 'approved') DESC, tc.created_at
  LIMIT 1;

  -- ── Additional specialty/advanced/cpt (cap 20) ──────────────────────────────
  SELECT LEAST(20, COALESCE(SUM(
    CASE
      WHEN c.kind = 'advanced'  THEN 8
      WHEN c.kind = 'specialty' THEN 5
      WHEN c.kind = 'cpt'       THEN 6
      ELSE 0
    END
  ), 0))
  INTO v_add
  FROM trainer_certifications tc
  JOIN certification_catalog c ON c.cert_code = tc.cert_code
  WHERE tc.trainer_id = p_tp
    AND tc.status = 'approved'
    AND (tc.expiry_date IS NULL OR tc.expiry_date >= current_date)
    AND c.kind IN ('cpt','advanced','specialty')
    AND (v_primary_id IS NULL OR tc.id <> v_primary_id);

  -- ── Nutrition approved+valid (cap 10) ────────────────────────────────────────
  SELECT LEAST(10, COALESCE(SUM(8), 0))
  INTO v_nutr
  FROM trainer_certifications tc
  JOIN certification_catalog c ON c.cert_code = tc.cert_code
  WHERE tc.trainer_id = p_tp
    AND c.kind = 'nutrition'
    AND tc.status = 'approved'
    AND (tc.expiry_date IS NULL OR tc.expiry_date >= current_date);

  -- ── CPR/safety bonus (flat 10 if any valid) ───────────────────────────────────
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM trainer_certifications tc
      JOIN certification_catalog c ON c.cert_code = tc.cert_code
      WHERE tc.trainer_id = p_tp
        AND c.kind = 'safety'
        AND tc.status = 'approved'
        AND (tc.expiry_date IS NULL OR tc.expiry_date >= current_date)
    ) THEN 10
    ELSE 0
  END
  INTO v_cpr;

  v_score := LEAST(100, v_primary + v_add + v_nutr + v_cpr);

  UPDATE trainer_profiles
  SET credential_score = v_score
  WHERE id = p_tp;

  RETURN v_score;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_credential_score(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
