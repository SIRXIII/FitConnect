-- Migration: Session Logs (Phase 24)
-- Creates session_logs table for trainer post-session notes and structured workout data.

-- ============================================================
-- 1. Create session_logs table
-- ============================================================

CREATE TABLE public.session_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  trainer_id  uuid        NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  client_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes       text,
  exercises   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)  -- one log per booking
);

-- Exercise array item shape (enforced by app, not DB constraint):
-- { name: string, sets: number, reps: number }

COMMENT ON TABLE public.session_logs IS 'Trainer post-session notes and structured workout data per booking';
COMMENT ON COLUMN public.session_logs.exercises IS 'JSON array of exercise entries: [{ name: string, sets: number, reps: number }]';

-- ============================================================
-- 2. Enable Row Level Security
-- ============================================================

ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS Policies
-- ============================================================

-- Trainer: can INSERT, UPDATE, SELECT, DELETE their own logs
CREATE POLICY "Trainer can manage their session logs"
  ON public.session_logs
  FOR ALL
  USING (
    trainer_id IN (
      SELECT id FROM public.trainer_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    trainer_id IN (
      SELECT id FROM public.trainer_profiles WHERE user_id = auth.uid()
    )
  );

-- Client: can SELECT all session logs for their own bookings (read-only, all trainers)
CREATE POLICY "Client can read their session logs"
  ON public.session_logs
  FOR SELECT
  USING (client_id = auth.uid());

-- ============================================================
-- 4. Indexes
-- ============================================================

CREATE INDEX idx_session_logs_booking ON public.session_logs(booking_id);
CREATE INDEX idx_session_logs_client  ON public.session_logs(client_id);
CREATE INDEX idx_session_logs_trainer ON public.session_logs(trainer_id);
