-- Root-cause fix for silent admin messages (fixes trainer messaging too):
-- admin->client/trainer "Message" sends have never fired a push, so the
-- recipient never learns a message exists.
--
-- 1. is_admin is client-supplied and (today) unconstrained by RLS. Harmless
--    while silent; must be locked down before it can fire a push (self-spam
--    only, but still). NOTE: live schema no longer has the two original named
--    policies from 20260321_support_tickets.sql ("Users send messages on own
--    tickets" / "Admin send messages") — 20260819090000_rls_consolidate_permissive_policies.sql
--    merged them into a single "support_messages_insert_consolidated" policy
--    (verified live via pg_policies 2026-09-10). Replace that consolidated
--    policy, keeping its admin branch unchanged and adding `is_admin = false`
--    to the self-service branch.
DROP POLICY IF EXISTS "support_messages_insert_consolidated" ON public.support_messages;
CREATE POLICY "support_messages_insert_consolidated" ON public.support_messages
  FOR INSERT WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'::user_role
    ))
    OR (
      (SELECT auth.uid()) = sender_id
      AND is_admin = false
      AND EXISTS (
        SELECT 1 FROM public.support_tickets
        WHERE support_tickets.id = support_messages.ticket_id
          AND support_tickets.user_id = (SELECT auth.uid())
      )
    )
  );

-- 2. Push every admin-authored support message (fixes the existing trainer silence too).
CREATE OR REPLACE FUNCTION public.notify_on_admin_support_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.support_tickets WHERE id = NEW.ticket_id;
  -- send_booking_push is EXCEPTION-guarded: a push failure can never roll back the message.
  -- Body = the message itself (Flutter has no support-thread UI; the push IS the surface). 1000-char cap keeps APNs under 4KB.
  PERFORM public.send_booking_push(v_user, 'Message from FitRush', left(NEW.message, 1000), 'admin_message', NULL, NULL);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_on_admin_support_message ON public.support_messages;
CREATE TRIGGER trg_notify_on_admin_support_message
  AFTER INSERT ON public.support_messages FOR EACH ROW
  WHEN (NEW.is_admin) EXECUTE FUNCTION public.notify_on_admin_support_message();

NOTIFY pgrst, 'reload schema';
