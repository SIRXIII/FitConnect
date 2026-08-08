-- Step 4: Airbnb-style suggested rate for the calling trainer.
--
-- Trainer resolved from auth.uid() (see 20260806130000 — availability_slots and
-- trainer_profiles are world-readable, so a trainer-id parameter would leak
-- rival data). Non-trainer callers get zero rows.
--
-- suggested_rate = median optimized_rate of other same-specialty trainers,
-- floored at 60% of the caller's current optimized_rate (anti race-to-bottom).
-- show_suggestion gates the UI: >= 2 comparables, >= 5 slots in the last 4
-- weeks, and fill rate < 50%.
-- ponytail: comparables are same-specialty platform-wide; add a geo radius
-- (latitude/longitude exist) when the trainer pool is big enough to need one.

CREATE OR REPLACE FUNCTION public.get_trainer_suggested_rate()
RETURNS TABLE (
  suggested_rate   numeric,
  current_rate     numeric,
  comparable_count bigint,
  fill_rate_pct    int,
  show_suggestion  boolean
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH me AS (
    SELECT id, specialty, optimized_rate
    FROM public.trainer_profiles
    WHERE user_id = auth.uid()
    LIMIT 1
  ),
  med AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY tp.optimized_rate) AS median_rate,
           COUNT(*) AS n
    FROM public.trainer_profiles tp, me
    WHERE tp.id <> me.id
      AND tp.specialty = me.specialty
      AND tp.optimized_rate > 0
  ),
  fill AS (
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE s.is_booked) AS booked
    FROM public.availability_slots s, me
    WHERE s.trainer_id = me.id
      AND s.deleted_at IS NULL
      AND s.start_time >= now() - interval '28 days'
      AND s.start_time <  now()
  )
  SELECT
    CASE WHEN med.n >= 2
         THEN GREATEST(ROUND(med.median_rate), CEIL(me.optimized_rate * 0.6))
         END,
    me.optimized_rate,
    med.n,
    CASE WHEN fill.total > 0
         THEN ROUND(100.0 * fill.booked / fill.total)::int
         ELSE 0 END,
    (med.n >= 2 AND fill.total >= 5 AND fill.booked * 2 < fill.total)
  FROM me, med, fill;
$$;

GRANT EXECUTE ON FUNCTION public.get_trainer_suggested_rate() TO authenticated;

COMMENT ON FUNCTION public.get_trainer_suggested_rate IS
  'Suggested optimized_rate for the calling trainer: median of same-specialty peers, floored at 60% of the caller''s current rate. show_suggestion is true only with >= 2 comparables, >= 5 slots in the last 4 weeks, and fill rate < 50%.';
