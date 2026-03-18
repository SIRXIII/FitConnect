-- Migration: Fitness Passport columns (Phase 18)
-- Adds bio and training_frequency to client_profiles for the Fitness Passport feature.
-- physical_limitations is NOT added here; the existing health_notes column serves that purpose.

-- ============================================================
-- 1. Add bio column
-- ============================================================
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS bio text
    CHECK (char_length(bio) <= 500);

COMMENT ON COLUMN public.client_profiles.bio IS 'Client bio for Fitness Passport (max 500 chars)';

-- ============================================================
-- 2. Add training_frequency column
-- ============================================================
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS training_frequency text
    CHECK (training_frequency IN ('1-2', '3-4', '5-6', '7+'));

COMMENT ON COLUMN public.client_profiles.training_frequency IS 'Weekly training frequency for Fitness Passport';
