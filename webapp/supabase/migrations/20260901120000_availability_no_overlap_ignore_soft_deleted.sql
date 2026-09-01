-- Fix: trainers get "Failed to update availability" when re-adding a removed hour.
--
-- Root cause: availability_slots is soft-deleted (deleted_at set, row kept), but the LIVE
-- overlap guard `no_overlap` is a non-partial gist EXCLUDE constraint that still counts
-- soft-deleted rows. Re-adding an hour that overlaps a dead row raises 23P01, surfaced as the
-- generic "Failed to update availability" toast (src/hooks/useAvailability.ts addSlot -> insert).
--
-- Drift note: the live constraint set differs from this repo's earlier migration files (live has
-- `no_overlap` gist EXCLUDE; the files' plain `availability_slots_unique_slot` UNIQUE is NOT live).
-- Live schema is truth, so this forward migration reconciles by targeting the live `no_overlap`.
--
-- Fix: make the exclusion constraint partial so only active (deleted_at IS NULL) slots participate.
-- Correct semantics: two *active* slots may not overlap; soft-deleted rows are inactive.
-- Idempotent (DROP ... IF EXISTS). btree_gist is already installed (existing constraint uses it).

ALTER TABLE public.availability_slots DROP CONSTRAINT IF EXISTS no_overlap;

ALTER TABLE public.availability_slots
  ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (trainer_id WITH =, tstzrange(start_time, end_time) WITH &&)
  WHERE (deleted_at IS NULL);
