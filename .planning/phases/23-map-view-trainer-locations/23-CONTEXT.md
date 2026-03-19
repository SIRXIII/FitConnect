# Phase 23: Map View + Trainer Locations - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Clients can discover available trainers on a live Google Map with clustered pins, info cards, and location type icons. Trainers can manage up to 5 workout locations with address entry, drag-to-adjust pin, and location type selection. Map and list views are synced and toggleable. PostGIS spatial queries power the backend.

Requirements: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, LOC-01, LOC-02, LOC-03, LOC-04

</domain>

<decisions>
## Implementation Decisions

### Map Discovery Experience
- Map/List toggle button at top of SearchSection — same page, one view at a time
- Existing filters apply to both map and list views (fully synced state)
- Map auto-centers on client's browser geolocation; falls back to city-level default (e.g., LA) if denied
- Client's own location shown as pulsing blue dot on map
- Auto-cluster pins when zoomed out with count badge (e.g., "12"); clicking cluster zooms in to reveal individual pins
- "Search this area" floating button appears after panning — client clicks to reload pins for new viewport
- Distance slider filter (1-25 miles) draws radius circle on map, filters trainers within range
- On mobile (Capacitor iOS): full viewport map with draggable bottom sheet listing matching trainers (Google Maps / Uber pattern)
- On desktop: standard map/list toggle (no split screen)

### Pin Info Cards + Booking Flow
- Tapping a pin shows a floating compact info card near the pin (Google Maps business card style)
- Card content: avatar, name, specialty, rate (original crossed out + discounted if applicable), rating stars, location type icon, Live badge, Book button
- Book button navigates to existing /book/:trainerId page — reuses full booking wizard
- Card dismissed by tapping outside OR tapping X button; also dismissed when tapping another pin

### Trainer Location Management
- "Workout Locations" section in trainer settings/profile page
- Google Places Autocomplete for address entry — type-ahead search, select result, map auto-centers
- After address selection: drag-to-adjust pin for fine-tuning position
- Maximum 5 workout locations per trainer
- Each location has optional nickname (e.g., "Venice Beach Spot") — defaults to address if not set
- Location type selection: gym, park, in-home (per location)
- When trainer taps "Go Live", a quick location picker shows their saved locations — selected location becomes the pin clients see on the map

### Location Type Visual System
- Custom pin icons per location type: dumbbell for gym, tree/leaf for park, house for in-home
- Color-coded pins: gym=blue, park=green, in-home=amber
- Elite tier trainers: gold ring/border on pin + small star/crown badge (matches FitRush gold #C5A059)
- Live Now status: green pulsing dot overlay on pin corner (consistent with LiveNowBadge in list view)
- Offline trainers show static pins (no pulse)
- Horizontal chip toggles above map: Gym, Park, In-Home, All — tap to filter pin visibility

### Claude's Discretion
- Exact map styling (light/dark theme, custom map styles)
- Pin clustering algorithm parameters (zoom threshold, max zoom)
- Bottom sheet height breakpoints and drag behavior on mobile
- Map animation/transition specifics (zoom-to-cluster, pan-to-search)
- Geolocation permission prompt timing and fallback behavior
- Exact placement of distance slider in filter panel
- PostGIS query optimization (spatial index, bounding box pre-filter)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Map Library
- STATE.md decision: Use `@vis.gl/react-google-maps` (Google-endorsed React wrapper)
- STATE.md decision: PostGIS `geography(POINT)` for spatial queries with explicit TS type overrides

### Existing Codebase
- `Cenlar demand gt 1-17/src/components/search/SearchSection.tsx` — Current list-based trainer search; add map/list toggle here
- `Cenlar demand gt 1-17/src/components/search/TrainerCard.tsx` — TrainerCard data shape; info card should mirror key fields
- `Cenlar demand gt 1-17/src/components/shared/LiveNowBadge.tsx` — Green dot badge pattern for live status (Phase 22)
- `Cenlar demand gt 1-17/src/components/shared/BookingModeBadge.tsx` — Instant/Request badge (Phase 22)
- `Cenlar demand gt 1-17/src/components/trainer/AvailabilityHeader.tsx` — Trainer dashboard header with Go Live flow (Phase 22)
- `Cenlar demand gt 1-17/src/hooks/useTrainers.ts` — Trainer data fetching hook
- `Cenlar demand gt 1-17/src/types/supabase.ts` — trainer_profiles has latitude, longitude, location columns already

### GCP Setup
- `.planning/phases/21-email-capture-platform-controls/GCP-SETUP-CHECKLIST.md` — GCP billing limits and API key restrictions

### Requirements
- `.planning/REQUIREMENTS.md` — MAP-01 through MAP-06, LOC-01 through LOC-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SearchSection.tsx`: Already has specialty/location/price filters, useTrainers hook — add map toggle and pass same data to map view
- `TrainerCard.tsx`: Card data shape (`dbTrainerToCardData`) includes id, name, location, specialty, rate, rating, imageUrl, isLive, bookingMode — reuse for info card
- `LiveNowBadge.tsx` + `BookingModeBadge.tsx`: Phase 22 badges, reuse on info cards and potentially on pins
- `useTrainers.ts`: Fetches trainer data from Supabase — extend with PostGIS spatial queries
- `trainer_profiles` table: Already has `latitude: number | null`, `longitude: number | null`, `location: string` columns

### Established Patterns
- Supabase Realtime: Channel subscription pattern for live status updates (Phase 22)
- Zustand store: auth store with trainerProfile state
- Framer Motion: AnimatePresence for transitions
- Tailwind CSS: Uppercase labels, tracking-wide, accent colors

### Integration Points
- `SearchSection.tsx`: Add map/list toggle, MapView component, and bottom sheet for mobile
- `AvailabilityHeader.tsx`: Add location picker to Go Live flow
- `trainer_profiles` table: May need `workout_locations` table or JSONB column for multi-location
- New PostGIS migration: Enable PostGIS extension, add geography column, spatial index
- Google Maps API: Places Autocomplete for address entry, Maps JS API for rendering

</code_context>

<specifics>
## Specific Ideas

- Google Maps business card style for pin info cards — compact, floating near the pin
- Uber/Google Maps style bottom sheet on mobile — full map with draggable results sheet
- "Search this area" button after panning (Airbnb pattern)
- Custom pin icons per location type with color coding (blue gym, green park, amber in-home)
- Gold ring + star/crown for Elite pins matching FitRush gold accent (#C5A059)
- Green pulsing dot on Live pins matching existing LiveNowBadge in list view
- Location picker appears on Go Live — trainer chooses which spot they're at today

</specifics>

<deferred>
## Deferred Ideas

- iCal/Apple Calendar upload for trainers — separate phase (user requested during UAT)
- Live GPS tracking of trainer movement — out of scope per REQUIREMENTS.md
- Street View integration — API cost + scope creep
- Route/directions to trainer — link to Google Maps deep link instead
- Background location "Always" mode — iOS App Store rejection risk

</deferred>

---

*Phase: 23-map-view-trainer-locations*
*Context gathered: 2026-03-19*
