-- Phase 10: Earnings Analytics RPC Functions
-- Three Postgres RPC functions for in-database aggregation of earnings data.
-- Called via supabase.rpc() from the frontend — no client-side aggregation.

BEGIN;

-- ============================================================
-- Function 1: get_trainer_analytics
-- Returns earnings metrics + time-series trend for a trainer.
-- SECURITY INVOKER: trainer's own RLS applies.
-- Ownership check: p_trainer_id must belong to auth.uid().
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_trainer_analytics(
  p_trainer_id  uuid,
  p_start       timestamptz,
  p_end         timestamptz,
  p_bucket      text  -- 'day' | 'week' | 'month'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
  v_result  jsonb;
BEGIN
  -- Verify caller owns this trainer profile
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
-- Function 2: get_trainer_peak_hours
-- Returns 7×24 booking counts grouped by day_of_week + hour.
-- Uses availability_slots.start_time (session time, not booking time).
-- SECURITY INVOKER: trainer_id WHERE clause scopes the query.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_trainer_peak_hours(
  p_trainer_id uuid,
  p_start      timestamptz,
  p_end        timestamptz
)
RETURNS TABLE(day_of_week int, hour int, count bigint)
LANGUAGE sql
SECURITY INVOKER
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

-- ============================================================
-- Function 3: get_admin_analytics
-- Returns platform-wide totals + top 10 earners.
-- SECURITY DEFINER: bypasses RLS — must validate admin role.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_analytics(
  p_start  timestamptz,
  p_end    timestamptz,
  p_bucket text  -- 'day' | 'week' | 'month'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role   text;
  v_result jsonb;
BEGIN
  -- Validate caller is admin
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  WITH platform_totals AS (
    SELECT
      COALESCE(SUM(amount), 0)          AS total_revenue,
      COALESCE(SUM(platform_fee), 0)    AS total_platform_fee,
      COALESCE(SUM(trainer_payout), 0)  AS total_payouts,
      COUNT(*)                          AS booking_volume
    FROM public.payments
    WHERE status = 'succeeded'
      AND created_at BETWEEN p_start AND p_end
  ),
  top_earners AS (
    SELECT
      pr.full_name                      AS trainer_name,
      SUM(pm.amount)                    AS gross,
      SUM(pm.trainer_payout)            AS net,
      COUNT(*)                          AS bookings_count
    FROM public.payments pm
    JOIN public.bookings b   ON b.id = pm.booking_id
    JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
    JOIN public.profiles pr  ON pr.id = tp.user_id
    WHERE pm.status = 'succeeded'
      AND pm.created_at BETWEEN p_start AND p_end
    GROUP BY pr.full_name
    ORDER BY net DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'totals',      (SELECT row_to_json(platform_totals) FROM platform_totals)::jsonb,
    'top_earners', COALESCE((SELECT jsonb_agg(row_to_json(top_earners)) FROM top_earners), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- Grants: allow authenticated users to call all three functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_trainer_analytics(uuid, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_peak_hours(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz, timestamptz, text) TO authenticated;

COMMIT;
