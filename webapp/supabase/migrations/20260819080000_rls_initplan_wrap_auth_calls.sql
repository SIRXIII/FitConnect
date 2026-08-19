-- Performance advisor 0003 (auth_rls_initplan): 72 RLS policies call auth.uid()
-- / auth.role() directly in their USING / WITH CHECK expressions, so Postgres
-- re-evaluates the auth function once PER ROW. Wrapping the call in a scalar
-- subquery — (select auth.uid()) — makes the planner hoist it to an InitPlan
-- evaluated ONCE per query. Same result, large win on big tables (bookings,
-- messages, support_*, workout_*).
--
-- This rewrites every public policy that has a BARE auth call, in place, by
-- reading each policy's exact current expression from the catalog and wrapping
-- only the auth call. The predicate, roles, command, and permissive/restrictive
-- flag are otherwise preserved byte-for-byte — no predicate is hand-retyped, so
-- there is no way to accidentally widen or narrow a security boundary.
--
-- Idempotent: the negative lookahead (?! AS) skips already-wrapped calls, which
-- the catalog renders as `auth.uid() AS uid`. Re-running matches nothing.
--
-- Scope: 74 policies across audit_log, booking_requests, bookings,
-- client_notification_preferences, client_profiles, client_session_credits,
-- conversations, gcal_*, google_calendar_*, messages, payments,
-- payout_transactions, platform_settings, post_workout_surveys, profiles,
-- push_subscriptions, referrals, reviews, session_logs, slot_notifications,
-- subscription_events, superfit_badges, support_messages, support_tickets,
-- trainer_certifications, trainer_client_reviews, trainer_profiles,
-- workout_exercises, workout_locations, workout_logs. No RLS policy is added,
-- dropped, or has its role/command/permissive flag changed.

BEGIN;

DO $$
DECLARE
  r          record;
  v_new_qual text;
  v_new_chk  text;
  v_pat      text := 'auth\.(uid|role|jwt|email)\(\)(?! AS)';
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ( coalesce(qual, '')       ~ v_pat
         OR coalesce(with_check, '') ~ v_pat )
  LOOP
    v_new_qual := regexp_replace(r.qual,       v_pat, '(select auth.\1())', 'g');
    v_new_chk  := regexp_replace(r.with_check, v_pat, '(select auth.\1())', 'g');
    EXECUTE format(
      'ALTER POLICY %I ON public.%I%s%s',
      r.policyname, r.tablename,
      case when r.qual       is not null then ' USING ('      || v_new_qual || ')' else '' end,
      case when r.with_check is not null then ' WITH CHECK (' || v_new_chk  || ')' else '' end
    );
    RAISE NOTICE 'rls_initplan: wrapped %.%', r.tablename, r.policyname;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
