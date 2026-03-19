---
phase: 23-map-view-trainer-locations
plan: "02"
subsystem: trainer-locations
tags: [locations, maps, go-live, trainer, google-maps, places-autocomplete]
dependency_graph:
  requires: [23-01]
  provides: [useWorkoutLocations, WorkoutLocationsManager, GoLiveLocationPicker]
  affects: [AvailabilityHeader, TrainerProfile, useAvailabilitySession]
tech_stack:
  added: []
  patterns:
    - useMapsLibrary('places') for Places Autocomplete in @vis.gl/react-google-maps
    - Draggable AdvancedMarker for pin fine-tuning after address selection
    - Modal overlay with body scroll lock for Go Live flow interruption
key_files:
  created:
    - "Cenlar demand gt 1-17/src/hooks/useWorkoutLocations.ts"
    - "Cenlar demand gt 1-17/src/components/trainer/WorkoutLocationsManager.tsx"
    - "Cenlar demand gt 1-17/src/components/trainer/GoLiveLocationPicker.tsx"
  modified:
    - "Cenlar demand gt 1-17/src/hooks/useAvailabilitySession.ts"
    - "Cenlar demand gt 1-17/src/components/trainer/AvailabilityHeader.tsx"
    - "Cenlar demand gt 1-17/src/pages/TrainerProfile.tsx"
decisions:
  - "pendingLocationId state added to AvailabilityHeader for spec compliance; not rendered in JSX but tracks last-selected locationId"
  - "WorkoutLocationsManager wrapped in APIProvider with libraries=['places'] per @vis.gl/react-google-maps requirement"
  - "GoLiveLocationPicker rendered outside header div using Fragment — location picker is a portal-style overlay, not a child of the sticky header"
metrics:
  duration: "~4 minutes"
  completed: "2026-03-19"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Phase 23 Plan 02: Trainer Location Management System Summary

Trainer workout location CRUD with Places Autocomplete address entry, draggable map pin, and Go Live location picker that writes `active_location_id` to `trainer_profiles`.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | useWorkoutLocations hook, WorkoutLocationsManager, TrainerProfile | 75a8174 | useWorkoutLocations.ts, WorkoutLocationsManager.tsx, TrainerProfile.tsx |
| 2 | GoLiveLocationPicker + AvailabilityHeader integration | a1e3a91 | GoLiveLocationPicker.tsx, AvailabilityHeader.tsx, useAvailabilitySession.ts |

## What Was Built

**useWorkoutLocations hook** (`src/hooks/useWorkoutLocations.ts`):
- CRUD operations: `addLocation`, `updateLocation`, `deleteLocation`, `refetch`
- `canAddMore` guard (`locations.length < 5`)
- P0001 error code handling for `check_location_limit` DB trigger → human-readable "Maximum 5 workout locations allowed"
- Auto-fetch on mount when `trainerId` prop provided via `useEffect`

**WorkoutLocationsManager component** (`src/components/trainer/WorkoutLocationsManager.tsx`):
- Wrapped in `APIProvider` with `libraries={['places']}`
- Places Autocomplete via `useMapsLibrary('places')` + `AutocompleteSuggestion.fetchAutocompleteSuggestions` (debounced 300ms, min 3 chars)
- On suggestion select: `toPlace().fetchFields({ fields: ['location', 'formattedAddress'] })` for lat/lng
- Map preview at 200px height with draggable `AdvancedMarker` — `onDragEnd` updates `editCoords`
- Location type toggle (Gym/Park/In-Home) with `PIN_COLORS` background on selected
- Nickname input with `maxLength={40}`
- Delete confirmation with "Remove this location? This cannot be undone." copy
- Max-5 enforcement: button disabled with "Maximum 5 locations reached" tooltip
- Empty state: "No locations saved. Add your first workout spot."

**GoLiveLocationPicker component** (`src/components/trainer/GoLiveLocationPicker.tsx`):
- Fixed inset-0 z-[60] modal overlay with `backdrop-blur-sm`
- Heading: "Where are you training today?"
- Selectable location cards with type icons colored by `PIN_COLORS`
- "Go Live Here" button disabled until location selected
- Empty state: "Add a workout location first" with link to `/trainer/profile`
- Body scroll lock via `document.body.style.overflow = 'hidden'` on mount

**useAvailabilitySession modifications** (`src/hooks/useAvailabilitySession.ts`):
- `goLive` signature extended: `(mode, timer, locationId?: string)`
- `goLive` DB update includes `active_location_id: locationId ?? null`
- `goOffline` DB update includes `active_location_id: null`

**AvailabilityHeader modifications** (`src/components/trainer/AvailabilityHeader.tsx`):
- Added `GoLiveLocationPicker` import
- `showLocationPicker` and `pendingLocationId` state added
- `handleToggle` offline branch now calls `setShowLocationPicker(true)` instead of directly calling `goLive`
- `handleLocationSelect` callback: sets locationId, closes picker, calls `goLive` with three args
- `GoLiveLocationPicker` rendered conditionally in a Fragment alongside the header div

**TrainerProfile modifications** (`src/pages/TrainerProfile.tsx`):
- Imports `WorkoutLocationsManager`
- Renders it guarded by `trainerProfile?.id && trainer.user_id === user?.id`

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `useWorkoutLocations` exports verified
- `WorkoutLocationsManager` contains all required acceptance criteria (APIProvider, useMapsLibrary, AutocompleteSuggestion, draggable AdvancedMarker, type buttons, maxLength, tooltip, confirm text)
- `GoLiveLocationPicker` contains all required strings and exports
- `useAvailabilitySession.ts` goLive and goOffline both manage `active_location_id`
- `AvailabilityHeader.tsx` imports and renders `GoLiveLocationPicker` with `showLocationPicker` state
- Test suite: 70 tests pass, 1 pre-existing failure in `AdminDashboard.test.tsx` (unrelated to this plan)

## Self-Check: PASSED
