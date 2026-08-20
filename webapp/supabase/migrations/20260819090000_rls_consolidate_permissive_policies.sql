-- Performance advisor 0006 (multiple_permissive_policies): several tables have
-- 2-3 PERMISSIVE policies for the same (role, action), so Postgres evaluates
-- each and OR's them per row. Consolidating to ONE policy per (table, action)
-- with the predicates OR'd together is access-identical (permissive = OR) and
-- removes the redundant per-row evaluation.
--
-- SCOPE: only the 13 tables whose overlaps do NOT involve a FOR ALL policy.
-- These are clean "drop N same-command policies, create 1 merged" operations.
-- The 11 FOR ALL tables (booking_requests, client_profiles, routine_exercises,
-- session_logs, trainer_exercise_sets, trainer_session_exercises,
-- trainer_session_logs, workout_exercises, workout_locations, workout_logs,
-- workout_routines) are deliberately NOT touched here: consolidating them
-- requires splitting each FOR ALL policy into separate write policies, roughly
-- doubling the policy count, which is not worth it for this micro-perf lint.
--
-- SAFETY: predicates are never retyped. For each (table, command) target, the
-- migration reads the current PERMISSIVE app-policy predicates from the catalog
-- and OR-composes them, so the merged predicate is the exact OR of the
-- originals by construction. RESTRICTIVE policies (e.g. bookings
-- block_jwt_cancel_status_transition) and service_role/postgres policies are
-- excluded and left untouched.
--
-- ROLE: re-scoped public -> authenticated when every branch is auth-dependent
-- (anon fails those predicates anyway, so access is unchanged). public is kept
-- only when a public branch is literally USING (true) (genuine anon read:
-- trainer_profiles). Per the approved default, platform_settings stays readable
-- by any signed-in user (its authenticated USING(true) branch wins).

BEGIN;

DO $$
DECLARE
  tgt        record;
  pol        record;
  v_using    text;
  v_check    text;
  v_role     text;
  v_using_true boolean;
  v_check_true boolean;
  v_public_true boolean;
  v_sql      text;
BEGIN
  FOR tgt IN
    SELECT * FROM (VALUES
      ('bookings','SELECT'),
      ('client_session_credits','SELECT'),
      ('payments','SELECT'),
      ('payout_transactions','SELECT'),
      ('platform_settings','SELECT'),
      ('platform_settings','UPDATE'),
      ('post_workout_surveys','SELECT'),
      ('profiles','UPDATE'),
      ('reviews','UPDATE'),
      ('subscription_events','SELECT'),
      ('support_messages','SELECT'),
      ('support_messages','INSERT'),
      ('support_tickets','SELECT'),
      ('support_tickets','INSERT'),
      ('support_tickets','UPDATE'),
      ('trainer_certifications','SELECT'),
      ('trainer_profiles','SELECT')
    ) AS t(tbl, cmd)
  LOOP
    v_using := NULL; v_check := NULL;
    v_using_true := false; v_check_true := false; v_public_true := false;

    -- Gather the PERMISSIVE app policies that govern this exact command.
    FOR pol IN
      SELECT policyname, roles, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tgt.tbl
        AND cmd = tgt.cmd
        AND permissive = 'PERMISSIVE'
        AND NOT (roles::text[] && array['service_role','postgres'])
    LOOP
      -- USING side (SELECT/UPDATE/DELETE)
      IF tgt.cmd IN ('SELECT','UPDATE','DELETE') AND pol.qual IS NOT NULL THEN
        IF pol.qual = 'true' THEN
          v_using_true := true;
          IF pol.roles::text[] @> array['public'] THEN v_public_true := true; END IF;
        END IF;
        v_using := CASE WHEN v_using IS NULL THEN '('||pol.qual||')'
                        ELSE v_using||' OR ('||pol.qual||')' END;
      END IF;
      -- WITH CHECK side (INSERT/UPDATE); UPDATE with null check defaults to qual
      IF tgt.cmd IN ('INSERT','UPDATE') THEN
        DECLARE v_c text := coalesce(pol.with_check, pol.qual);
        BEGIN
          IF v_c IS NOT NULL THEN
            IF v_c = 'true' THEN v_check_true := true; END IF;
            v_check := CASE WHEN v_check IS NULL THEN '('||v_c||')'
                            ELSE v_check||' OR ('||v_c||')' END;
          END IF;
        END;
      END IF;
      -- Drop the original policy now that we've captured it.
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, tgt.tbl);
    END LOOP;

    -- Collapse to true where any branch is true.
    IF v_using_true THEN v_using := 'true'; END IF;
    IF v_check_true THEN v_check := 'true'; END IF;

    -- Role: keep public only when a public branch is literally true.
    v_role := CASE WHEN v_public_true THEN 'public' ELSE 'authenticated' END;

    -- Build the single merged policy for this command.
    v_sql := format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR %s TO %s',
                    tgt.tbl||'_'||lower(tgt.cmd)||'_consolidated', tgt.tbl, tgt.cmd, v_role);
    IF tgt.cmd IN ('SELECT','UPDATE','DELETE') AND v_using IS NOT NULL THEN
      v_sql := v_sql || ' USING ('||v_using||')';
    END IF;
    IF tgt.cmd IN ('INSERT','UPDATE') AND v_check IS NOT NULL THEN
      v_sql := v_sql || ' WITH CHECK ('||v_check||')';
    END IF;
    EXECUTE v_sql;
    RAISE NOTICE 'consolidated %.% -> % (role %)', tgt.tbl, tgt.cmd, tgt.tbl||'_'||lower(tgt.cmd)||'_consolidated', v_role;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
