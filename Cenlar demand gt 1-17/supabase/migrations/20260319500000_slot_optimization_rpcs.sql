-- Phase 26-01: Slot Optimization RPCs
-- Provides two SECURITY INVOKER functions for the AI Discount Analytics feature.

-- ============================================================
-- get_trainer_idle_heatmap
-- Returns a day/hour grid with total and booked slot counts.
-- Used by slotOptimization.ts to compute discount recommendations
-- and render the idle heatmap UI.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_trainer_idle_heatmap(
  p_trainer_id uuid,
  p_start      timestamptz,
  p_end        timestamptz
)
RETURNS TABLE(
  day_of_week  int,
  hour         int,
  total_count  bigint,
  booked_count bigint
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    EXTRACT(DOW  FROM s.start_time)::int  AS day_of_week,
    EXTRACT(HOUR FROM s.start_time)::int  AS hour,
    COUNT(*)                               AS total_count,
    COUNT(b.id)                            AS booked_count
  FROM public.availability_slots s
  LEFT JOIN public.bookings b
    ON  b.slot_id = s.id
    AND b.status IN ('confirmed', 'completed')
  WHERE s.trainer_id = p_trainer_id
    AND s.start_time BETWEEN p_start AND p_end
    AND s.deleted_at IS NULL
  GROUP BY day_of_week, hour
  ORDER BY day_of_week, hour;
$$;

-- ============================================================
-- get_trainer_slot_utilization
-- Returns aggregate booked and total counts as jsonb.
-- Used by slotOptimization.ts to compute the optimization score.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_trainer_slot_utilization(
  p_trainer_id uuid,
  p_start      timestamptz,
  p_end        timestamptz
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_count',  COUNT(*),
    'booked_count', COUNT(b.id)
  )
  FROM public.availability_slots s
  LEFT JOIN public.bookings b
    ON  b.slot_id = s.id
    AND b.status IN ('confirmed', 'completed')
  WHERE s.trainer_id = p_trainer_id
    AND s.start_time BETWEEN p_start AND p_end
    AND s.deleted_at IS NULL;
$$;
