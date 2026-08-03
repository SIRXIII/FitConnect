-- Migration: 20260613141000_cert_columns.sql
-- Extends trainer_certifications with file_path, reviewed_by, cert_number, widens status CHECK.
-- Adds credential_score to trainer_profiles.

ALTER TABLE public.trainer_certifications
  ADD COLUMN IF NOT EXISTS file_path   text,                  -- private object path (file_url kept for legacy)
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cert_number text;

-- Widen status to allow needs_info and expired (drop old constraint first).
ALTER TABLE public.trainer_certifications DROP CONSTRAINT IF EXISTS trainer_certifications_status_check;
ALTER TABLE public.trainer_certifications ADD CONSTRAINT trainer_certifications_status_check
  CHECK (status IN ('pending','approved','rejected','needs_info','expired'));

ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS credential_score numeric NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
