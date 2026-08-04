-- Migration: workout_logs and workout_exercises tables for client-owned workout logging
-- Phase 38 Plan 01

-- ============================================================
-- Table: workout_logs
-- ============================================================
CREATE TABLE public.workout_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  uuid REFERENCES auth.users(id) NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  logged_at  timestamptz DEFAULT now() NOT NULL,
  notes      text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_workout_logs_client_id ON public.workout_logs (client_id);
CREATE INDEX idx_workout_exercises_log_id_booking ON public.workout_logs (booking_id)
  WHERE booking_id IS NOT NULL;

-- ============================================================
-- Table: workout_exercises
-- ============================================================
CREATE TABLE public.workout_exercises (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  log_id        uuid REFERENCES public.workout_logs(id) ON DELETE CASCADE NOT NULL,
  exercise_name text NOT NULL,
  exercise_key  text,
  sort_order    integer NOT NULL DEFAULT 0,
  sets          jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_workout_exercises_log_id ON public.workout_exercises (log_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

-- workout_logs: client full CRUD
CREATE POLICY "client_manage_own_workout_logs"
  ON public.workout_logs
  FOR ALL
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- workout_logs: trainer read-only for their clients
CREATE POLICY "trainer_read_client_workout_logs"
  ON public.workout_logs
  FOR SELECT
  USING (
    client_id IN (
      SELECT b.client_id
      FROM public.bookings b
      JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
      WHERE tp.user_id = auth.uid()
    )
  );

-- workout_exercises: client full CRUD (via log ownership)
CREATE POLICY "client_manage_own_workout_exercises"
  ON public.workout_exercises
  FOR ALL
  USING (
    log_id IN (
      SELECT id FROM public.workout_logs WHERE client_id = auth.uid()
    )
  )
  WITH CHECK (
    log_id IN (
      SELECT id FROM public.workout_logs WHERE client_id = auth.uid()
    )
  );

-- workout_exercises: trainer read-only for their clients
CREATE POLICY "trainer_read_client_workout_exercises"
  ON public.workout_exercises
  FOR SELECT
  USING (
    log_id IN (
      SELECT wl.id
      FROM public.workout_logs wl
      WHERE wl.client_id IN (
        SELECT b.client_id
        FROM public.bookings b
        JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
        WHERE tp.user_id = auth.uid()
      )
    )
  );
