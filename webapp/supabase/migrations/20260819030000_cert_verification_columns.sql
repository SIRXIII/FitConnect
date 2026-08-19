-- Registry-verification write-back columns for the /cert-check skill, plus the
-- queue view it reads. The skill only ever touches these three columns; it
-- never changes status and never approves.
ALTER TABLE public.trainer_certifications
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS verification_checked_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.trainer_certifications
    ADD CONSTRAINT trainer_certifications_verification_status_check
    CHECK (verification_status IN ('unverified','verified_match','verified_mismatch','not_found','blocked','error'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- security_invoker so RLS on trainer_certifications still applies to API
-- callers (admin policy sees all rows; trainers only their own). The
-- /cert-check skill reads it with elevated DB access regardless.
CREATE OR REPLACE VIEW public.certs_pending_verification
WITH (security_invoker = true) AS
SELECT tc.id, tc.trainer_id, tc.cert_code, tc.cert_name, tc.cert_number, tc.expiry_date,
       p.full_name AS trainer_name,
       split_part(p.full_name, ' ', array_length(string_to_array(p.full_name, ' '), 1)) AS trainer_last_name,
       c.verify_url, c.verify_fields
FROM trainer_certifications tc
JOIN trainer_profiles tp ON tp.id = tc.trainer_id
JOIN profiles p ON p.id = tp.user_id
LEFT JOIN certification_catalog c ON c.cert_code = tc.cert_code
WHERE tc.status = 'pending'
  AND tc.file_path IS NOT NULL
  AND tc.verification_status = 'unverified'
  AND c.verify_url IS NOT NULL;

REVOKE ALL ON public.certs_pending_verification FROM anon;

NOTIFY pgrst, 'reload schema';
