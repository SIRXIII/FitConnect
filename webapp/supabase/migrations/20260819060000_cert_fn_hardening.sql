-- Close advisor findings raised by the 20260819 cert migrations:
-- 1. force_cert_submitted_at had a mutable search_path.
-- 2. The two SECURITY DEFINER cert RPCs were executable by anon via the PUBLIC
--    default grant. Both fail safely on their internal admin check, but revoke
--    anyway. admin_review_cert needs an explicit authenticated grant first
--    because it previously relied on the PUBLIC default.
ALTER FUNCTION public.force_cert_submitted_at() SET search_path TO 'public';

GRANT EXECUTE ON FUNCTION public.admin_review_cert(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_review_cert(uuid, text, text) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_admin_pending_certs(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_pending_certs(text) FROM anon, PUBLIC;
