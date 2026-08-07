-- Trainer Revenue Insights: weekly missed income from unbooked slots.
--
-- The trainer is derived from auth.uid() rather than passed in: availability_slots
-- and trainer_profiles both have `USING (true)` SELECT policies, so a p_trainer_id
-- parameter would let any caller read another trainer's revenue data.
-- A non-trainer caller gets a single all-zero row.

DROP FUNCTION IF EXISTS public.get_trainer_weekly_missed_income(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_trainer_weekly_missed_income(
  p_week_start timestamptz,
  p_week_end   timestamptz
)
RETURNS TABLE (
  total_slots         bigint,
  idle_slots          bigint,
  booked_slots        bigint,
  missed_income_cents bigint,
  top_opportunities   jsonb
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH me AS (
    SELECT tp.id, tp.optimized_rate
    FROM public.trainer_profiles tp
    WHERE tp.user_id = auth.uid()
    LIMIT 1
  ),
  slot_data AS (
    SELECT
      s.is_booked,
      EXTRACT(DOW  FROM s.start_time)::int AS day_of_week,
      EXTRACT(HOUR FROM s.start_time)::int AS hour,
      COALESCE(s.group_rate, me.optimized_rate) AS slot_rate
    FROM public.availability_slots s
    JOIN me ON me.id = s.trainer_id
    WHERE s.start_time >= p_week_start
      AND s.start_time <  p_week_end
      AND s.start_time <  now()
      AND s.deleted_at IS NULL
  ),
  opportunities AS (
    SELECT day_of_week, hour, COUNT(*) AS idle_count, SUM(slot_rate) AS potential
    FROM slot_data
    WHERE NOT is_booked
    GROUP BY day_of_week, hour
    ORDER BY idle_count DESC, potential DESC
    LIMIT 3
  )
  SELECT
    (SELECT COUNT(*) FROM slot_data),
    (SELECT COUNT(*) FROM slot_data WHERE NOT is_booked),
    (SELECT COUNT(*) FROM slot_data WHERE is_booked),
    (SELECT COALESCE(ROUND(SUM(slot_rate) * 100), 0)::bigint
       FROM slot_data WHERE NOT is_booked),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
              'day_of_week',     day_of_week,
              'hour',            hour,
              'idle_count',      idle_count,
              'potential_cents', ROUND(potential * 100)::bigint
            )), '[]'::jsonb)
       FROM opportunities);
$$;

GRANT EXECUTE ON FUNCTION public.get_trainer_weekly_missed_income(timestamptz, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_trainer_weekly_missed_income IS
  'Weekly missed income for the calling trainer: unbooked past slots valued at optimized_rate (or slot group_rate). Trainer resolved from auth.uid(). Returns totals plus the top 3 recurring idle day/hour patterns.';
