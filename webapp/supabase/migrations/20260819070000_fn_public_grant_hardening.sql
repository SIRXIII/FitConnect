-- Close the remaining function-grant advisor backlog (2026-08-19).
--
-- Root cause: functions on this project carry only the Postgres-default
-- PUBLIC EXECUTE grant, with no per-role default privileges (established in
-- 20260819060000). The 2026-08-08 sweep (20260808210000) revoked EXECUTE from
-- anon/authenticated but NOT from PUBLIC, so every role, anon included, kept
-- executing those functions through the PUBLIC grant and the security advisor
-- kept flagging them (log_audit_event et al.). Only 7 functions ever received
-- a real PUBLIC revoke. This migration re-asserts the intended end state for
-- the whole function surface, PUBLIC included.
--
-- Functions are processed through to_regprocedure() guards: anything absent
-- on the target database is skipped with a NOTICE instead of aborting, since
-- live carries known drift relative to this repo.
--
-- Deliberately NOT touched:
--   * mark_booking_no_show / decline_pending_booking: live-only booking
--     functions defined outside this repo (webapp calls them, no repo
--     migration creates them). Triage separately after the next advisor run.
--   * All RLS policies.
--   * The public-read tables availability_slots / trainer_profiles / reviews:
--     world-readable BY DESIGN, documented via COMMENT below.

BEGIN;

-- ============================================================
-- 1. Internal-only functions: triggers, cron jobs, and helpers called only
--    from other SECURITY DEFINER functions. No PostgREST surface at all.
--    Trigger EXECUTE is checked against the trigger owner and pg_cron runs
--    jobs as the job owner, so app behavior is unchanged.
-- ============================================================
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    -- re-asserted from 20260808210000, this time including PUBLIC
    'public.auto_confirm_email()',
    'public.check_location_limit()',
    'public.enforce_bio_tier_limit()',
    'public.guard_trainer_approval_write()',
    'public.handle_comp_booking_completion()',
    'public.log_audit_event()',
    'public.moderate_message_content()',
    'public.notify_admin_new_user()',
    'public.notify_admin_trainer_onboard()',
    'public.notify_on_message()',
    'public.notify_on_support_ticket_close()',
    'public.notify_slot_watchers()',
    'public.notify_trainer_approved()',
    'public.seed_onboarding_credits()',
    'public.set_trainer_slug()',
    'public.set_updated_at()',
    'public.trainer_profiles_rank_and_guard()',
    'public.update_conversation_timestamp()',
    'public.autorevoke_superfit_badges()',
    'public.expire_certifications()',
    'public.send_booking_reminders()',
    'public.award_superfit_badge(uuid)',
    'public.revoke_superfit_badge(uuid, text)',
    'public.recompute_credential_score(uuid)',
    'public.send_booking_push(uuid, text, text, text, uuid)',
    -- trigger/cron functions the 2026-08-08 sweep never covered
    'public.sync_slot_on_booking_change()',
    'public.sync_trainer_rating()',
    'public.validate_booking_transition()',
    'public.handle_booking_notifications()',
    'public.lock_and_mark_slot_on_booking_insert()',
    'public.handle_new_user()',
    'public.guard_subscription_tier_write()',
    'public.notify_nearby_clients()',
    'public.expire_stale_availability()',
    'public.enforce_referral_discount_lockdown()',
    'public.sync_trainer_specialties()',
    'public.force_cert_submitted_at()',
    'public.update_updated_at()',
    'public.cleanup_abandoned_bookings()'
  ] LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE NOTICE 'fn_public_grant_hardening: skipped absent function %', fn;
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 2. Authenticated-only RPC surface: admin dashboard, trainer settings and
--    analytics, logged-in booking flow. Every client call site verified
--    logged-in (src grep, matches the 20260808210000 audit). Grant first,
--    because these functions previously relied on the PUBLIC default.
-- ============================================================
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_arrange_comp_booking(uuid, uuid, uuid, numeric)',
    'public.admin_grant_comp_session(uuid, text, text)',
    'public.admin_set_payout_hold(uuid, boolean, text)',
    'public.apply_gcal_blocks(uuid)',
    'public.approve_trainer(uuid)',
    'public.client_has_active_booking(uuid)',
    'public.count_trainer_active_slots(uuid)',
    'public.create_booking_atomic(uuid, uuid, uuid, numeric, numeric, numeric, text)',
    'public.get_admin_analytics(timestamptz, timestamptz, text)',
    'public.get_admin_attention(timestamptz, timestamptz)',
    'public.get_admin_comp_owed()',
    'public.get_admin_free_session_metrics()',
    'public.get_admin_free_session_metrics(timestamptz, timestamptz)',
    'public.get_admin_open_slots()',
    'public.get_admin_payout_balances()',
    'public.get_admin_pending_trainers()',
    'public.get_admin_session_credits()',
    'public.get_admin_trainer_detail(uuid)',
    'public.get_admin_trainer_sessions(uuid, timestamptz, timestamptz)',
    'public.get_admin_user_list()',
    'public.get_trainer_earnings_summary(uuid, timestamptz, timestamptz)',
    'public.get_trainer_idle_heatmap(uuid, timestamptz, timestamptz)',
    'public.get_trainer_slot_utilization(uuid, timestamptz, timestamptz)',
    'public.get_trainer_suggested_rate()',
    'public.get_trainer_weekly_missed_income(timestamptz, timestamptz)',
    'public.is_group_slot_available(uuid)',
    'public.list_flagged_cancellations(integer, integer)',
    'public.list_trainer_calendar_feeds(uuid)',
    'public.promote_to_trainer(text)',
    'public.reject_trainer(uuid)',
    'public.reset_calendar_export_token()'
  ] LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE NOTICE 'fn_public_grant_hardening: skipped absent function %', fn;
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 3. Public logged-out RPC surface, anon-callable BY DESIGN (marketplace
--    browse and referral leaderboard, unchanged since 20260808210000).
--    Grant explicitly, then drop the implicit PUBLIC grant so the advisor
--    finding closes without a behavior change.
-- ============================================================
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.get_visible_slots(uuid)',
    'public.get_slot_booking_count(uuid)',
    'public.get_referral_leaderboard()',
    'public.trainers_in_view(double precision, double precision, double precision, double precision)'
  ] LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE NOTICE 'fn_public_grant_hardening: skipped absent function %', fn;
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', fn);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 4. Document the one new rls_enabled_no_policy finding (INFO). Matches the
--    four already documented in 20260808210000: RLS on, no policy, written
--    only by service_role, so no client-facing policy is wanted.
--    nominate_trainer_submit is the sole writer and is service_role-only.
-- ============================================================
COMMENT ON TABLE public.trainer_nominations IS 'RLS enabled with no policies BY DESIGN: rows written only by nominate_trainer_submit (service_role); no client reads/writes.';

-- ============================================================
-- 5. Document the intentional public-read tables (advisor context; RLS
--    policies untouched). These are NOT advisor findings; recorded per the
--    hardening review so the deliberate anon-read surface is explicit.
-- ============================================================
COMMENT ON TABLE public.availability_slots IS 'SELECT open to anon BY DESIGN: public marketplace slot browse. Writes are trainer-scoped via RLS; trainer-scoped RPCs derive the trainer from auth.uid(), never a parameter.';
COMMENT ON TABLE public.trainer_profiles IS 'SELECT open to anon BY DESIGN: public trainer directory. Writes guarded by RLS and the rank/approval guard triggers.';
COMMENT ON TABLE public.reviews IS 'SELECT open to anon BY DESIGN (reviews_select_public): reviews render on public trainer pages. Inserts restricted to completed-booking clients; moderation admin-only.';

-- ============================================================
-- 6. NOT cleared by this migration, ACCEPTED as by-design (authenticated_
--    security_definer_function_executable / lint 0029): the admin dashboard,
--    trainer settings, and logged-in booking flow legitimately call these
--    SECURITY DEFINER RPCs as the `authenticated` role. Each guards its own
--    admin/owner check internally and needs definer rights to bypass RLS, so
--    revoking authenticated would break the app. get_visible_slots and
--    get_slot_booking_count additionally stay anon-callable (0028) for the
--    logged-out marketplace browse. send_email_notification is a live-only
--    definer helper (no repo migration) left to the mobile owner.

NOTIFY pgrst, 'reload schema';

COMMIT;
