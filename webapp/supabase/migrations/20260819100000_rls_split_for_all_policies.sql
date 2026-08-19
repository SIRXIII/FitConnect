-- Performance advisor 0006 (multiple_permissive_policies): the remaining 11
-- tables each overlap because a FOR ALL "manager" policy shares a command
-- (usually SELECT) with a command-specific "reader" policy. A FOR ALL policy
-- cannot be OR-merged into on the read side alone: widening its USING would
-- also widen DELETE to the readers. So each FOR ALL policy is SPLIT into one
-- policy per command:
--   SELECT : OR(manager.using, reader.using...)   -- reads widened
--   INSERT : manager.check (+ any INSERT reader)   -- writes stay owner-only
--   UPDATE : manager.using / manager.check
--   DELETE : manager.using
-- Access is preserved by construction: every branch is the exact OR of the
-- original predicates, read from the catalog (never retyped).
--
-- Net effect: reads gain the reader's rows (already granted by the separate
-- reader policy before), writes stay exactly as the FOR ALL granted them, and
-- each (table, command) ends with exactly one permissive policy.
--
-- ROLE: manager/reader policies are TO public today; re-scoped to authenticated
-- where every branch is auth-dependent (anon fails them anyway). public kept
-- only where a public branch is literally USING (true) (workout_locations read).
--
-- Tables: booking_requests, client_profiles, routine_exercises, session_logs,
-- trainer_exercise_sets, trainer_session_exercises, trainer_session_logs,
-- workout_exercises, workout_locations, workout_logs, workout_routines.

BEGIN;

DO $$
DECLARE
  v_tbl        text;
  v_all_using  text;
  v_all_check  text;
  v_cmd        text;
  pol          record;
  v_using      text;
  v_check      text;
  v_role       text;
  v_using_true boolean;
  v_check_true boolean;
  v_public_true boolean;
  v_sql        text;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY[
    'booking_requests','client_profiles','routine_exercises','session_logs',
    'trainer_exercise_sets','trainer_session_exercises','trainer_session_logs',
    'workout_exercises','workout_locations','workout_logs','workout_routines'
  ] LOOP
    -- Capture the single FOR ALL manager policy's predicates before dropping.
    SELECT qual, coalesce(with_check, qual)
      INTO v_all_using, v_all_check
    FROM pg_policies
    WHERE schemaname='public' AND tablename=v_tbl AND cmd='ALL'
      AND permissive='PERMISSIVE'
      AND NOT (roles::text[] && array['service_role','postgres']);

    FOREACH v_cmd IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      v_using := NULL; v_check := NULL;
      v_using_true := false; v_check_true := false; v_public_true := false;

      -- Seed with the manager (FOR ALL) contribution for this command.
      IF v_cmd IN ('SELECT','UPDATE','DELETE') AND v_all_using IS NOT NULL THEN
        v_using := '('||v_all_using||')';
      END IF;
      IF v_cmd IN ('INSERT','UPDATE') AND v_all_check IS NOT NULL THEN
        v_check := '('||v_all_check||')';
      END IF;

      -- Add each command-specific peer (reader), and drop it.
      FOR pol IN
        SELECT policyname, roles, qual, with_check
        FROM pg_policies
        WHERE schemaname='public' AND tablename=v_tbl AND cmd=v_cmd
          AND permissive='PERMISSIVE'
          AND NOT (roles::text[] && array['service_role','postgres'])
      LOOP
        IF v_cmd IN ('SELECT','UPDATE','DELETE') AND pol.qual IS NOT NULL THEN
          IF pol.qual = 'true' AND pol.roles::text[] @> array['public'] THEN v_public_true := true; END IF;
          IF pol.qual = 'true' THEN v_using_true := true; END IF;
          v_using := CASE WHEN v_using IS NULL THEN '('||pol.qual||')'
                          ELSE v_using||' OR ('||pol.qual||')' END;
        END IF;
        IF v_cmd IN ('INSERT','UPDATE') THEN
          DECLARE v_c text := coalesce(pol.with_check, pol.qual);
          BEGIN
            IF v_c IS NOT NULL THEN
              IF v_c = 'true' THEN v_check_true := true; END IF;
              v_check := CASE WHEN v_check IS NULL THEN '('||v_c||')'
                              ELSE v_check||' OR ('||v_c||')' END;
            END IF;
          END;
        END IF;
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, v_tbl);
      END LOOP;

      IF v_using_true THEN v_using := 'true'; END IF;
      IF v_check_true THEN v_check := 'true'; END IF;
      v_role := CASE WHEN v_public_true THEN 'public' ELSE 'authenticated' END;

      -- Only create a policy if this command has a predicate to enforce.
      IF (v_cmd IN ('SELECT','DELETE') AND v_using IS NOT NULL)
         OR (v_cmd = 'INSERT' AND v_check IS NOT NULL)
         OR (v_cmd = 'UPDATE' AND (v_using IS NOT NULL OR v_check IS NOT NULL)) THEN
        v_sql := format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR %s TO %s',
                        v_tbl||'_'||lower(v_cmd)||'_consolidated', v_tbl, v_cmd, v_role);
        IF v_cmd IN ('SELECT','UPDATE','DELETE') AND v_using IS NOT NULL THEN
          v_sql := v_sql || ' USING ('||v_using||')';
        END IF;
        IF v_cmd IN ('INSERT','UPDATE') AND v_check IS NOT NULL THEN
          v_sql := v_sql || ' WITH CHECK ('||v_check||')';
        END IF;
        EXECUTE v_sql;
      END IF;
    END LOOP;

    -- Drop the manager FOR ALL policy now that all commands are rebuilt.
    EXECUTE (
      SELECT format('DROP POLICY %I ON public.%I', policyname, v_tbl)
      FROM pg_policies
      WHERE schemaname='public' AND tablename=v_tbl AND cmd='ALL'
        AND permissive='PERMISSIVE'
        AND NOT (roles::text[] && array['service_role','postgres'])
      LIMIT 1
    );
    RAISE NOTICE 'split FOR ALL on %', v_tbl;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
