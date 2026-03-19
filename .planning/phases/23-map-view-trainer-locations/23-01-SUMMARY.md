---
phase: 23-map-view-trainer-locations
plan: 01
subsystem: database + types + testing-infrastructure
tags: [postgis, spatial-queries, typescript-types, vitest-mocks, google-maps]
dependency_graph:
  requires: []
  provides: [workout_locations-table, trainers_in_view-rpc, map-types, google-maps-mock]
  affects: [23-02-TrainerMapView, 23-03-LocationManager, 23-04-LiveTrainerSearch]
tech_stack:
  added: ["@vis.gl/react-google-maps@1.7.1", "@googlemaps/markerclusterer@2.6.2"]
  patterns: [postgis-geography, generated-columns, rls-policies, vitest-mocks]
key_files:
  created:
    - "Cenlar demand gt 1-17/supabase/migrations/20260319100000_map_trainer_locations.sql"
    - "Cenlar demand gt 1-17/src/types/map.ts"
    - "Cenlar demand gt 1-17/src/__mocks__/@vis.gl/react-google-maps.ts"
  modified:
    - "Cenlar demand gt 1-17/package.json"
    - "Cenlar demand gt 1-17/src/types/supabase.ts"
decisions:
  - "geo_point column omitted from TS types — GENERATED ALWAYS column is server-side only"
  - "PostGIS enabled in extensions schema (not public) — Supabase standard pattern"
  - "trainers_in_view uses SET search_path TO '' for security — all refs fully schema-qualified"
  - "workout_locations table positioned before booking_requests in supabase.ts for logical ordering"
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 23 Plan 01: Map Foundation — DB, Types, and Mocks Summary

**One-liner:** PostGIS migration with workout_locations table, trainers_in_view bounding-box RPC, and TypeScript types for map features — foundation for all Phase 23 map UI work.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install map packages and create PostGIS migration | 372b429 | package.json, 20260319100000_map_trainer_locations.sql |
| 2 | Extend TypeScript types and create Google Maps mock | 163218a | supabase.ts, map.ts, react-google-maps.ts mock |

## What Was Built

### PostGIS Migration (`20260319100000_map_trainer_locations.sql`)

- **PostGIS enabled** in `extensions` schema (Supabase standard)
- **`workout_locations` table**: UUID PK, trainer_id FK (cascade delete), address, lat/lng doubles, location_type CHECK constraint (`'gym' | 'park' | 'in-home'`), generated `geo_point geography(POINT, 4326)` column
- **GIST spatial index** on `geo_point` for fast bounding-box queries
- **Max-5 locations trigger** (`check_location_limit`) enforced at DB level via BEFORE INSERT trigger
- **`active_location_id` FK** added to `trainer_profiles` pointing to active workout location
- **`trainers_in_view` RPC**: takes min_lat/min_lng/max_lat/max_lng bounding box, joins live trainers to their active location, returns trainer_id/lat/lng/location_type/nickname — `SET search_path TO ''` for security
- **RLS policies**: trainers manage own rows; anyone can read (for map display)
- **GRANT EXECUTE** to `authenticated` and `anon` on trainers_in_view

### TypeScript Types (`src/types/supabase.ts`)

- Added `workout_locations` table with Row/Insert/Update (geo_point omitted — server-only)
- Added `active_location_id: string | null` to trainer_profiles Row, Insert, Update
- Added `trainers_in_view` to Functions with typed Args and Returns array

### Shared Map Types (`src/types/map.ts`)

- `LocationType` union: `'gym' | 'park' | 'in-home'`
- `WorkoutLocation` interface matching DB Row
- `TrainerPin` interface for client-side enriched map markers (includes optional name, rate, discountedRate, rating, avatarUrl, subscriptionTier, bookingMode, isLive)
- `MapBounds` interface (north/south/east/west)
- `PIN_COLORS` record: gym=#2563EB, park=#16A34A, in-home=#D97706
- `LA_DEFAULT` center: `{ lat: 34.0522, lng: -118.2437 }`

### Google Maps Mock (`src/__mocks__/@vis.gl/react-google-maps.ts`)

- `APIProvider`, `Map`, `AdvancedMarker` React components with `data-testid` attributes for test targeting
- `useMap` and `useMapsLibrary` stubs returning null
- Enables jsdom-based vitest testing without real Google Maps API

## Deviations from Plan

None — plan executed exactly as written.

## Test Suite Status

Pre-existing `AdminDashboard.test.tsx` failure (1 test checking for specific CSS grid class) was present before these changes and is out of scope. All 70 other tests pass.

## Self-Check: PASSED

- `/Users/xfiles/Desktop/FitConnect/.claude/worktrees/kind-pike/Cenlar demand gt 1-17/supabase/migrations/20260319100000_map_trainer_locations.sql` — EXISTS
- `/Users/xfiles/Desktop/FitConnect/.claude/worktrees/kind-pike/Cenlar demand gt 1-17/src/types/map.ts` — EXISTS
- `/Users/xfiles/Desktop/FitConnect/.claude/worktrees/kind-pike/Cenlar demand gt 1-17/src/__mocks__/@vis.gl/react-google-maps.ts` — EXISTS
- Commit 372b429 — FOUND
- Commit 163218a — FOUND
