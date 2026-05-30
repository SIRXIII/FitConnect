-- 20260529010000_fix_admin_rls_recursion.sql
-- Phase 27 follow-up: fix infinite-recursion RLS on public.profiles.
--
-- 20260529000000_reconcile_admin_schema.sql created a SELECT policy
-- "profiles_admin_select_all" ON public.profiles whose USING clause subqueries
-- public.profiles itself:
--     (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
-- Evaluating ANY select on profiles re-enters that policy -> PostgreSQL 42P17
-- "infinite recursion detected in policy for relation profiles" -> PostgREST 500
-- on GET /profiles (breaks admin login and the Users tab).
--
-- The policy is also REDUNDANT: "Public profiles are viewable by everyone"
-- USING (true) already grants SELECT on all profiles. Dropping it restores
-- profiles reads with zero loss of admin access. The admin WRITE path
-- (suspend toggle on other users' profiles) is served by profiles_admin_update,
-- whose subquery resolves through the Public SELECT once this recursive policy
-- is gone. The other *_admin_select_all policies (bookings, payments,
-- trainer_profiles) subquery profiles from a DIFFERENT table and do not recurse.

DROP POLICY IF EXISTS "profiles_admin_select_all" ON public.profiles;

NOTIFY pgrst, 'reload schema';
