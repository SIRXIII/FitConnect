-- 20260529020000_audit_log_actor_fk_profiles.sql
-- Phase 27 follow-up: audit_log.actor_id FK must target public.profiles, not
-- auth.users, so the admin Audit tab embed actor:actor_id(full_name) resolves
-- (full_name lives on profiles). Same class of fix as support_tickets_user_id_fkey.
--
-- Safe: actor_id is nullable (service-role writes record actor_id = NULL); every
-- non-null actor_id = auth.uid() = a profiles.id (profiles.id = auth.users.id).
-- No orphan rows possible. NOT VALID + VALIDATE avoids a long table lock.

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id)
  NOT VALID;
ALTER TABLE public.audit_log
  VALIDATE CONSTRAINT audit_log_actor_id_fkey;

NOTIFY pgrst, 'reload schema';
