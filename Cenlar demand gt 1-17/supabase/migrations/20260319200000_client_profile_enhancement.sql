-- Migration: Client Profile Enhancement (Phase 23.1)
-- Adds health_conditions, intensity_preference, and goals_ranked columns to client_profiles.
-- Adds RLS policy for trainer read access via booking_requests (pre-booking queue).

-- ============================================================
-- 1. New columns on client_profiles
-- ============================================================

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS health_conditions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS intensity_preference text
    CHECK (intensity_preference IN ('light', 'moderate', 'intense'));

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS goals_ranked jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================
-- 2. Column comments
-- ============================================================

COMMENT ON COLUMN public.client_profiles.health_conditions IS 'Structured health condition checklist as JSON array of strings (e.g. ["back_pain", "asthma"])';
COMMENT ON COLUMN public.client_profiles.intensity_preference IS 'Workout intensity preference: light, moderate, or intense';
COMMENT ON COLUMN public.client_profiles.goals_ranked IS 'Ordered top-3 fitness goals as JSON array of strings';

-- ============================================================
-- 3. RLS policy — trainer read via booking_requests (pending queue)
-- ============================================================

CREATE POLICY "Trainers can view client profiles for their booking requests"
  ON public.client_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.booking_requests br
      JOIN public.trainer_profiles tp ON tp.id = br.trainer_id
      WHERE br.client_id = client_profiles.user_id
        AND tp.user_id = auth.uid()
        AND br.status = 'pending'
    )
  );
