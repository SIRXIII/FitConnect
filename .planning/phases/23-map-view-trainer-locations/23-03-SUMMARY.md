---
phase: 23-map-view-trainer-locations
plan: "03"
subsystem: map-components
tags: [map, google-maps, vis-gl, components, trainer-pins]
dependency_graph:
  requires: [23-01]
  provides: [TrainerMapPin, TrainerInfoCard, LocationTypeChips, SearchAreaButton, ClientLocationDot, RadiusCircle]
  affects: [23-04-MapView]
tech_stack:
  added: []
  patterns: [AdvancedMarker, imperative-google-maps-circle, framer-motion-animate-presence]
key_files:
  created:
    - Cenlar demand gt 1-17/src/components/map/TrainerMapPin.tsx
    - Cenlar demand gt 1-17/src/components/map/TrainerInfoCard.tsx
    - Cenlar demand gt 1-17/src/components/map/LocationTypeChips.tsx
    - Cenlar demand gt 1-17/src/components/map/SearchAreaButton.tsx
    - Cenlar demand gt 1-17/src/components/map/ClientLocationDot.tsx
    - Cenlar demand gt 1-17/src/components/map/RadiusCircle.tsx
  modified: []
decisions:
  - TrainerInfoCard rendered as AdvancedMarker (not floating div) to stay anchored to map coordinates via vis.gl lifecycle
  - RadiusCircle uses imperative google.maps.Circle with useEffect/useRef — no JSX return, cleanup on unmount and when visible=false
  - Teardrop pin shape uses CSS border-radius 50% 50% 50% 0 + rotate(-45deg) with inner icon rotated back 45deg for reliability in Google Maps DOM
  - ScrollbarHide applied to LocationTypeChips via overflow-x-auto — scrollbar-hide utility class used for cross-browser scrollbar hiding
metrics:
  duration: "~2 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 23 Plan 03: Map Sub-Components Summary

**One-liner:** Six map sub-components — teardrop AdvancedMarker pins with elite/live badges, floating info card with Book Now, location type chip filters, search-this-area button, client dot, and radius circle overlay.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TrainerMapPin and TrainerInfoCard components | 4a5aa2d | TrainerMapPin.tsx, TrainerInfoCard.tsx |
| 2 | LocationTypeChips, SearchAreaButton, ClientLocationDot, RadiusCircle | 9464f5f | LocationTypeChips.tsx, SearchAreaButton.tsx, ClientLocationDot.tsx, RadiusCircle.tsx |

## What Was Built

**TrainerMapPin** — Custom `AdvancedMarker` rendering a teardrop-shaped pin (28x36px, `border-radius: 50% 50% 50% 0`, rotated -45deg) with:
- Location-type color from `PIN_COLORS` (blue-600 gym, green-600 park, amber-600 in-home)
- Inner icon (Dumbbell/Leaf/Home) rotated back 45deg to stay upright
- 44x44px minimum tap target wrapper
- Elite tier: `#C5A059` gold border + Crown badge (size=10, absolute top-right)
- Live status: `animate-pulse` green-500 dot (8px, absolute bottom-right)
- Selected state: `scale(1.15)` transform, `zIndex=100`

**TrainerInfoCard** — `AdvancedMarker` at same coordinates with `zIndex=200`, card offset above pin via `translateY(-100%) translateY(-8px)`:
- Avatar (40x40 rounded-full), serif name, specialty label
- Rate display: discounted rate with crossed-out original (`line-through`) or plain rate
- Rating with filled accent Star + review count
- `LiveNowBadge` and `BookingModeBadge` conditional rendering
- Location type icon + label
- "Book Now" button navigates to `/book/:trainerId`

**LocationTypeChips** — Horizontal flex row with All/Gym/Park/In-Home chips:
- Selected chip: `PIN_COLORS[type]` background or `#1A1A1A` for "All", white text
- Unselected chip: `bg-paper border border-ink/10 text-ink/60`
- `overflow-x-auto scrollbar-hide`, `min-h-[44px]` touch targets

**SearchAreaButton** — Framer Motion `motion.button` with `AnimatePresence`:
- `initial={{ opacity: 0, y: -10 }}` / `animate={{ opacity: 1, y: 0 }}`
- Absolute centered top-4 with z-10, renders only when `visible=true`
- Loading state: "Searching..." text + `opacity-60 cursor-not-allowed`

**ClientLocationDot** — `AdvancedMarker` with concentric circles:
- Outer: 20px `animate-ping` ring with `rgba(37, 99, 235, 0.2)` (blue-600/20)
- Inner: 12px solid `#2563EB` (blue-600) with white 2px border

**RadiusCircle** — Imperative `google.maps.Circle` via `useMap()` + `useEffect`:
- `radius: radiusMiles * 1609.34` (miles to meters)
- `fillColor: #2563EB, fillOpacity: 0.15, strokeColor: #2563EB, strokeWeight: 1`
- `clickable: false` to prevent map interaction blocking
- Cleanup on unmount and when `visible` changes to false
- Returns `null` (no JSX)

## Decisions Made

1. **TrainerInfoCard as AdvancedMarker** — Rendering inside `AdvancedMarker` at trainer coordinates ensures the card stays anchored to the pin as the map pans/zooms. A floating div overlay would require manual viewport coordinate recalculation.

2. **Imperative RadiusCircle** — `google.maps.Circle` cannot be expressed as JSX. The `useEffect` + `useRef` pattern is the standard approach for imperative Maps API objects within React component lifecycle.

3. **Teardrop via CSS** — The `border-radius: 50% 50% 50% 0` + `rotate(-45deg)` approach is the most reliable cross-browser method for teardrop shapes inside Google Maps DOM where SVG import chains can be problematic.

4. **Inline styles for pin internals** — Google Maps injects component DOM into its own container; Tailwind utilities may not reliably apply. Inline styles used for all sizing, colors, and transforms inside `AdvancedMarker` children for reliability.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- All 70 existing tests pass (1 pre-existing AdminDashboard failure unrelated to this work)
- All 6 components export named exports as specified
- TrainerMapPin: `AdvancedMarker`, `PIN_COLORS`, `Dumbbell/Leaf/Home`, `#C5A059`, `Crown`, `animate-pulse`
- TrainerInfoCard: "Book Now", `/book/` navigate, `LiveNowBadge`, `BookingModeBadge`, `line-through`
- LocationTypeChips: "All"/"Gym"/"Park"/"In-Home", `PIN_COLORS` usage
- SearchAreaButton: "Search this area"/"Searching...", `motion.button`
- ClientLocationDot: `AdvancedMarker`, blue-600 styling
- RadiusCircle: `google.maps.Circle`, `1609.34`

## Self-Check: PASSED
