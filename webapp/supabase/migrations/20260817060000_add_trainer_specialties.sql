-- Multi-specialty support: additive text[] column; `specialty` remains the primary.
-- text[] (not trainer_specialty[]) for PostgREST filter safety; values gated by CHECK.
-- NOTE: prod's `specialty` column is enum trainer_specialty (drifted from the repo
-- baseline's text); the ::text casts below handle both shapes.
alter table public.trainer_profiles
  add column if not exists specialties text[] not null default '{}';

alter table public.trainer_profiles
  drop constraint if exists trainer_profiles_specialties_allowed;
alter table public.trainer_profiles
  add constraint trainer_profiles_specialties_allowed check (
    specialties <@ array['strength_training','cardio_hiit','yoga_pilates','nutrition_coaching','injury_rehabilitation']::text[]
  );

-- Backfill: every existing trainer discoverable under their current specialty.
update public.trainer_profiles
  set specialties = array[specialty::text]
  where specialties = '{}';

create index if not exists idx_trainer_profiles_specialties
  on public.trainer_profiles using gin (specialties);

-- Keep specialty/specialties in sync for single-specialty writers (Flutter app,
-- promote_to_trainer): seed the array when empty, resync it when the primary
-- changes without the array changing. Web sends both together, which is respected.
-- Named to sort BEFORE trainer_profiles_zz_rank (rank trigger must run last).
create or replace function public.sync_trainer_specialties()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.specialties is null or new.specialties = '{}' then
    new.specialties := array[new.specialty::text];
  elsif tg_op = 'UPDATE'
        and new.specialty is distinct from old.specialty
        and new.specialties is not distinct from old.specialties then
    new.specialties := array[new.specialty::text];
  end if;
  return new;
end;
$$;

drop trigger if exists trainer_profiles_sync_specialties on public.trainer_profiles;
create trigger trainer_profiles_sync_specialties
  before insert or update on public.trainer_profiles
  for each row execute function public.sync_trainer_specialties();
