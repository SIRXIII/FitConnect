# Phase 23: Map View + Trainer Locations - Research

**Researched:** 2026-03-19
**Domain:** Google Maps (vis.gl), PostGIS spatial queries, Places API (New), marker clustering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Map/List toggle at top of SearchSection — same page, one view at a time
- Existing filters apply to both map and list views (fully synced state)
- Map auto-centers on client geolocation; falls back to `lat: 34.0522, lng: -118.2437` (Los Angeles) if denied
- Client location shown as pulsing blue dot
- Auto-cluster pins with count badge; clicking cluster zooms in to reveal individual pins
- "Search this area" floating button appears after panning 100+ pixels; triggers re-query
- Distance slider (1-25 miles) draws radius circle, filters trainers within range
- Mobile (Capacitor iOS): full viewport map with draggable bottom sheet (Google Maps/Uber pattern)
- Desktop: map/list toggle only (no split screen)
- Pin info card: compact floating card (Google Maps business card style) — avatar, name, specialty, rate, rating, location type icon, Live badge, Book button
- Book button navigates to `/book/:trainerId` — reuses full booking wizard
- Card dismissed by tapping outside or X button; also dismissed when tapping another pin
- "Workout Locations" section in trainer settings/profile page
- Google Places Autocomplete for address entry (type-ahead search)
- After address selection: drag-to-adjust pin for fine-tuning position
- Maximum 5 workout locations per trainer
- Each location has optional nickname (default to address if not set); location type selection (gym/park/in-home)
- When trainer taps "Go Live", location picker shows saved locations; selected location becomes live pin
- Custom pin icons per type: dumbbell (gym), tree/leaf (park), house (in-home)
- Color-coded: gym=blue-600, park=green-600, in-home=amber-600
- Elite tier: gold ring/border (#C5A059) + star/crown badge on pin
- Live Now: green pulsing dot on pin corner (consistent with LiveNowBadge)
- Horizontal chip toggles above map: All, Gym, Park, In-Home

### Claude's Discretion
- Exact map styling (light/dark theme, custom map styles)
- Pin clustering algorithm parameters (zoom threshold, max zoom)
- Bottom sheet height breakpoints and drag behavior on mobile
- Map animation/transition specifics (zoom-to-cluster, pan-to-search)
- Geolocation permission prompt timing and fallback behavior
- Exact placement of distance slider in filter panel
- PostGIS query optimization (spatial index, bounding box pre-filter)

### Deferred Ideas (OUT OF SCOPE)
- iCal/Apple Calendar upload for trainers
- Live GPS tracking of trainer movement
- Street View integration
- Route/directions to trainer (link to Google Maps deep link instead)
- Background location "Always" mode
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAP-01 | Client can view a Google Map with clustered trainer location pins | `@vis.gl/react-google-maps` + `@googlemaps/markerclusterer` — AdvancedMarker + MarkerClusterer pattern documented below |
| MAP-02 | Client can click a pin to see trainer info card (name, specialty, rate, Book button) | AdvancedMarker `onClick` event + controlled `selectedTrainerId` state drives TrainerInfoCard |
| MAP-03 | Client can toggle between map view and list view on the search page | `viewMode: 'list' | 'map'` state in SearchSection, AnimatePresence fade, existing filter state shared |
| MAP-04 | Map shows only trainers currently marked as available (live pin visibility) | Filter `displayTrainers` by `availability_status === 'live'` before passing to MapView; OR use Supabase Realtime subscription already in place from Phase 22 |
| MAP-05 | Trainer pins display location type icon (gym, park, in-home) | Custom AdvancedMarker children — SVG icon per `location_type`; TrainerMapPin component |
| MAP-06 | Elite trainer pins display tier badge on map | `subscription_tier === 'elite'` conditional in TrainerMapPin renders gold ring + crown overlay |
| LOC-01 | Trainer can add workout locations with address entry and Google Maps preview | `useMapsLibrary('places')` + `AutocompleteSuggestion` (New Places API) — pattern documented below |
| LOC-02 | Trainer can adjust pin position on map after address entry | AdvancedMarker `draggable={true}` + `onDragEnd` captures final lat/lng |
| LOC-03 | Trainer can select location type (gym, park, in-home) for each workout spot | Three-button toggle in WorkoutLocationsManager form; stored on `workout_locations` table |
| LOC-04 | Trainer can manage multiple workout locations | `workout_locations` table (max 5 per trainer enforced by CHECK constraint + app UI) |
</phase_requirements>

---

## Summary

This phase introduces Google Maps-based trainer discovery via `@vis.gl/react-google-maps` (1.7.1) and `@googlemaps/markerclusterer` (2.6.2). Neither package is currently installed — both must be added. The map renders live-only trainer pins as custom `AdvancedMarker` components clustered using `MarkerClusterer`. A PostGIS migration enables bounding-box spatial queries via a new `trainers_in_view` RPC, replacing the current text-based `ilike` location filter for map view. Trainer multi-location management requires a new `workout_locations` table.

The most significant API pitfall: `google.maps.places.Autocomplete` (classic) is **not available to new GCP customers as of March 1, 2025**. This project must use the **New Places API** with `AutocompleteSuggestion.fetchAutocompleteSuggestions()` + `placePrediction.toPlace().fetchFields()` instead. This is not a drop-in replacement — it requires a custom input + suggestion list UI component rather than the Google-managed dropdown.

The bottom sheet on Capacitor iOS is a hand-rolled component (no installable native sheet library integrates cleanly with Capacitor 8 + React 19). Use CSS `touch-action: none` + pointer events for drag behavior, with three snap points (10%, 40%, 80%).

**Primary recommendation:** Install two packages, write one PostGIS migration, create one new DB table, and build all map/pin/info-card components using `@vis.gl/react-google-maps` AdvancedMarker with custom JSX children.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vis.gl/react-google-maps` | 1.7.1 | React wrapper for Google Maps JS API | Google-endorsed, replaces unmaintained `@react-google-maps/api`; full TS support; `AdvancedMarker` support |
| `@googlemaps/markerclusterer` | 2.6.2 | Cluster nearby markers into count badges | Official Google library; `SuperClusterAlgorithm` default; works directly with `AdvancedMarker` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostGIS (Supabase extension) | bundled with Supabase | Spatial bounding-box queries | Map viewport queries; `ST_MakeBox2D` + `&&` operator |
| `lucide-react` | 0.555.0 (already installed) | Dumbbell / Leaf / Home icons for pins | Already in project; use `Dumbbell`, `Leaf`, `Home` for location type icons |
| Framer Motion | 12.35.2 (already installed) | AnimatePresence for list/map toggle | Already in project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@vis.gl/react-google-maps` | `@react-google-maps/api` | Not maintained; last release 2022 |
| `@googlemaps/markerclusterer` | `react-leaflet` + Leaflet.markercluster | Would require switching map provider; Leaflet has no Google Maps data |
| New Places API (`AutocompleteSuggestion`) | `google.maps.places.Autocomplete` (classic) | Classic not available to new GCP customers since March 2025 |
| Hand-rolled bottom sheet | `vaul` (Radix drawer) | vaul doesn't integrate with Capacitor touch events reliably; keep hand-rolled |

### Installation

```bash
cd "Cenlar demand gt 1-17"
npm install @vis.gl/react-google-maps @googlemaps/markerclusterer
```

**Version verification (confirmed 2026-03-19):**
- `@vis.gl/react-google-maps`: 1.7.1 (current on npm registry)
- `@googlemaps/markerclusterer`: 2.6.2 (current on npm registry)

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── search/
│   │   ├── SearchSection.tsx         # add viewMode state + MapListToggle + MapView
│   │   ├── MapView.tsx               # NEW — APIProvider + Map + pins + clustering
│   │   ├── MapListToggle.tsx         # NEW — two-segment toggle
│   │   └── MobileTrainerSheet.tsx    # NEW — draggable bottom sheet (iOS only)
│   ├── map/
│   │   ├── TrainerMapPin.tsx         # NEW — AdvancedMarker with custom JSX
│   │   ├── TrainerInfoCard.tsx       # NEW — floating info card on pin click
│   │   ├── LocationTypeChips.tsx     # NEW — All/Gym/Park/In-Home chip row
│   │   ├── SearchAreaButton.tsx      # NEW — "Search this area" floating button
│   │   ├── ClientLocationDot.tsx     # NEW — pulsing blue dot AdvancedMarker
│   │   └── RadiusCircle.tsx          # NEW — semi-transparent distance circle
│   └── trainer/
│       ├── WorkoutLocationsManager.tsx  # NEW — trainer settings section
│       └── GoLiveLocationPicker.tsx     # NEW — modal step in Go Live flow
├── hooks/
│   └── useWorkoutLocations.ts        # NEW — CRUD for workout_locations table
└── types/
    └── supabase.ts                   # extend with workout_locations table types (manual until supabase types regenerated)
supabase/migrations/
└── 20260319100000_map_trainer_locations.sql  # NEW — PostGIS, workout_locations table
```

### Pattern 1: APIProvider + Map setup

`APIProvider` must wrap the entire map subtree. Load with `libraries={['places']}` to enable the New Places API for the autocomplete in WorkoutLocationsManager. The Map component uses `onCameraChanged` to capture bounds for "Search this area".

```typescript
// Source: https://visgl.github.io/react-google-maps/docs/api-reference/components/map
import { APIProvider, Map } from '@vis.gl/react-google-maps';

const LA_DEFAULT = { lat: 34.0522, lng: -118.2437 };

<APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={['places']}>
  <Map
    defaultCenter={LA_DEFAULT}
    defaultZoom={12}
    mapId="fitrush-map"
    gestureHandling="greedy"
    disableDefaultUI={true}
    onCameraChanged={(ev) => {
      setBounds(ev.detail.bounds);  // drive "Search this area" visibility
    }}
  >
    {/* children: TrainerMapPin, ClientLocationDot, RadiusCircle */}
  </Map>
</APIProvider>
```

### Pattern 2: AdvancedMarker with custom JSX pin

Custom pin appearance is achieved by passing JSX as children to `AdvancedMarker`. This is the only way to render custom SVG/HTML pins with the new Google Maps `AdvancedMarkerElement`.

```typescript
// Source: https://visgl.github.io/react-google-maps/docs/api-reference/components/advanced-marker
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { Dumbbell, Leaf, Home } from 'lucide-react';

const PIN_COLORS = { gym: '#2563EB', park: '#16A34A', 'in-home': '#D97706' };
const PIN_ICONS = { gym: Dumbbell, park: Leaf, 'in-home': Home };

const TrainerMapPin = ({ trainer, isSelected, onClick }) => {
  const color = PIN_COLORS[trainer.location_type] ?? '#2563EB';
  const Icon = PIN_ICONS[trainer.location_type] ?? Dumbbell;
  const isElite = trainer.subscription_tier === 'elite';

  return (
    <AdvancedMarker
      position={{ lat: trainer.latitude, lng: trainer.longitude }}
      onClick={onClick}
      zIndex={isSelected ? 100 : 1}
    >
      {/* 28×36px pin body — CSS inline styles for reliability inside Google Maps DOM */}
      <div
        style={{
          width: 28, height: 36,
          background: color,
          borderRadius: '50% 50% 50% 0',
          transform: 'rotate(-45deg)',
          border: isElite ? `2px solid #C5A059` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          minWidth: 44, minHeight: 44,  // WCAG tap target
        }}
      >
        <div style={{ transform: 'rotate(45deg)' }}>
          <Icon size={14} color="white" />
        </div>
      </div>
      {/* Live pulse dot */}
      {trainer.isLive && (
        <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      )}
    </AdvancedMarker>
  );
};
```

### Pattern 3: MarkerClusterer integration

`MarkerClusterer` is imperative — it manages `AdvancedMarkerElement` instances. In React, use the `useMap()` hook to get the map instance, then instantiate `MarkerClusterer` in a `useEffect`. Pass `markers` as a ref array updated when trainer data changes.

```typescript
// Source: https://visgl.github.io/react-google-maps/examples/marker-clustering
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { useMap } from '@vis.gl/react-google-maps';

// Pattern: clusterer holds marker references; render AdvancedMarkers into clusterer
// The vis.gl example demonstrates this pattern with a ref-based approach:
// Each AdvancedMarker registers itself in a markers Map<string, Marker>
// clusterer.addMarkers / removeMarkers called when the set changes
```

**Cluster custom renderer** — to show the count badge as a dark ink circle matching the design system:

```typescript
const clusterRenderer = {
  render: ({ count, position }) => {
    return new google.maps.marker.AdvancedMarkerElement({
      position,
      content: Object.assign(document.createElement('div'), {
        className: 'cluster-pin',
        innerHTML: `<span>${count}</span>`,
        // styled via a <style> tag injected once, or inline style
      }),
    });
  },
};

new MarkerClusterer({ map, markers, renderer: clusterRenderer });
```

### Pattern 4: New Places API autocomplete (LOC-01)

`google.maps.places.Autocomplete` (classic) is **unavailable for new GCP projects after March 2025**. Use `AutocompleteSuggestion` from the New Places API:

```typescript
// Source: https://github.com/visgl/react-google-maps/discussions/707
import { useMapsLibrary } from '@vis.gl/react-google-maps';

const PlacesAutoComplete = ({ onPlaceSelect }) => {
  const places = useMapsLibrary('places');
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!places || inputValue.length < 3) return;
    const fetchSuggestions = async () => {
      const { suggestions } = await places.AutocompleteSuggestion
        .fetchAutocompleteSuggestions({ input: inputValue });
      setSuggestions(suggestions);
    };
    fetchSuggestions();
  }, [places, inputValue]);

  const handleSelect = async (suggestion) => {
    const { place } = await suggestion.placePrediction
      .toPlace()
      .fetchFields({ fields: ['location', 'formattedAddress'] });
    onPlaceSelect({
      lat: place.location.lat(),
      lng: place.location.lng(),
      address: place.formattedAddress,
    });
    setSuggestions([]);
  };

  return (
    <>
      <input value={inputValue} onChange={e => setInputValue(e.target.value)} />
      {suggestions.map((s, i) => (
        <button key={i} onClick={() => handleSelect(s)}>
          {s.placePrediction.text.toString()}
        </button>
      ))}
    </>
  );
};
```

**Note:** `VITE_GOOGLE_MAPS_API_KEY` must have "Places API (New)" enabled in GCP (not just "Maps JavaScript API"). The GCP checklist (Phase 21) covers key setup — add "Places API (New)" to the allowed APIs list.

### Pattern 5: PostGIS bounding box RPC

```sql
-- Source: https://supabase.com/docs/guides/database/extensions/postgis
-- Migration: 20260319100000_map_trainer_locations.sql

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- workout_locations table
CREATE TABLE public.workout_locations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id   uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  nickname     text,
  address      text NOT NULL,
  latitude     double precision NOT NULL,
  longitude    double precision NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('gym', 'park', 'in-home')),
  geo_point    extensions.geography(POINT, 4326)
                 GENERATED ALWAYS AS (
                   extensions.ST_SetSRID(
                     extensions.ST_MakePoint(longitude, latitude), 4326
                   )::extensions.geography
                 ) STORED,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT max_5_locations_per_trainer UNIQUE (trainer_id, id)
);

CREATE INDEX workout_locations_geo_index
  ON public.workout_locations
  USING GIST (geo_point);

-- Add active_location_id to trainer_profiles (which location the trainer is "at" when live)
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS active_location_id uuid REFERENCES workout_locations(id);

-- Bounding box RPC for map viewport queries
CREATE OR REPLACE FUNCTION public.trainers_in_view(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
RETURNS TABLE (
  trainer_id uuid,
  latitude   double precision,
  longitude  double precision,
  location_type text
)
SET search_path TO ''
LANGUAGE sql
AS $$
  SELECT tp.id, wl.latitude, wl.longitude, wl.location_type
  FROM public.trainer_profiles tp
  JOIN public.workout_locations wl ON wl.id = tp.active_location_id
  WHERE tp.availability_status = 'live'
    AND wl.geo_point OPERATOR(extensions.&&)
        extensions.ST_SetSRID(
          extensions.ST_MakeBox2D(
            extensions.ST_Point(min_lng, min_lat),
            extensions.ST_Point(max_lng, max_lat)
          ), 4326
        )
$$;

GRANT EXECUTE ON FUNCTION public.trainers_in_view(double precision, double precision, double precision, double precision) TO authenticated, anon;
```

**JavaScript client call:**

```typescript
const { data } = await supabase.rpc('trainers_in_view', {
  min_lat: bounds.south,
  min_lng: bounds.west,
  max_lat: bounds.north,
  max_lng: bounds.east,
});
```

### Pattern 6: Max-5 locations enforcement

The DB `max_5_locations_per_trainer` constraint is a UNIQUE — not a count limit. Use a DB-level check function:

```sql
CREATE OR REPLACE FUNCTION check_location_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.workout_locations WHERE trainer_id = NEW.trainer_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 workout locations allowed per trainer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_location_limit
  BEFORE INSERT ON public.workout_locations
  FOR EACH ROW EXECUTE FUNCTION check_location_limit();
```

Also disable the "Add Location" button in UI when `locations.length >= 5`.

### Anti-Patterns to Avoid

- **Don't render AdvancedMarkers outside `<Map>`** — they require a map context from the APIProvider; rendering them outside throws an error.
- **Don't use `google.maps.places.Autocomplete` (classic)** — unavailable to this project since GCP account creation post-March 2025.
- **Don't store Geography column manually** — use GENERATED ALWAYS AS for `geo_point` so lat/lng remain the source of truth and the geography column stays in sync automatically.
- **Don't query all trainers and filter client-side** — always use `trainers_in_view` RPC with the current map bounds to avoid loading thousands of rows.
- **Don't use a separate React library for the bottom sheet** — Capacitor iOS's WKWebView has its own scroll/touch handling; a hand-rolled CSS-based sheet with pointer events is more reliable than a third-party drawer component.
- **Don't add `mapId` pointing to a non-existent Cloud Map ID** — `AdvancedMarker` requires either a valid `mapId` (for cloud styling) or can work without it for basic usage in newer API versions. Omit `mapId` unless cloud styling is configured.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Marker clustering with count badges | Custom clustering algorithm | `@googlemaps/markerclusterer` + `SuperClusterAlgorithm` | Handles zoom-level clustering, viewport optimization, overlap, click-to-zoom |
| Bounding box distance math | Haversine formula in JS | PostGIS `&&` operator + `ST_MakeBox2D` | Runs in DB, uses spatial index, handles edge cases at poles/antimeridian |
| Address geocoding | Manual geocoding API calls | New Places API `placePrediction.toPlace().fetchFields()` | Returns structured coordinates, handles ambiguous addresses, no extra API |
| Google Maps React wrapper | `useEffect` + direct DOM manipulation | `@vis.gl/react-google-maps` components | Manages lifecycle, TypeScript types, SSR safety, React 19 compatibility |

**Key insight:** The Google Maps DOM is imperative but vis.gl wraps it declaratively. Never manipulate `google.maps.Map` directly in render — always use the `useMap()` hook inside a child of `<Map>`.

---

## Common Pitfalls

### Pitfall 1: mapId required for AdvancedMarker (older API versions)

**What goes wrong:** In some versions of the Maps JS API, `AdvancedMarker` throws `"AdvancedMarkerElement requires a map with a mapId"` when `mapId` is not set.

**Why it happens:** Cloud-based map styling (and AdvancedMarkerElement) originally required a Maps Platform Map ID.

**How to avoid:** Either create a Cloud Map ID in GCP Console and pass it as `mapId` prop on `<Map>`, OR use the `google.maps.marker.AdvancedMarkerElement` directly which does not require mapId in recent API versions. The safest approach: create a free Map ID in GCP and use it. It does not cost extra.

**Warning signs:** Console error `"AdvancedMarkerElement requires..."` during development.

### Pitfall 2: MarkerClusterer not cleaning up on unmount

**What goes wrong:** When `MapView` unmounts (user switches to list view), the `MarkerClusterer` instance still holds references and can cause memory leaks or errors on remount.

**Why it happens:** `MarkerClusterer` is imperative and not React-aware.

**How to avoid:** In the `useEffect` that creates the clusterer, return a cleanup function: `return () => clusterer.clearMarkers()`. Store the clusterer instance in a `useRef`.

**Warning signs:** "Cannot read properties of null (reading 'addMarker')" errors in console after toggling views.

### Pitfall 3: Places API billing — "Places API (New)" vs "Places API"

**What goes wrong:** The GCP API key has "Maps JavaScript API" enabled but not "Places API (New)". Address autocomplete silently fails or throws `"This API is not enabled"`.

**Why it happens:** There are two Places APIs in GCP — the legacy "Places API" and the "Places API (New)". The new `AutocompleteSuggestion` class requires the **new** one.

**How to avoid:** In GCP Console > APIs & Services > Library, enable "Places API (New)" separately. Update the API key restriction to include both "Maps JavaScript API" and "Places API (New)".

**Warning signs:** `useMapsLibrary('places')` returns the library object but `AutocompleteSuggestion` is `undefined`.

### Pitfall 4: `onCameraChanged` fires on every frame during pan animation

**What goes wrong:** `onCameraChanged` fires continuously during panning, causing "Search this area" button to flash in and out.

**Why it happens:** The event fires on every camera frame, not just when the user releases the map.

**How to avoid:** Track the "initial center" when the map first loads or the last search was executed. Only show the button when the current center has moved more than a threshold (100px at current zoom). Use `onIdle` (fires once after the map settles) rather than `onCameraChanged` to trigger the actual re-query.

**Warning signs:** The "Search this area" button appears immediately after the map loads.

### Pitfall 5: PostGIS extension schema prefix

**What goes wrong:** Calling `ST_MakeBox2D(...)` without schema prefix throws `"function st_makebox2d(...) does not exist"`.

**Why it happens:** PostGIS is installed in the `extensions` schema, not `public`.

**How to avoid:** Always use `extensions.ST_MakeBox2D`, `extensions.ST_Point`, `extensions.ST_SetSRID`, etc. in SQL. Add `SET search_path TO ''` to RPC functions to enforce explicit schema qualification (as done in Phase 22's `create_booking_atomic`).

**Warning signs:** SQL errors mentioning function not found when running the migration.

### Pitfall 6: TS types for PostGIS geography column

**What goes wrong:** TypeScript type generation from Supabase doesn't represent `geography(POINT)` columns as a usable type — it comes through as `unknown` or `string`.

**Why it happens:** PostGIS types are not part of Supabase's default TS type generation.

**How to avoid:** The `geo_point` column in `workout_locations` is GENERATED and only used for server-side spatial queries — never read on the client. Clients only read `latitude` and `longitude` (plain `double precision`). Add explicit TS type overrides for `workout_locations` manually in `supabase.ts` (consistent with Phase 22's `create_booking_atomic` manual additions). Omit the `geo_point` column from the TypeScript type definition.

### Pitfall 7: Bottom sheet touch events on Capacitor iOS

**What goes wrong:** CSS `overflow-y: auto` on the bottom sheet conflicts with WKWebView's native scroll handling, causing erratic snap behavior.

**Why it happens:** Capacitor's WKWebView intercepts scroll events before React's synthetic event system.

**How to avoid:** Use `pointer events` with `onPointerDown`/`onPointerMove`/`onPointerUp` (not touch events) for drag detection. Set `touch-action: none` on the drag handle element only, not the list content area. The list content inside the sheet should retain native scroll.

---

## Code Examples

### Minimal MapView shell

```typescript
// src/components/search/MapView.tsx
// Source: https://visgl.github.io/react-google-maps/docs/get-started
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import type { MapCameraChangedEvent } from '@vis.gl/react-google-maps';
import type { TrainerWithProfile } from '@/hooks/useTrainers';

const LA_DEFAULT = { lat: 34.0522, lng: -118.2437 };

interface MapViewProps {
  trainers: TrainerWithProfile[];
  onBoundsChanged: (bounds: google.maps.LatLngBoundsLiteral) => void;
}

export const MapView: React.FC<MapViewProps> = ({ trainers, onBoundsChanged }) => {
  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY} libraries={['places']}>
      <div style={{ width: '100%', height: '500px' }}>
        <Map
          defaultCenter={LA_DEFAULT}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI
          onIdle={(e) => {
            const bounds = e.map.getBounds()?.toJSON();
            if (bounds) onBoundsChanged(bounds);
          }}
        >
          {trainers
            .filter(t => t.availability_status === 'live' && t.latitude && t.longitude)
            .map(t => <TrainerMapPin key={t.id} trainer={t} />)
          }
        </Map>
      </div>
    </APIProvider>
  );
};
```

### trainers_in_view RPC client call

```typescript
// Extension to useTrainers.ts or new useMapTrainers.ts hook
const fetchTrainersInView = async (bounds: google.maps.LatLngBoundsLiteral) => {
  const { data, error } = await supabase.rpc('trainers_in_view', {
    min_lat: bounds.south,
    min_lng: bounds.west,
    max_lat: bounds.north,
    max_lng: bounds.east,
  });
  return data;
};
```

### workout_locations CRUD

```typescript
// useWorkoutLocations.ts
const addLocation = async (trainerId: string, loc: {
  address: string; nickname?: string;
  latitude: number; longitude: number;
  location_type: 'gym' | 'park' | 'in-home';
}) => {
  const { data, error } = await supabase
    .from('workout_locations')
    .insert({ trainer_id: trainerId, ...loc })
    .select()
    .single();
  // DB trigger enforces max 5; handle error code '23514' (check violation) for limit exceeded
  return { data, error };
};
```

### SearchSection viewMode toggle

```typescript
// SearchSection.tsx — add viewMode state
const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

// MapListToggle receives and sets viewMode
// AnimatePresence wraps both views:
<AnimatePresence mode="wait">
  {viewMode === 'list' ? (
    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* existing trainer grid */}
    </motion.div>
  ) : (
    <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <MapView trainers={displayTrainers} onBoundsChanged={handleBoundsChanged} />
    </motion.div>
  )}
</AnimatePresence>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@react-google-maps/api` | `@vis.gl/react-google-maps` | 2023 (Google endorsed vis.gl) | Better TS support, AdvancedMarker support, maintained |
| `google.maps.places.Autocomplete` (classic) | `AutocompleteSuggestion` (New Places API) | March 1, 2025 (new customers) | Must build custom input + suggestion list UI; no drop-in Google widget |
| `google.maps.Marker` | `google.maps.marker.AdvancedMarkerElement` | 2024 (legacy Marker deprecated Feb 2024) | AdvancedMarker supports custom HTML/React JSX content |
| `MarkerClustererPlus` | `@googlemaps/markerclusterer` | 2021 | Official Google library, works with AdvancedMarker |

**Deprecated/outdated:**
- `google.maps.Marker`: Deprecated February 2024; use `AdvancedMarkerElement` (via `AdvancedMarker` component)
- `google.maps.places.Autocomplete`: Not available to new GCP customers as of March 1, 2025

---

## Open Questions

1. **Does the Supabase project already have PostGIS enabled?**
   - What we know: The `geography(POINT)` approach was approved in STATE.md. No PostGIS migration exists yet.
   - What's unclear: Whether PostGIS is already enabled on the Supabase `qecwxvvlpvrnrqyrdxrj` project from a previous config.
   - Recommendation: Migration should use `CREATE EXTENSION IF NOT EXISTS postgis` — safe to re-run if already enabled.

2. **GCP checklist from Phase 21 — is it complete?**
   - What we know: The GCP-SETUP-CHECKLIST.md exists and was created in Phase 21. `VITE_GOOGLE_MAPS_API_KEY` env var is referenced in the checklist.
   - What's unclear: Whether the API key has been created and stored in `.env.local` and Netlify. Whether "Places API (New)" is enabled (checklist only mentions "Maps JavaScript API").
   - Recommendation: Wave 0 task should verify `VITE_GOOGLE_MAPS_API_KEY` is set and add a GCP step to also enable "Places API (New)".

3. **active_location_id on trainer_profiles — Go Live flow integration**
   - What we know: AvailabilityHeader.tsx calls `goLive(pendingBookingMode, pendingTimer)` via `useAvailabilitySession`. The `goLive` function writes to `trainer_profiles`.
   - What's unclear: Whether `useAvailabilitySession.goLive()` can be easily extended to also write `active_location_id`, or whether a separate DB update is needed.
   - Recommendation: Extend `goLive` to accept an optional `locationId` parameter and include it in the `trainer_profiles` update. `GoLiveLocationPicker` collects the selection before calling the extended `goLive`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vite.config.ts` (test block: globals=true, environment=jsdom) |
| Quick run command | `cd "Cenlar demand gt 1-17" && npx vitest run src/hooks/useWorkoutLocations.test.ts` |
| Full suite command | `cd "Cenlar demand gt 1-17" && npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | Live trainers filtered into pin array | unit | `npx vitest run src/components/search/MapView.test.tsx -t "filters live trainers"` | Wave 0 |
| MAP-02 | Pin click sets selectedTrainerId; info card renders | unit | `npx vitest run src/components/map/TrainerInfoCard.test.tsx` | Wave 0 |
| MAP-03 | viewMode toggle switches list/map container; filters remain | unit | `npx vitest run src/components/search/SearchSection.test.tsx -t "viewMode"` | Wave 0 |
| MAP-04 | Only availability_status=live trainers appear in pin array | unit | `npx vitest run src/components/search/MapView.test.tsx -t "live only"` | Wave 0 |
| MAP-05 | TrainerMapPin renders correct icon per location_type | unit | `npx vitest run src/components/map/TrainerMapPin.test.tsx` | Wave 0 |
| MAP-06 | Elite pin has gold ring style | unit | `npx vitest run src/components/map/TrainerMapPin.test.tsx -t "elite"` | Wave 0 |
| LOC-01 | WorkoutLocationsManager renders address input | unit | `npx vitest run src/components/trainer/WorkoutLocationsManager.test.tsx` | Wave 0 |
| LOC-02 | AdvancedMarker draggable=true when in edit mode | unit (component) | `npx vitest run src/components/map/TrainerMapPin.test.tsx -t "draggable"` | Wave 0 |
| LOC-03 | Location type toggle updates state | unit | `npx vitest run src/components/trainer/WorkoutLocationsManager.test.tsx -t "type"` | Wave 0 |
| LOC-04 | Add Location button disabled at 5 locations | unit | `npx vitest run src/hooks/useWorkoutLocations.test.ts -t "max 5"` | Wave 0 |

**Note:** Google Maps components cannot render in jsdom. Tests for map components must mock `@vis.gl/react-google-maps` (`vi.mock('@vis.gl/react-google-maps')`). Test logic (filter behavior, state changes, prop passing) rather than map rendering.

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose` (full suite, ~5s)
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/search/MapView.test.tsx` — covers MAP-01, MAP-04
- [ ] `src/components/map/TrainerInfoCard.test.tsx` — covers MAP-02
- [ ] `src/components/search/SearchSection.test.tsx` (extend existing or create) — covers MAP-03
- [ ] `src/components/map/TrainerMapPin.test.tsx` — covers MAP-05, MAP-06, LOC-02
- [ ] `src/components/trainer/WorkoutLocationsManager.test.tsx` — covers LOC-01, LOC-03
- [ ] `src/hooks/useWorkoutLocations.test.ts` — covers LOC-04
- [ ] Vitest mock: `src/__mocks__/@vis.gl/react-google-maps.ts` — mock APIProvider, Map, AdvancedMarker for jsdom

---

## Sources

### Primary (HIGH confidence)
- `https://visgl.github.io/react-google-maps/docs/get-started` — APIProvider setup, Map component props
- `https://visgl.github.io/react-google-maps/docs/api-reference/components/advanced-marker` — AdvancedMarker props, custom content pattern
- `https://visgl.github.io/react-google-maps/docs/api-reference/components/map` — onCameraChanged, bounds, onIdle
- `https://visgl.github.io/react-google-maps/docs/api-reference/hooks/use-map` — useMap, useMapsLibrary hooks
- `https://supabase.com/docs/guides/database/extensions/postgis` — PostGIS enable, geography column, bounding box RPC, GIST index
- `npm view @vis.gl/react-google-maps version` → 1.7.1 (verified 2026-03-19)
- `npm view @googlemaps/markerclusterer version` → 2.6.2 (verified 2026-03-19)

### Secondary (MEDIUM confidence)
- `https://github.com/visgl/react-google-maps/discussions/707` — New Places API AutocompleteSuggestion pattern (maintainer response)
- `https://visgl.github.io/react-google-maps/examples/marker-clustering` — MarkerClusterer + React integration pattern
- `https://visgl.github.io/react-google-maps/examples/custom-marker-clustering` — custom cluster renderer pattern
- Existing codebase: `supabase.ts`, `useTrainers.ts`, `AvailabilityHeader.tsx`, `SearchSection.tsx` — integration points verified directly

### Tertiary (LOW confidence — needs validation at implementation time)
- `https://github.com/visgl/react-google-maps/issues/736` — March 2025 Places API deprecation report; confirms new customer restriction; not an official doc
- mapId requirement for AdvancedMarker: confirmed in community reports; official docs say "required for cloud-based styling" but newer API versions may not enforce it strictly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via npm registry; vis.gl is Google-endorsed per STATE.md decision
- Architecture: HIGH — AdvancedMarker + clustering patterns from official vis.gl docs; PostGIS RPC from Supabase official docs
- Places API (New) autocomplete: MEDIUM — pattern from maintainer GitHub discussion, not official vis.gl docs page; verified approach correct but implementation details may require adjustment
- Pitfalls: HIGH for PostGIS schema prefix (direct experience from Phase 22 pattern); MEDIUM for mapId requirement (community reports); HIGH for Places API deprecation (confirmed March 2025)

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable libraries; Places API situation unlikely to change further in 30 days)
