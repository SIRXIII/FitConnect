-- Fix: deleting a workout_location failed when it was the trainer's active location.
-- trainer_profiles.active_location_id referenced workout_locations(id) with no ON DELETE
-- action (default NO ACTION), so DELETE raised 23503
-- (trainer_profiles_active_location_id_fkey "Key is still referenced").
-- Change it to ON DELETE SET NULL: removing the active location just clears the pointer.

ALTER TABLE public.trainer_profiles
  DROP CONSTRAINT IF EXISTS trainer_profiles_active_location_id_fkey;

ALTER TABLE public.trainer_profiles
  ADD CONSTRAINT trainer_profiles_active_location_id_fkey
  FOREIGN KEY (active_location_id)
  REFERENCES public.workout_locations(id)
  ON DELETE SET NULL;
