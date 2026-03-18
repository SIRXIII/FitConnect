-- Migration: Onboarding System
-- Adds onboarding_complete flag to profiles and creates client_profiles table

-- ============================================================
-- 1. Add onboarding_complete to profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. client_profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_profiles (
  id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid         NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Personal stats
  age                      int          CHECK (age >= 13 AND age <= 120),
  weight_lbs               numeric(5,1),
  height_ft                int,
  height_in                int          CHECK (height_in >= 0 AND height_in < 12),

  -- Fitness profile
  body_type                text         CHECK (body_type IN ('slim', 'average', 'athletic', 'heavy')),
  fitness_level            text         CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  fitness_goals            text[]       NOT NULL DEFAULT '{}',
  workout_types            text[]       NOT NULL DEFAULT '{}',
  preferred_session_length int          NOT NULL DEFAULT 60
                                          CHECK (preferred_session_length IN (30, 45, 60, 90)),
  health_notes             text,

  -- Payment
  stripe_customer_id       text,
  stripe_payment_method_id text,
  stripe_payment_last4     text,
  stripe_payment_brand     text,

  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own client profile"
  ON public.client_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Trainers can view client profiles for their bookings"
  ON public.client_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.trainer_profiles tp ON tp.id = b.trainer_id
      WHERE b.client_id = client_profiles.user_id
        AND tp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. updated_at trigger
-- ============================================================
CREATE TRIGGER client_profiles_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
