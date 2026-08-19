-- Attach the existing generic audit trigger (20260317200000_audit_log.sql) to
-- trainer_certifications so admin decisions and /cert-check write-backs land
-- in audit_log like trainer_profiles/payments/bookings changes already do.
DROP TRIGGER IF EXISTS audit_trainer_certifications ON public.trainer_certifications;
CREATE TRIGGER audit_trainer_certifications
  AFTER INSERT OR UPDATE OR DELETE ON public.trainer_certifications
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
