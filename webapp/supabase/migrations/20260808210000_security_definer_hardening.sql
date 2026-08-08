-- Security advisor WARN pass (2026-08-08).
-- 1. Restore get_trainer_analytics + get_trainer_peak_hours: defined in
--    20260315000000_analytics_rpc.sql, called by AnalyticsTab.tsx, but absent
--    from the live database (trainer Analytics tab silently failing).
--    Recreated verbatim with pinned search_path and tightened grants.
-- 2. Revoke anon+authenticated EXECUTE on internal-only SECURITY DEFINER
--    functions (trigger/cron/helper functions never called via PostgREST).
--    Trigger EXECUTE is checked against the trigger owner and cron runs as
--    the job owner, so app behavior is unchanged.
-- 3. Revoke anon EXECUTE on the authenticated-only RPC surface (admin +
--    trainer + booking RPCs; every client call site verified logged-in).
--    Public anon surface kept: get_visible_slots, get_slot_booking_count,
--    get_referral_leaderboard, trainers_in_view.
-- 4. Pin search_path on the 16 functions flagged function_search_path_mutable.

BEGIN;

-- ============================================================
-- 1a. get_trainer_analytics (restored; body identical to 20260315000000)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_trainer_analytics(
  p_trainer_id  uuid,
  p_start       timestamptz,
  p_end         timestamptz,
  p_bucket      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_result  jsonb;
BEGIN
  SELECT user_id INTO v_user_id FROM public.trainer_profiles WHERE id = p_trainer_id;
  IF v_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  WITH booking_ids AS (
    SELECT id, slot_id FROM public.bookings
    WHERE trainer_id = p_trainer_id
      AND status = 'completed'
      AND created_at BETWEEN p_start AND p_end
  ),
  payment_metrics AS (
    SELECT
      COALESCE(SUM(pm.amount), 0)          AS gross_earnings,
      COALESCE(SUM(pm.trainer_payout), 0)  AS net_earnings,
      COUNT(*)                             AS booking_count,
      CASE WHEN COUNT(*) > 0
        THEN COALESCE(AVG(pm.amount), 0)
        ELSE 0 END                         AS avg_price
    FROM public.payments pm
    INNER JOIN booking_ids bi ON bi.id = pm.booking_id
    WHERE pm.status = 'succeeded'
  ),
  discount_metrics AS (
    SELECT
      CASE WHEN COUNT(*) > 0
        THEN ROUND(
          100.0 * COUNT(CASE WHEN b.rate_charged < tp.optimized_rate THEN 1 END)
          / NULLIF(COUNT(*), 0),
          1
        )
        ELSE 0 END AS discount_adoption_pct
    FROM public.bookings b
    INNER JOIN booking_ids bi ON bi.id = b.id
    INNER JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
  ),
  trend AS (
    SELECT
      date_trunc(p_bucket, pm.created_at)  AS bucket,
      SUM(pm.amount)                       AS gross,
      SUM(pm.trainer_payout)               AS net,
      COUNT(*)                             AS count
    FROM public.payments pm
    INNER JOIN booking_ids bi ON bi.id = pm.booking_id
    WHERE pm.status = 'succeeded'
    GROUP BY bucket
    ORDER BY bucket
  )
  SELECT jsonb_build_object(
    'metrics', (SELECT row_to_json(payment_metrics) FROM payment_metrics)::jsonb ||
               (SELECT row_to_json(discount_metrics) FROM discount_metrics)::jsonb,
    'trend',   COALESCE((SELECT jsonb_agg(row_to_json(trend)) FROM trend), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 1b. get_trainer_peak_hours (restored; body identical to 20260315000000)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_trainer_peak_hours(
  p_trainer_id uuid,
  p_start      timestamptz,
  p_end        timestamptz
)
RETURNS TABLE(day_of_week int, hour int, count bigint)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT
    EXTRACT(DOW  FROM s.start_time)::int  AS day_of_week,
    EXTRACT(HOUR FROM s.start_time)::int  AS hour,
    COUNT(*)                              AS count
  FROM public.bookings b
  JOIN public.availability_slots s ON s.id = b.slot_id
  WHERE b.trainer_id = p_trainer_id
    AND b.status = 'completed'
    AND b.created_at BETWEEN p_start AND p_end
  GROUP BY day_of_week, hour
  ORDER BY day_of_week, hour;
$$;

REVOKE ALL ON FUNCTION public.get_trainer_analytics(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_trainer_peak_hours(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trainer_analytics(uuid, timestamptz, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_trainer_peak_hours(uuid, timestamptz, timestamptz) TO authenticated, service_role;

-- ============================================================
-- 2. Internal-only functions: no PostgREST surface at all.
--    Triggers (EXECUTE checked against trigger owner):
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.auto_confirm_email() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_location_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_bio_tier_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_trainer_approval_write() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_comp_booking_completion() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.moderate_message_content() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_trainer_onboard() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_message() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_support_ticket_close() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_slot_watchers() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_trainer_approved() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_onboarding_credits() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_trainer_slug() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trainer_profiles_rank_and_guard() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversation_timestamp() FROM anon, authenticated;

--    Cron-only (jobs run as the job owner):
REVOKE EXECUTE ON FUNCTION public.autorevoke_superfit_badges() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_certifications() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_booking_reminders() FROM anon, authenticated;

--    Helpers called only from other SECURITY DEFINER functions / cron:
REVOKE EXECUTE ON FUNCTION public.award_superfit_badge(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_superfit_badge(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_credential_score(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_booking_push(uuid, text, text, text, uuid) FROM anon, authenticated;

-- ============================================================
-- 3. Authenticated-only RPC surface: revoke anon, keep authenticated.
--    (Every client call site verified to run logged-in: admin dashboard,
--    trainer settings/analytics, logged-in booking flow, Flutter trainer
--    shell.)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.admin_arrange_comp_booking(uuid, uuid, uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_comp_session(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_cert(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_payout_hold(uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_gcal_blocks(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_trainer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.client_has_active_booking(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.count_trainer_active_slots(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_booking_atomic(uuid, uuid, uuid, numeric, numeric, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_attention(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_comp_owed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_free_session_metrics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_free_session_metrics(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_open_slots() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_payout_balances() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_pending_certs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_pending_trainers() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_session_credits() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_trainer_detail(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_trainer_sessions(uuid, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_user_list() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_trainer_earnings_summary(uuid, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_slot_available(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_flagged_cancellations(integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_trainer_calendar_feeds(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.promote_to_trainer(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_trainer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_calendar_export_token() FROM anon;

-- ============================================================
-- 4. Pin search_path on the flagged mutable-search_path functions.
--    'extensions' included because pgcrypto et al. live there on Supabase.
-- ============================================================
ALTER FUNCTION public.auto_confirm_email() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.check_location_limit() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.enforce_bio_tier_limit() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_admin_pending_trainers() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_admin_trainer_detail(uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_referral_leaderboard() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_slot_booking_count(uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_trainer_earnings_summary(uuid, timestamptz, timestamptz) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_trainer_idle_heatmap(uuid, timestamptz, timestamptz) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_trainer_slot_utilization(uuid, timestamptz, timestamptz) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_trainer_suggested_rate() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_trainer_weekly_missed_income(timestamptz, timestamptz) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_visible_slots(uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.is_group_slot_available(uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.update_conversation_timestamp() SET search_path = public, extensions, pg_temp;

-- ============================================================
-- 5. Document the intentional deny-all RLS tables (advisor INFO items):
--    written only via service_role (edge functions / triggers), never
--    directly by clients.
-- ============================================================
COMMENT ON TABLE public.cancellation_events IS 'RLS enabled with no policies BY DESIGN: rows written by edge functions (service_role), read via admin RPCs only.';
COMMENT ON TABLE public.email_subscribers IS 'RLS enabled with no policies BY DESIGN: written by waitlist-signup edge function (service_role) only.';
COMMENT ON TABLE public.message_flags IS 'RLS enabled with no policies BY DESIGN: written by moderation trigger, read by admins via service paths.';
COMMENT ON TABLE public.support_requests IS 'RLS enabled with no policies BY DESIGN: written via send-support-email edge function (service_role).';

COMMIT;
