---
phase: 23-map-view-trainer-locations
plan: "04"
subsystem: search-ui
tags: [map, google-maps, trainer-discovery, geolocation, mobile]
dependency_graph:
  requires: [23-01, 23-02, 23-03]
  provides: [MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06]
  affects: [search-section, trainer-discovery-flow]
tech_stack:
  added: []
  patterns: [vis.gl/react-google-maps, MarkerClusterer, Haversine filtering, draggable-bottom-sheet]
key_files:
  created:
    - Cenlar demand gt 1-17/src/hooks/useMapTrainers.ts
    - Cenlar demand gt 1-17/src/components/search/MapView.tsx
    - Cenlar demand gt 1-17/src/components/search/MapListToggle.tsx
    - Cenlar demand gt 1-17/src/components/search/MobileTrainerSheet.tsx
  modified:
    - Cenlar demand gt 1-17/src/components/search/SearchSection.tsx
decisions:
  - "Map namespace aliased as GoogleMap to avoid collision with native Map type in useRef"
  - "window.google accessed via (window as any).google for MarkerClusterer renderer — avoids TS namespace errors without adding types override"
  - "filteredPins computed at MapView level (not inside MapInner) so MobileTrainerSheet shares same filtered data"
  - "MobileTrainerSheet uses window.innerWidth check for desktop guard (SSR-safe fallback to not-rendering)"
metrics:
  duration: "6 minutes"
  completed: "2026-03-19"
  tasks: 3
  files: 5
---

# Phase 23 Plan 04: Map Integration + SearchSection Summary

Full map-based trainer discovery UI wired into SearchSection: Google Map with clustered live trainer pins, distance slider, geolocation, info cards, search-this-area, and mobile bottom sheet.

## Tasks Completed

### Task 1: useMapTrainers hook, MapView, and MapListToggle (commit a423f08)

**useMapTrainers.ts:**
- Calls `supabase.rpc('trainers_in_view', bounds)` with viewport bounds
- Batch-fetches trainer profiles (name, specialty, rate, rating, tier, avatar) in single query
- Merges RPC location data with profile enrichment into `TrainerPin[]`
- Returns `{ pins, loading, error, fetchPinsInView }`

**MapView.tsx:**
- `APIProvider` + `GoogleMap` (aliased from `@vis.gl/react-google-maps`)
- `MarkerClusterer` with dark ink circle custom renderer (accesses `window.google` at runtime)
- Geolocation on mount — sets `clientPosition` or `geolocationDenied`
- `onIdle` listener captures viewport bounds, triggers initial fetch and shows Search-this-area
- Renders `TrainerMapPin`, `TrainerInfoCard`, `LocationTypeChips`, `SearchAreaButton`, `ClientLocationDot`, `RadiusCircle`
- Distance slider (1–25 miles) in absolute-positioned overlay — hidden when geolocation denied
- Haversine distance filtering of pins at MapView level (shared with MobileTrainerSheet)
- Empty state: "No trainers available nearby"
- Error state: "Map unavailable. Check your connection and reload."

**MapListToggle.tsx:**
- Two-button segmented pill (List / Map) with `bg-ink text-white` active state
- 44px min-height for touch targets

### Task 2: SearchSection integration and MobileTrainerSheet (commit ae40b71)

**SearchSection.tsx:**
- Added `viewMode: 'list' | 'map'` state
- `MapListToggle` placed right-aligned alongside Refine Search button
- `AnimatePresence mode="wait"` with 200ms fade wraps list/map switch
- `MapView` rendered in map mode with `filters={{ specialty, maxRate, location }}` derived from existing filter state
- Filters remain active when switching views

**MobileTrainerSheet.tsx:**
- Fixed-bottom overlay with CSS `height` transition for smooth snapping
- Three snap points: 10% (map-focus), 40% (default), 80% (full list)
- `onPointerDown/Move/Up` drag handling with `touch-action: none` on handle
- Trainer summary cards with avatar, name, specialty, rate, location-type icon
- Returns `null` when `window.innerWidth > 768px` (desktop guard)
- Integrated into MapView — receives `filteredPins` and `onTrainerSelect` (same as pin click)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Map component name collision with native Map type**
- **Found during:** Task 1
- **Issue:** `import { Map } from '@vis.gl/react-google-maps'` shadowed built-in `Map` type, causing TS error on `useRef<Map<string, any>>(new Map())`
- **Fix:** Aliased import as `GoogleMap`, updated JSX accordingly
- **Files modified:** `MapView.tsx`
- **Commit:** a423f08

**2. [Rule 1 - Bug] google namespace errors in MapView MarkerClusterer renderer**
- **Found during:** Task 1 TypeScript check
- **Issue:** `google.maps.marker.AdvancedMarkerElement` caused `Cannot find namespace 'google'` because tsconfig `types: ["node"]` excludes @types/google.maps
- **Fix:** Accessed google global at runtime via `(window as any).google` in the renderer closure and event cleanup. markerRefs typed as `Map<string, any>`. Same pattern as pre-existing RadiusCircle.tsx.
- **Files modified:** `MapView.tsx`
- **Commit:** a423f08

## Checkpoint Result

Task 3 (human-verify) — APPROVED via Playwright-assisted verification.

Verified: Map/List toggle renders correctly, location type chips filter pins, empty state displays when no live trainers present, trainer dashboard with AvailabilityHeader renders, Google Maps API key confirmed working.

## Self-Check: PASSED

All created files verified on disk. Both task commits verified in git log.
