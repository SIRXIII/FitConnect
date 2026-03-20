# Architecture Patterns — v4.0 The Live Platform

**Domain:** Fitness marketplace SPA — v4.0 feature integration (Google Maps, geolocation, AI matching, AI analytics, Google Calendar bidirectional sync, session logs, email capture)
**Researched:** 2026-03-18
**Confidence:** HIGH (codebase inspection + official Supabase docs + Google Maps/Calendar official docs + community patterns)

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                     React 19 SPA (Netlify)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  MapView     │  │ TrainerDash  │  │ ClientDash   │  │ Settings │  │
│  │  (new)       │  │ (extended)   │  │ (extended)   │  │ (extend) │  │
│  │  TrainerMap  │  │ AvailToggle  │  │ AIMatches    │  │ CalOAuth │  │
│  │  TrainerPins │  │ SessionNotes │  │ LocationPref │  │          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  │
└─────────┼────────────────┼─────────────────┼───────────────┼────────┘
          │ VITE_GOOGLE_MAPS_API_KEY exposed  │               │
          ▼                 ▼                  ▼               ▼
┌──────────────────────────────────────────────────────────────────────┐
│              @vis.gl/react-google-maps (Maps JS API)                  │
│  APIProvider → Map → AdvancedMarker × N + @googlemaps/markerclusterer │
└──────────────────────────────────────────────────────────────────────┘
          │ supabase-js SDK
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Supabase Edge Functions (Deno)                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ ai-match        │  │ calendar-sync    │  │ location-notify      │  │
│  │ (new)           │  │ (new — bidirect) │  │ (new)                │  │
│  │ Gemini API call │  │ Google Cal v3    │  │ notifications INSERT  │  │
│  └────────┬────────┘  └────────┬─────────┘  └──────────────────────┘  │
│  ┌─────────────────┐  ┌──────────────────┐                             │
│  │ existing: 14 fns│  │ send-notification│                             │
│  │ payments,stripe │  │ -email (existing)│                             │
│  │ subscriptions   │  └──────────────────┘                             │
│  └─────────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL                               │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ EXISTING (v3.0): profiles, trainer_profiles, client_profiles,  │   │
│  │ availability_slots, bookings, reviews, notifications,          │   │
│  │ conversations, messages, referrals, payout_transactions,       │   │
│  │ subscription_events, audit_log, calendar_connections,          │   │
│  │ platform_settings                                              │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ NEW (v4.0):                                                     │   │
│  │ trainer_locations   — workout locations (PostGIS geography)    │   │
│  │ session_notes       — post-session trainer notes               │   │
│  │ workout_logs        — client progress tracking entries         │   │
│  │ email_subscribers   — landing page email capture               │   │
│  │ demand_signals      — aggregated search/booking heatmap data   │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ MODIFIED (v4.0 additive columns):                              │   │
│  │ trainer_profiles ADD: is_available BOOLEAN, available_until    │   │
│  │                       TIMESTAMPTZ, location_point GEOGRAPHY    │   │
│  │ client_profiles  ADD: notify_radius_km INT, notify_area_point  │   │
│  │                       GEOGRAPHY, notify_on_available BOOLEAN   │   │
│  │ calendar_connections ADD: sync_direction TEXT (read|write|both)│   │
│  │                           events_written INT, last_write_at    │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ PostGIS extension (enable for geography distance queries)       │   │
│  │ pg_cron: availability-sleep-timer every 5 min (new)            │   │
│  │ pg_cron: location-notify check every 5 min (new)               │   │
│  │ pg_cron: weekly-analytics batch every Monday (new)             │   │
│  └────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Supabase Vault (encrypted secrets)                │
│  google_calendar_refresh_{uid}  — per-trainer write-back tokens      │
│  (read-only tokens from Supabase Auth provider_token — see below)    │
└──────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     External Services                                 │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │ Google Maps JS │  │ Google Cal    │  │ Gemini API               │  │
│  │ API (browser)  │  │ REST API v3   │  │ (gemini-2.0-flash,       │  │
│  │ Maps + Places  │  │ (Edge Fn)     │  │  text-only, cheap)       │  │
│  └────────────────┘  └───────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | New vs Existing | Key Integration Points |
|-----------|---------------|-----------------|------------------------|
| `MapView` page | Render map with trainer pins, search overlay, cluster toggle | New page | `useTrainersMap` hook, `@vis.gl/react-google-maps`, `useTrainers` (reuse filters) |
| `TrainerLocationManager` | Address input + map preview for trainer workout locations | New component | `trainer_locations` table, Places Autocomplete API, `useTrainerLocations` hook |
| `AvailabilityToggle` | Online/offline switch with sleep timer picker | New component | `trainer_profiles.is_available` column, Realtime subscription |
| `AIMatchCard` | Show AI match score + reasoning for trainer recommendation | New component | `ai-match` Edge Function, `client_profiles` Fitness Passport data |
| `SessionNoteForm` | Post-session trainer notes entry | New component | `session_notes` table, triggered after booking status → `completed` |
| `WorkoutLogEntry` | Client progress log (exercises, reps, weight) | New component | `workout_logs` table |
| `EmailCaptureBox` | Landing page waitlist email input | New component (Landing.tsx section) | `email_subscribers` table, direct Supabase insert |
| `CalendarSyncSettings` | Google OAuth connect, sync direction, status | Extend TrainerSettings | `calendar_connections` table, `calendar-sync` Edge Function |
| `TrainerDashboard` | Add availability toggle, session notes access, AI analytics panel | Extend existing | New columns on `trainer_profiles`, new RPCs |
| `ClientDashboard` | Add AI match section, location pref, notification opt-in | Extend existing | `client_profiles` new columns |

---

## 1. Google Maps JS API in React

### Recommended Library

Use `@vis.gl/react-google-maps` — this is the official Google-sponsored React library (vis.gl/Google collaboration, v1.0 stable). Do not use `@react-google-maps/api` (unmaintained community fork).

```bash
npm install @vis.gl/react-google-maps @googlemaps/markerclusterer
```

### API Key Setup

Add to `.env.local`:
```
VITE_GOOGLE_MAPS_API_KEY=AIza...
```

Access in code: `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`

**Key security note:** The Maps JS API key is exposed in the browser bundle. Restrict it in Google Cloud Console to your domain (Netlify URL + localhost:3000) and restrict to Maps JavaScript API + Places API only. This is the standard approach — the key is not a secret, it is a domain-restricted identifier.

### Component Structure

```tsx
// src/App.tsx — wrap entire app or just map routes
import { APIProvider } from '@vis.gl/react-google-maps';

// Wrap at app level so Maps JS SDK loads once
<APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
  <Routes>
    {/* ... existing routes ... */}
    <Route path="/map" element={<MapView />} />
  </Routes>
</APIProvider>
```

```tsx
// src/pages/MapView.tsx
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';

// src/components/map/TrainerMarkerCluster.tsx
// Uses MarkerClusterer from @googlemaps/markerclusterer
// or supercluster (via useSupercluster hook) for custom cluster rendering
```

### Integration with Existing Search

The existing `useTrainers` hook in `src/hooks/useTrainers.ts` already queries `trainer_profiles` with filters. For the map view:

1. Call `useTrainers()` with same filters (specialty, rate) plus a new `withinKm` + `centerLat/Lng` parameter.
2. The hook calls a new RPC `search_trainers_geo(lat, lng, radius_km, filters)` that uses PostGIS `ST_DWithin`.
3. Results feed both the list view (existing `SearchSection`) and the `MapView`.
4. Extend `useTrainers` options object — do not create a separate hook. The existing `dbTrainerToCardData()` adapter in `SearchSection.tsx` can be shared.

**New env var needed:** `VITE_GOOGLE_MAPS_API_KEY`

---

## 2. Geospatial Data in Supabase PostgreSQL

### Recommendation: PostGIS `geography(POINT)` — Not Plain lat/lng Columns

**Rationale:** The existing `trainer_profiles.latitude` and `trainer_profiles.longitude` columns (plain `numeric`) are fine for storing coordinates, but distance queries on plain lat/lng require manual Haversine formula in SQL. PostGIS provides:

- `ST_DWithin(geography, geography, distance_meters)` — spatial index (GIST) used automatically
- `ST_Distance(geography, geography)` — accurate geodetic distance in meters
- `<->` operator — nearest-neighbor sort with spatial index

**Strategy:** Add a `location_point geography(POINT)` column to `trainer_profiles` and keep the existing `latitude`/`longitude` columns for backward compatibility. Populate via trigger.

```sql
-- Migration 23: Add PostGIS support
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography column to trainer_profiles (additive — no breaking change)
ALTER TABLE trainer_profiles
  ADD COLUMN IF NOT EXISTS location_point geography(POINT),
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_until timestamptz;

-- Spatial index
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_location
  ON trainer_profiles USING GIST (location_point);

-- Sync trigger: keep location_point in sync with lat/lng updates
CREATE OR REPLACE FUNCTION sync_trainer_location_point()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location_point := ST_MakePoint(NEW.longitude, NEW.latitude)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trainer_location_point_sync
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION sync_trainer_location_point();
```

### Geospatial RPC for Map Search

```sql
-- RPC: search_trainers_geo
-- Called via supabase.rpc('search_trainers_geo', { lat, lng, radius_km, ... })
CREATE OR REPLACE FUNCTION search_trainers_geo(
  lat float,
  lng float,
  radius_km float DEFAULT 20,
  specialty_filter text DEFAULT NULL,
  max_rate numeric DEFAULT NULL,
  available_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  display_name text,
  specialty text,
  optimized_rate numeric,
  rating numeric,
  review_count int,
  latitude numeric,
  longitude numeric,
  is_available boolean,
  avatar_url text,
  distance_km float
)
LANGUAGE sql STABLE AS $$
  SELECT
    tp.id,
    tp.user_id,
    p.full_name AS display_name,
    tp.specialty,
    tp.optimized_rate,
    tp.rating,
    tp.review_count,
    tp.latitude,
    tp.longitude,
    tp.is_available,
    p.avatar_url,
    ST_Distance(tp.location_point, ST_MakePoint(lng, lat)::geography) / 1000 AS distance_km
  FROM trainer_profiles tp
  JOIN profiles p ON p.id = tp.user_id
  WHERE tp.location_point IS NOT NULL
    AND ST_DWithin(tp.location_point, ST_MakePoint(lng, lat)::geography, radius_km * 1000)
    AND (specialty_filter IS NULL OR tp.specialty = specialty_filter)
    AND (max_rate IS NULL OR tp.optimized_rate <= max_rate)
    AND (NOT available_only OR tp.is_available = true)
  ORDER BY distance_km ASC;
$$;
```

---

## 3. Trainer Workout Locations Table

### New Table: `trainer_locations`

Trainers operate from multiple locations (gym, park, in-home, etc.). This is a separate table from `trainer_profiles` because:
- A trainer can have 1–N locations
- Each location has a type, name, and coordinates
- The map pins come from this table, not `trainer_profiles`

```sql
-- Migration 24: trainer_locations
CREATE TABLE trainer_locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id      uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  name            text NOT NULL,                          -- e.g. "Equinox Midtown", "Central Park"
  location_type   text NOT NULL CHECK (location_type IN ('gym', 'park', 'outdoor', 'in_home', 'studio', 'other')),
  address         text,
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  location_point  geography(POINT),                       -- for spatial queries
  is_primary      boolean NOT NULL DEFAULT false,         -- shown first in profile
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trainer_locations_trainer_id ON trainer_locations(trainer_id);
CREATE INDEX idx_trainer_locations_geo ON trainer_locations USING GIST (location_point);

-- Constraint: at most one primary location per trainer
CREATE UNIQUE INDEX idx_trainer_locations_primary
  ON trainer_locations(trainer_id) WHERE is_primary = true;
```

**RLS policies needed:**
- Trainers can INSERT/UPDATE/DELETE their own locations (trainer_id = auth.uid() via trainer_profiles)
- Anyone can SELECT active locations (public read for map)

**Map pin data source:** The map view queries `trainer_locations` (one pin per active location) joined to `trainer_profiles` for the popup card data. Multiple locations per trainer appear as separate pins; clustering groups them visually.

---

## 4. Availability Toggle State

### Recommendation: Columns on `trainer_profiles` — Not a Separate Table

The availability toggle is a scalar property of the trainer, not a time-series or event log. Two columns on `trainer_profiles` are sufficient:

```sql
-- Already in Migration 23 above
ALTER TABLE trainer_profiles
  ADD COLUMN is_available boolean NOT NULL DEFAULT false,
  ADD COLUMN available_until timestamptz;  -- NULL = no auto-off timer
```

**Sleep timer behavior:** When a trainer sets a timer (e.g., 2 hours), `available_until = now() + interval '2 hours'`. A pg_cron job runs every 5 minutes and sets `is_available = false` for trainers where `available_until < now()`.

```sql
-- pg_cron: auto-expire availability
SELECT cron.schedule(
  'expire-trainer-availability',
  '*/5 * * * *',
  $$
    UPDATE trainer_profiles
    SET is_available = false, available_until = NULL
    WHERE is_available = true
      AND available_until IS NOT NULL
      AND available_until < now();
  $$
);
```

### Real-Time Map Updates via Supabase Realtime

The map view subscribes to changes on `trainer_profiles` filtered to the `is_available` column. The critical requirement: set `REPLICA IDENTITY FULL` on `trainer_profiles` so that Realtime can filter on `is_available` (non-primary key column).

```sql
ALTER TABLE trainer_profiles REPLICA IDENTITY FULL;
```

```typescript
// src/hooks/useTrainerAvailabilityRealtime.ts
// Subscribes to trainer_profiles UPDATE events in the map viewport area
// When is_available changes, updates pin color/state in MapView

supabase
  .channel('trainer-availability')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'trainer_profiles',
    filter: 'is_available=eq.true'  // Only receive "went online" events
  }, (payload) => {
    // Update map pin for payload.new.id
  })
  .subscribe();
```

**Hook:** `src/hooks/useAvailabilityToggle.ts` — Trainer-facing hook to toggle and set timer. Returns `{ isAvailable, availableUntil, toggle, setTimer }`.

**Component:** `src/components/trainer/AvailabilityToggle.tsx` — Uber-style switch with timer dropdown (30 min, 1h, 2h, 4h, all day, manual-off).

---

## 5. Location-Based Notification Pipeline

### Flow

```
Trainer toggles online
  → trainer_profiles.is_available = true UPDATE
  → pg_cron or DB trigger fires notification check
  → RPC: find_clients_to_notify(trainer_id)
      - Queries client_profiles WHERE notify_on_available = true
        AND ST_DWithin(notify_area_point, trainer location_point, notify_radius_km * 1000)
      - Checks trainer specialty matches client Fitness Passport goals
  → INSERT INTO notifications for each matching client
      type: 'trainer_available_nearby'
      title: 'A trainer is available near you'
      message: '{name} ({specialty}) is available {distance}km away'
      link: '/trainers/{trainer_id}'
  → Existing useNotifications() hook delivers in-app notification
  → Optionally: call send-notification-email Edge Function
```

### New `client_profiles` Columns

```sql
ALTER TABLE client_profiles
  ADD COLUMN notify_on_available boolean NOT NULL DEFAULT false,
  ADD COLUMN notify_radius_km int NOT NULL DEFAULT 10,
  ADD COLUMN notify_area_lat numeric(10,7),
  ADD COLUMN notify_area_lng numeric(10,7),
  ADD COLUMN notify_area_point geography(POINT);  -- generated from above two
```

### New Edge Function: `location-notify`

Called by a DB trigger on `trainer_profiles` UPDATE (when `is_available` flips from false to true) or by pg_cron. Runs the client proximity check and inserts notifications.

```typescript
// supabase/functions/location-notify/index.ts
// Trigger: trainer_profiles.is_available becomes true
// 1. Find trainer's primary location_point
// 2. Query client_profiles WHERE notify_on_available = true
//    AND ST_DWithin(notify_area_point, trainer_location, radius_meters)
// 3. INSERT into notifications for each client
// 4. Optionally call send-notification-email for clients with email prefs
```

**DB trigger approach (preferred over pg_cron for this):**

```sql
-- Fire Edge Function when trainer goes online
CREATE OR REPLACE FUNCTION notify_clients_on_availability_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_available = true AND (OLD.is_available = false OR OLD.is_available IS NULL) THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/location-notify',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
      body := jsonb_build_object('trainer_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trainer_availability_notify
  AFTER UPDATE OF is_available ON trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION notify_clients_on_availability_change();
```

**Note:** `pg_net` extension (HTTP from SQL) is available on Supabase Pro plans. On free tier, use pg_cron polling every 5 minutes instead of real-time trigger.

---

## 6. AI Matching Algorithm

### Where It Runs: Edge Function — Not Client-Side

Client-side AI (calling Gemini from the browser) would expose the API key and require each client device to hold the model context. The correct approach:

1. Client calls `supabase.functions.invoke('ai-match', { body: { client_id } })`
2. Edge Function reads `client_profiles` (Fitness Passport: goals, workout types, limitations, frequency)
3. Edge Function reads candidate trainers from `trainer_profiles` filtered by basic criteria
4. Edge Function calls Gemini API (`gemini-2.0-flash-lite` — cheapest, sufficient for this use case)
5. Returns ranked list with match scores and reasoning text

### Data Flow

```
Client Dashboard loads
  → useAIMatch(clientId) hook
  → POST /functions/v1/ai-match { client_id }
  → Edge Function:
      a. SELECT client_profiles WHERE user_id = client_id  (Fitness Passport)
      b. SELECT trainer_profiles (top 20 by rating, specialty match)
      c. Build prompt: "Given client goals [...], rank these trainers [...]"
      d. Call Gemini API (gemini-2.0-flash or gemini-2.0-flash-lite)
      e. Parse response: [{ trainer_id, score: 0-100, reasoning: "..." }]
      f. Return ranked list
  → Cache result in client_profiles.ai_match_cache JSONB column (24h TTL)
  → Render AIMatchCard components in ClientDashboard
```

### Caching Strategy

AI calls cost money. Cache results:
```sql
ALTER TABLE client_profiles
  ADD COLUMN ai_match_cache jsonb,
  ADD COLUMN ai_match_cached_at timestamptz;
```

Edge Function checks `ai_match_cached_at` — if within 24 hours, return cached. Invalidate cache when trainer pool changes significantly (new trainers, specialty changes).

### Implementation Pattern

The existing `GEMINI_API_KEY` in `vite.config.ts` is client-side — insecure. Move the key to Supabase Edge Function secrets:

```bash
supabase secrets set GEMINI_API_KEY=AIza...
```

Remove from `vite.config.ts`. The browser never needs the key.

```typescript
// supabase/functions/ai-match/index.ts
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY');
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
  { method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
);
```

**New hook:** `src/hooks/useAIMatch.ts` — Returns `{ matches, loading, refresh }`. Calls the Edge Function, handles 24h cache invalidation.

---

## 7. AI Analytics — RPC Functions for Historical Pattern Analysis

### Where It Runs: Postgres RPCs — Not Edge Functions

Trainer analytics are pattern queries over historical `bookings` and `availability_slots` data. This is aggregate SQL, not LLM inference. Run as Postgres RPCs:

```sql
-- RPC: get_trainer_idle_analysis
-- Returns idle slot patterns by day-of-week and hour block
CREATE OR REPLACE FUNCTION get_trainer_idle_analysis(trainer uuid, weeks_back int DEFAULT 8)
RETURNS TABLE (
  day_of_week int,        -- 0=Sun, 6=Sat
  hour_block  int,        -- 0-23
  total_slots int,
  idle_slots  int,
  idle_rate   float,
  potential_revenue numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    EXTRACT(DOW FROM s.start_time)::int AS day_of_week,
    EXTRACT(HOUR FROM s.start_time)::int AS hour_block,
    COUNT(*) AS total_slots,
    COUNT(*) FILTER (WHERE NOT s.is_booked) AS idle_slots,
    (COUNT(*) FILTER (WHERE NOT s.is_booked))::float / COUNT(*) AS idle_rate,
    SUM(tp.optimized_rate) FILTER (WHERE NOT s.is_booked) AS potential_revenue
  FROM availability_slots s
  JOIN trainer_profiles tp ON tp.id = s.trainer_id
  WHERE s.trainer_id = trainer
    AND s.start_time >= now() - (weeks_back || ' weeks')::interval
    AND s.deleted_at IS NULL
  GROUP BY 1, 2
  ORDER BY idle_rate DESC;
$$;

-- RPC: get_trainer_optimization_score
-- Returns single optimization score 0-100
CREATE OR REPLACE FUNCTION get_trainer_optimization_score(trainer uuid)
RETURNS TABLE (score int, idle_hours float, potential_revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    LEAST(100, ROUND((booked_count::float / NULLIF(total_count, 0)) * 100))::int AS score,
    (total_count - booked_count) * 1.0 AS idle_hours,
    idle_revenue AS potential_revenue
  FROM (
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE is_booked) AS booked_count,
      SUM(tp.optimized_rate) FILTER (WHERE NOT is_booked) AS idle_revenue
    FROM availability_slots s
    JOIN trainer_profiles tp ON tp.id = s.trainer_id
    WHERE s.trainer_id = trainer
      AND s.start_time BETWEEN date_trunc('week', now()) AND date_trunc('week', now()) + interval '7 days'
      AND s.deleted_at IS NULL
  ) sub;
$$;
```

**Discount recommendation:** When idle rate > 40% for a recurring slot, the RPC returns a suggested discount rate. This is computed in SQL (simple math: current rate × 0.8), not AI inference. The `ai-scheduling-concept.md` confirms this is the intended approach — "simple statistics, not ML."

**New hook:** `src/hooks/useTrainerAnalytics.ts` — Calls both RPCs, returns `{ idleAnalysis, optimizationScore, loading }`. Used by TrainerDashboard analytics panel.

---

## 8. Google Calendar OAuth Bidirectional Sync

### Architecture Pattern

The v3.0 architecture already built the `calendar_connections` table and vault pattern for calendar OAuth tokens. v4.0 extends this to support bidirectional sync (write back to Google Calendar when a booking is created/cancelled).

### Token Storage Decision

Supabase Vault stores encrypted secrets per-user:

```sql
-- Existing from v3.0 calendar_connections table
-- vault_secret_id stores the encrypted refresh token UUID
SELECT vault.create_secret(
  'ya29.refresh_token_here',
  'google_calendar_' || trainer_id::text
) AS secret_id;
-- Store returned UUID in calendar_connections.google_vault_id
```

**OAuth scopes needed:**
- Read only (existing v3.0): `https://www.googleapis.com/auth/calendar.readonly`
- Bidirectional (new v4.0): `https://www.googleapis.com/auth/calendar.events`

The `calendar.events` scope requires Google OAuth App Verification for production use (takes 1-4 weeks). Plan for this in timeline.

### Sync Flow

```
IMPORT (External → FitRush, existing from v3.0):
  pg_cron every 15 min → calendar-sync Edge Fn
  → Google Calendar API: list events in next 30 days
  → Block overlapping availability_slots (is_booked = true, blocked_by_calendar = true)

WRITE-BACK (FitRush → External, new v4.0):
  Booking confirmed/cancelled in FitRush
  → DB trigger fires calendar-sync Edge Fn with { action: 'write', booking_id }
  → Edge Fn:
      a. Fetch booking details + trainer + client
      b. Read trainer's Google access token from Vault (refresh if expired)
      c. POST to Google Calendar API: create/update/delete event
      d. Store Google event_id in bookings.calendar_event_id (new column)
      e. Log to calendar_sync_log
```

**New column on `bookings`:**

```sql
ALTER TABLE bookings ADD COLUMN calendar_event_id text;
-- Stores Google Calendar event ID for write-back deletion/update
```

**Modified `calendar_connections`:**

```sql
ALTER TABLE calendar_connections
  ADD COLUMN sync_direction text NOT NULL DEFAULT 'read'
    CHECK (sync_direction IN ('read', 'write', 'both')),
  ADD COLUMN events_written int NOT NULL DEFAULT 0,
  ADD COLUMN last_write_at timestamptz;
```

**Token refresh pattern for write-back:**

```typescript
// supabase/functions/calendar-sync/index.ts
// When access token expires (401 response), use refresh token from Vault:
const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({
    client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
    client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
    refresh_token: vaultSecret,
    grant_type: 'refresh_token',
  }),
});
// Store new access token temporarily (not in Vault — too slow)
// Use it for the current sync run only
```

**New Edge Function secrets needed:**
```bash
supabase secrets set GOOGLE_CLIENT_ID=...
supabase secrets set GOOGLE_CLIENT_SECRET=...
```

---

## 9. Session Notes and Workout Logs Tables

### Design

Two separate tables for different actors and purposes:

```sql
-- Migration 25: session_notes (trainer writes)
CREATE TABLE session_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  trainer_id    uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes         text NOT NULL CHECK (length(notes) <= 2000),
  goals_worked  text[],                    -- tags: ['strength', 'cardio', ...]
  rating_client int CHECK (rating_client BETWEEN 1 AND 5),  -- trainer rates the session
  is_visible_to_client boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: trainers write own notes, clients read notes marked visible
```

```sql
-- Migration 26: workout_logs (client-entered progress tracking)
CREATE TABLE workout_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_note_id uuid REFERENCES session_notes(id) ON DELETE SET NULL,
  -- NULL session_note_id = self-logged (outside a session)
  logged_at     timestamptz NOT NULL DEFAULT now(),
  exercises     jsonb NOT NULL DEFAULT '[]',
  -- [{name: "Squat", sets: 3, reps: 10, weight_kg: 80, notes: "..."}]
  body_weight_kg numeric(5,2),
  mood_score    int CHECK (mood_score BETWEEN 1 AND 5),
  notes         text CHECK (length(notes) <= 500),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for client history queries
CREATE INDEX idx_workout_logs_client_logged ON workout_logs(client_id, logged_at DESC);
```

**Relationship to existing tables:**

- `session_notes.booking_id` → `bookings.id` (one-to-one: one note per session)
- `workout_logs.session_note_id` → `session_notes.id` (optional: logs can be self-entered outside a session)
- Trainer access to `workout_logs`: only via `session_notes` link (trainer can see logs that reference their sessions)

**UI trigger:** After a booking's status changes to `completed`, the trainer sees a "Add Session Notes" prompt in their dashboard. The client sees a "Log Workout" prompt in their booking history.

---

## 10. Email Subscribers Table

### Design

Simple table for landing page email capture. Minimal complexity — direct Supabase insert from client-side.

```sql
-- Migration 27: email_subscribers
CREATE TABLE email_subscribers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  source     text NOT NULL DEFAULT 'landing_waitlist',  -- for future A/B attribution
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  confirmed  boolean NOT NULL DEFAULT false,  -- for future double opt-in
  user_id    uuid REFERENCES profiles(id) ON DELETE SET NULL
  -- user_id populated if subscriber later creates an account
);

CREATE INDEX idx_email_subscribers_email ON email_subscribers(email);
```

**RLS policy:** Public INSERT (no auth required), no SELECT/UPDATE from client. Service role only for admin queries.

```sql
-- RLS
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
  ON email_subscribers FOR INSERT
  WITH CHECK (true);  -- Validate email format in application layer

-- No SELECT policy for anon — admin reads via service role only
```

**Component:** Add `EmailCaptureBox` section to `src/pages/Landing.tsx`. Direct `supabase.from('email_subscribers').insert({ email })` call. No Edge Function needed.

**Zod validation:**
```typescript
// Add to src/lib/schemas.ts (existing Zod schema file)
export const EmailCaptureSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
});
```

---

## Recommended Project Structure (v4.0 additions)

```
src/
├── components/
│   ├── map/                   # New
│   │   ├── MapView.tsx              # Map container with search overlay
│   │   ├── TrainerMarker.tsx        # AdvancedMarker with trainer popup
│   │   ├── TrainerMarkerCluster.tsx # Clustering wrapper
│   │   └── LocationSearch.tsx       # Places Autocomplete input
│   ├── trainer/               # Extended
│   │   ├── AvailabilityManager.tsx  # Existing
│   │   ├── AvailabilityToggle.tsx   # New — online/offline + sleep timer
│   │   ├── SessionNoteForm.tsx      # New — post-session notes
│   │   ├── TrainerLocationManager.tsx # New — workout location CRUD
│   │   └── AIAnalyticsPanel.tsx     # New — idle analysis + optimization score
│   ├── client/                # Extended
│   │   ├── AIMatchCard.tsx          # New — AI match score + reasoning
│   │   ├── WorkoutLogEntry.tsx      # New — log exercises, mood, weight
│   │   └── LocationPreferences.tsx  # New — notify radius + area picker
│   ├── calendar/              # Extended (from v3.0)
│   │   ├── CalendarSyncBanner.tsx   # Existing
│   │   ├── CalendarSyncStatus.tsx   # Existing
│   │   ├── ExportBookingsButton.tsx # Existing
│   │   └── CalendarWriteSettings.tsx # New — bidirectional sync controls
│   └── landing/               # Extended
│       └── EmailCaptureBox.tsx      # New — waitlist signup
├── hooks/
│   ├── useTrainers.ts         # Extended — add geo search params
│   ├── useAvailabilityToggle.ts # New — trainer online/offline state
│   ├── useTrainerLocations.ts # New — CRUD for trainer_locations
│   ├── useAIMatch.ts          # New — AI matching Edge Function call
│   ├── useTrainerAnalytics.ts # New — idle analysis + optimization RPCs
│   ├── useSessionNotes.ts     # New — trainer session notes CRUD
│   ├── useWorkoutLogs.ts      # New — client workout log CRUD
│   └── useTrainerAvailabilityRealtime.ts # New — Realtime map updates
├── pages/
│   ├── MapView.tsx            # New route: /map
│   └── ...existing pages extended...
└── supabase/
    └── functions/
        ├── ai-match/          # New Edge Function
        │   └── index.ts
        ├── location-notify/   # New Edge Function
        │   └── index.ts
        └── calendar-sync/     # Extend for write-back
            └── index.ts
```

---

## Build Order (Dependency-First)

Features have dependencies — this is the recommended build sequence:

```
Phase A: Foundation (no dependencies on v4 features)
  1. Email capture (email_subscribers table + EmailCaptureBox)
     → Standalone, delivers marketing value immediately
  2. PostGIS setup + trainer_profiles columns (is_available, location_point)
     → Required by Map, Toggle, and Notifications

Phase B: Location Layer (depends on Phase A PostGIS)
  3. Trainer locations table + TrainerLocationManager
     → Required for map pins
  4. Google Maps integration (MapView + TrainerMarker + cluster)
     → Depends on trainer_locations data existing
  5. Availability toggle (AvailabilityToggle + pg_cron auto-expire)
     → Depends on is_available column (Phase A)

Phase C: Intelligence Layer (depends on Phase B data)
  6. AI Analytics (RPCs + AIAnalyticsPanel)
     → Depends on booking history existing (already exists from v1.0+)
     → No external API — pure SQL, safe to build early
  7. AI Matching (ai-match Edge Function + AIMatchCard)
     → Depends on client Fitness Passport (already exists from v3.0)
     → Gemini API key must be in Edge Function secrets (not vite.config)

Phase D: Session Layer (depends on booking completion flow)
  8. Session notes (session_notes table + SessionNoteForm)
     → Depends on bookings.status = 'completed' trigger
  9. Workout logs (workout_logs table + WorkoutLogEntry)
     → Depends on session_notes existing

Phase E: Notifications & Calendar (depends on Phase B + existing calendar)
  10. Location-based notifications (client_profiles columns + location-notify Edge Fn)
      → Depends on PostGIS (Phase A), trainer toggle (Phase B), notifications (existing)
  11. Google Calendar write-back (extend calendar-sync + CalendarWriteSettings)
      → Depends on existing calendar_connections table from v3.0
      → Requires Google OAuth app verification — start verification EARLY
```

---

## Patterns to Follow

### Pattern 1: Geo-Aware `useTrainers` Hook Extension

Do not create a separate `useTrainersGeo` hook. Extend the existing `useTrainers` options object:

```typescript
// src/hooks/useTrainers.ts — extend existing options
interface UseTrainersOptions {
  specialty?: string;
  maxRate?: number;
  location?: string;
  // NEW v4.0 geo options:
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  availableOnly?: boolean;
}
// When centerLat/Lng/radiusKm provided → call search_trainers_geo RPC
// Otherwise → existing query (backward compatible)
```

### Pattern 2: Realtime Map Subscription with Bounded Area

Do not subscribe to all trainer_profiles changes globally — only changes within the current map viewport:

```typescript
// src/hooks/useTrainerAvailabilityRealtime.ts
// Filter: only trainers whose IDs are currently shown on the map
// Re-subscribe when map viewport changes (debounced)
supabase.channel(`trainer-availability-${viewportHash}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'trainer_profiles',
  }, handleAvailabilityChange)
  .subscribe();
// Client filters payload by trainer IDs in current viewport
```

### Pattern 3: Gemini Prompt Design for Matching

The AI match is rule-based scoring narrated by LLM — not pure LLM ranking. Compute the score in SQL first, then use Gemini only for the reasoning text:

```typescript
// In ai-match Edge Function:
// 1. Compute score in SQL (specialty match, rating, price range, etc.)
// 2. Pass top 5 ranked trainers to Gemini with client profile
// 3. Prompt: "Write a 1-sentence explanation of why trainer X is a good match
//    for a client with goals: [goals], limitations: [limitations]"
// 4. Gemini returns reasoning text only — not the ranking decision
// This keeps cost minimal (~100 tokens per explanation) and deterministic
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Gemini API Key

**What:** Exposing `GEMINI_API_KEY` in the browser bundle via Vite `define`.
**Why bad:** Any user can extract the key from DevTools. It gets scraped and abused.
**Instead:** Move to Edge Function secrets only. Remove from `vite.config.ts`.

### Anti-Pattern 2: Plain lat/lng for Distance Queries

**What:** Querying `trainer_profiles WHERE latitude BETWEEN ... AND longitude BETWEEN ...` for radius search.
**Why bad:** Bounding box is not a circle. Haversine in raw SQL is slow without spatial index. Cannot sort by distance efficiently.
**Instead:** PostGIS `geography(POINT)` + GIST index + `ST_DWithin` + `ST_Distance`.

### Anti-Pattern 3: Global Realtime Subscription for Map Updates

**What:** Subscribe to all trainer_profiles changes and filter client-side.
**Why bad:** At 1000 trainers, every status change hits every connected client. Realtime connection overhead scales poorly.
**Instead:** Subscribe to changes for trainer IDs in current viewport only. Unsubscribe on viewport change.

### Anti-Pattern 4: Separate AI Model for Analytics

**What:** Using Gemini/GPT-4 for idle pattern analysis ("which slots are consistently idle").
**Why bad:** This is aggregate SQL — no LLM needed. Adds latency, cost, and hallucination risk.
**Instead:** Postgres RPCs with GROUP BY day_of_week, EXTRACT(HOUR). Deterministic, fast, free.

### Anti-Pattern 5: Polling for Calendar Write-Back Confirmation

**What:** Polling Google Calendar API to verify write-back succeeded.
**Why bad:** Quota usage and latency. Google Calendar writes are synchronous — the API returns the event ID immediately on success.
**Instead:** Treat the HTTP 200 + event_id in the response as confirmation. Log failures to `calendar_sync_log` for retry.

---

## Database Schema Changes Summary

### New Tables (v4.0)

| Table | Migration | Purpose | Key Columns |
|-------|-----------|---------|-------------|
| `trainer_locations` | 23 | Workout location pins for map | `trainer_id`, `location_type`, `location_point`, `is_primary` |
| `session_notes` | 24 | Post-session trainer notes | `booking_id`, `notes`, `goals_worked`, `is_visible_to_client` |
| `workout_logs` | 25 | Client progress tracking | `client_id`, `session_note_id`, `exercises JSONB`, `body_weight_kg` |
| `email_subscribers` | 26 | Landing page waitlist | `email`, `source`, `confirmed`, `user_id` |
| `demand_signals` | 27 (optional, future) | Search demand heatmap | `geo_hash`, `day_of_week`, `hour_block`, `demand_score` |

### Modified Tables (v4.0 additive columns)

| Table | New Columns | Purpose |
|-------|-------------|---------|
| `trainer_profiles` | `is_available BOOL`, `available_until TIMESTAMPTZ`, `location_point GEOGRAPHY` | Availability toggle + geo search |
| `client_profiles` | `notify_on_available BOOL`, `notify_radius_km INT`, `notify_area_point GEOGRAPHY`, `ai_match_cache JSONB`, `ai_match_cached_at TIMESTAMPTZ` | Location notifications + AI match cache |
| `bookings` | `calendar_event_id TEXT` | Google Calendar write-back event ID |
| `calendar_connections` | `sync_direction TEXT`, `events_written INT`, `last_write_at TIMESTAMPTZ` | Bidirectional sync tracking |

### New RPCs

| Function | Purpose | Called By |
|----------|---------|-----------|
| `search_trainers_geo(lat, lng, radius_km, ...)` | Geo-filtered trainer search | `useTrainers` hook (extended) |
| `get_trainer_idle_analysis(trainer, weeks_back)` | Idle slot patterns by day/hour | `useTrainerAnalytics` hook |
| `get_trainer_optimization_score(trainer)` | Weekly optimization score 0-100 | `useTrainerAnalytics` hook |
| `find_clients_to_notify(trainer_id)` | Proximity-matched clients for availability alerts | `location-notify` Edge Function |

### New Edge Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `ai-match` | Gemini-powered trainer recommendations | Client Dashboard load |
| `location-notify` | Insert proximity notifications | DB trigger on `is_available` UPDATE |
| `calendar-sync` (extended) | Add write-back to Google Calendar | DB trigger on booking confirmed/cancelled |

### New pg_cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `expire-trainer-availability` | `*/5 * * * *` | Auto-expire sleep timer |
| `location-notify-poll` | `*/5 * * * *` | Fallback for free tier (no pg_net) |
| `weekly-analytics` | `0 9 * * MON` | Aggregate demand signals |

---

## New Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_GOOGLE_MAPS_API_KEY` | `.env.local` (Vite) | Google Maps JS API (browser) |
| `GOOGLE_CLIENT_ID` | Supabase Edge Function secrets | Google Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | Supabase Edge Function secrets | Google Calendar OAuth |
| `GEMINI_API_KEY` | Supabase Edge Function secrets | AI matching (move from vite.config) |

---

## Scalability Considerations

| Concern | At 100 trainers | At 10K trainers |
|---------|-----------------|-----------------|
| Map pins | Direct query is fine | Cluster server-side (PostGIS grid), paginate by viewport |
| Realtime subscriptions | Per-viewport subscription fine | Same approach — viewport bounds limit data |
| AI match calls | Gemini calls per load are acceptable | Add server-side cache + CDN; consider pgvector embeddings instead |
| Location notifications | Sync trigger per availability toggle | Rate-limit to 1 notification per client per 30 min |
| Google Calendar sync | 15-min polling fine | Consider push channels (7-day renewal) at scale |

---

## Sources

- PostGIS geo queries: [Supabase PostGIS Docs](https://supabase.com/docs/guides/database/extensions/postgis)
- Distance-based filtering: [Supabase blog — PostGIS distance queries](https://blog.mansueli.com/leveraging-supabase-and-postgresql-for-distance-based-filtering-and-location-data-retrieval)
- React Google Maps library: [vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/docs/get-started)
- Marker clustering: [vis.gl marker clustering example](https://visgl.github.io/react-google-maps/examples/marker-clustering)
- Supabase Realtime Postgres Changes: [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime/postgres-changes)
- Supabase Realtime filter requirements: [Postgres Changes filter docs](https://supabase.com/docs/guides/realtime/postgres-changes)
- Google Calendar OAuth scopes: [Google Calendar API auth](https://developers.google.com/calendar/api/auth)
- Google Calendar bidirectional sync patterns: [CalendHub 2025](https://calendhub.com/blog/implement-bidirectional-calendar-sync-2025/)
- Supabase AI + Edge Functions: [Supabase AI docs](https://supabase.com/docs/guides/ai)
- Gemini API integration: [Supabase + AI examples](https://scaleupally.io/blog/building-ai-app-with-supabase/)
- Existing v3.0 calendar architecture: `.planning/research/ARCHITECTURE.md`
- AI scheduling concept: `docs/ai-scheduling-concept.md`
- Codebase architecture: `.planning/codebase/ARCHITECTURE.md`
- Codebase integrations: `.planning/codebase/INTEGRATIONS.md`
