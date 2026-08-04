-- Phase 4: Trainer discount system (REQ-DISC-01)

ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS discount_percentage integer NOT NULL DEFAULT 0
  CONSTRAINT trainer_profiles_discount_range CHECK (discount_percentage >= 0 AND discount_percentage <= 80);

COMMENT ON COLUMN public.trainer_profiles.discount_percentage IS
  'Trainer-set discount on optimized_rate. 0 = no discount. 5–80 = percentage off.';
