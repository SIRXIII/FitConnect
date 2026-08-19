-- Guardrail: a client outside this repo writes submitted_at as local wall-clock
-- labeled UTC (proven by comparing a row's submitted_at against its own
-- created_at and the storage object's created_at, 7h apart on 2026-08-18).
-- Force server time on insert so no client can skew it.
CREATE OR REPLACE FUNCTION public.force_cert_submitted_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.submitted_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS force_cert_submitted_at ON public.trainer_certifications;
CREATE TRIGGER force_cert_submitted_at
  BEFORE INSERT ON public.trainer_certifications
  FOR EACH ROW EXECUTE FUNCTION public.force_cert_submitted_at();
