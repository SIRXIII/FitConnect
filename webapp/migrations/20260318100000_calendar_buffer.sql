-- Phase 19: Calendar Export & Buffer Times
-- Adds calendar export token and buffer minutes to trainer_profiles,
-- plus RPC to reset the export token.

-- 1. Add calendar_export_token column
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS calendar_export_token text DEFAULT gen_random_uuid()::text;

-- Unique index on calendar_export_token (partial, WHERE NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_profiles_calendar_token
  ON public.trainer_profiles (calendar_export_token)
  WHERE calendar_export_token IS NOT NULL;

-- 2. Add buffer_minutes column
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS buffer_minutes smallint NOT NULL DEFAULT 0;

ALTER TABLE public.trainer_profiles
  ADD CONSTRAINT chk_buffer_minutes CHECK (buffer_minutes IN (0, 15, 30, 45, 60));

-- 3. Backfill existing trainers with tokens
UPDATE public.trainer_profiles
SET calendar_export_token = gen_random_uuid()::text
WHERE calendar_export_token IS NULL;

-- 4. RPC: reset_calendar_export_token
CREATE OR REPLACE FUNCTION public.reset_calendar_export_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token text;
BEGIN
  new_token := gen_random_uuid()::text;

  UPDATE public.trainer_profiles
  SET calendar_export_token = new_token
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trainer profile found for current user';
  END IF;

  RETURN new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_calendar_export_token() TO authenticated;
