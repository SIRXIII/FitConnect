-- Fee-on-top pricing alignment: fix get_trainer_analytics discount detection.
--
-- The platform now uses the canonical FEE-ON-TOP model (see src/lib/pricing.ts):
-- bookings.rate_charged is the amount charged to the client (trainer rate + fee),
-- so it is always >= optimized_rate and can no longer signal a discount.
-- The trainer's effective (discounted) rate is bookings.trainer_payout, which is
-- what must be compared against optimized_rate.
--
-- Only the discount_metrics CTE changes; the rest of the function is unchanged.

BEGIN;

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
          -- Fee-on-top: trainer_payout is the trainer's effective rate; a value
          -- below optimized_rate means the booking carried a discount.
          100.0 * COUNT(CASE WHEN b.trainer_payout < tp.optimized_rate THEN 1 END)
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

GRANT EXECUTE ON FUNCTION public.get_trainer_analytics(uuid, timestamptz, timestamptz, text) TO authenticated;

COMMIT;
