-- Migration: bio tier limit enforcement
-- Phase 14: TIER-04 — server-side bio character limit by subscription tier

CREATE OR REPLACE FUNCTION public.enforce_bio_tier_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
BEGIN
  -- Only validate when bio is actually changing
  IF NEW.bio IS NOT DISTINCT FROM OLD.bio THEN
    RETURN NEW;
  END IF;

  -- Null bio is always valid
  IF NEW.bio IS NULL THEN
    RETURN NEW;
  END IF;

  v_tier := COALESCE(NEW.subscription_tier, 'free');

  -- Pro/Elite limit: 1000 characters
  IF CHAR_LENGTH(NEW.bio) > 1000 THEN
    RAISE EXCEPTION 'Bio limit is 1000 characters (current: % characters)', CHAR_LENGTH(NEW.bio);
  END IF;

  -- Free tier limit: 280 characters
  IF v_tier = 'free' AND CHAR_LENGTH(NEW.bio) > 280 THEN
    RAISE EXCEPTION 'Free tier bio limit is 280 characters. Upgrade to Pro or Elite for up to 1000 characters (current: % characters)', CHAR_LENGTH(NEW.bio);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_bio_tier_limit_trigger ON public.trainer_profiles;

CREATE TRIGGER enforce_bio_tier_limit_trigger
  BEFORE UPDATE ON public.trainer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_bio_tier_limit();
