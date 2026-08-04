-- Phase 13: Admin MRR Analytics Extension
-- Extends get_admin_analytics RPC with subscription revenue dimensions:
--   mrr, pro_subscriber_count, elite_subscriber_count
-- Function signature unchanged — all existing callers remain compatible.
-- MRR is a point-in-time snapshot of active/trialing subscribers (not date-range filtered).

BEGIN;

-- ============================================================
-- Function: get_admin_analytics (extended)
-- Adds subscription_stats CTE alongside existing platform_totals
-- and top_earners CTEs. Returns three new fields in the jsonb result.
-- SECURITY DEFINER: bypasses RLS — admin role guard is mandatory.
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
  ),
  -- Point-in-time snapshot — not filtered by p_start/p_end.
  -- MRR reflects current active/trialing subscribers, not historical range.
  -- Annual prices normalized to monthly equivalent.
  subscription_stats AS (
    SELECT
      COUNT(*) FILTER (
        WHERE subscription_tier = 'pro'
          AND subscription_status IN ('active', 'trialing')
      ) AS pro_subscriber_count,
      COUNT(*) FILTER (
        WHERE subscription_tier = 'elite'
          AND subscription_status IN ('active', 'trialing')
      ) AS elite_subscriber_count,
      COALESCE(SUM(
        CASE
          WHEN subscription_tier = 'pro'   AND subscription_interval = 'month' THEN 9.00
          WHEN subscription_tier = 'pro'   AND subscription_interval = 'year'  THEN 86.40 / 12.0
          WHEN subscription_tier = 'elite' AND subscription_interval = 'month' THEN 29.00
          WHEN subscription_tier = 'elite' AND subscription_interval = 'year'  THEN 278.40 / 12.0
          ELSE 0
        END
      ) FILTER (
        WHERE subscription_status IN ('active', 'trialing')
          AND subscription_tier IN ('pro', 'elite')
      ), 0) AS mrr
    FROM public.trainer_profiles
  )
  SELECT jsonb_build_object(
    'totals',                (SELECT row_to_json(platform_totals) FROM platform_totals)::jsonb,
    'top_earners',           COALESCE((SELECT jsonb_agg(row_to_json(top_earners)) FROM top_earners), '[]'::jsonb),
    'mrr',                   (SELECT mrr FROM subscription_stats),
    'pro_subscriber_count',  (SELECT pro_subscriber_count FROM subscription_stats),
    'elite_subscriber_count',(SELECT elite_subscriber_count FROM subscription_stats)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- Grant: allow authenticated users to call the extended function
-- (Re-applying GRANT is idempotent)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz, timestamptz, text) TO authenticated;

COMMIT;
