-- Session location (2026-09-14): where a session happens.
-- Vocabulary reuses the mobile WorkoutLocationType wire values:
--   gym     = trainer's gym / studio
--   in_home = client's place (home, hotel or Airbnb gym)
--   park    = outdoors (park, beach, trail)

-- Trainer: which location types they offer. Empty = not chosen yet
-- (mobile gates availability publishing until at least one is picked).
alter table public.trainer_profiles
  add column if not exists session_locations text[] not null default '{}'::text[];
alter table public.trainer_profiles
  drop constraint if exists trainer_profiles_session_locations_allowed;
alter table public.trainer_profiles
  add constraint trainer_profiles_session_locations_allowed
  check (session_locations <@ array['gym','park','in_home']::text[]);
comment on column public.trainer_profiles.session_locations is
  'Location types the trainer offers sessions at: gym | park | in_home. Empty = not set.';

-- Booking: the client's choice for this session, plus the address when it is
-- the client's place. Nullable: rows created before this migration or via the
-- webapp flow (which has no picker yet) stay null.
alter table public.bookings
  add column if not exists session_location text,
  add column if not exists session_address text;
alter table public.bookings
  drop constraint if exists bookings_session_location_check;
alter table public.bookings
  add constraint bookings_session_location_check
  check (session_location is null or session_location in ('gym','park','in_home'));
comment on column public.bookings.session_location is
  'Client-chosen session location type (gym | park | in_home). Null = not captured.';
comment on column public.bookings.session_address is
  'Client-supplied hotel/Airbnb/home address when session_location = in_home. Booking-party-only via existing bookings RLS.';
