---
phase: 27-location-based-notifications
plan: "02"
subsystem: notifications-ui
tags: [location, notifications, ui, google-maps, client-dashboard]
dependency_graph:
  requires: ["27-01"]
  provides: [NotificationPreferencesSection, LookingNowToggle, ClientDashboard-alerts-tab, Navbar-location-notif-icon]
  affects: [ClientDashboard, SearchSection, Navbar]
tech_stack:
  added: []
  patterns: [APIProvider-per-component, useMapsLibrary-places, animate-ping-pulse, role-gate-render]
key_files:
  created:
    - "Cenlar demand gt 1-17/src/components/client/NotificationPreferencesSection.tsx"
    - "Cenlar demand gt 1-17/src/components/search/LookingNowToggle.tsx"
  modified:
    - "Cenlar demand gt 1-17/src/pages/ClientDashboard.tsx"
    - "Cenlar demand gt 1-17/src/components/search/SearchSection.tsx"
    - "Cenlar demand gt 1-17/src/components/layout/Navbar.tsx"
decisions:
  - "NotificationPreferencesSection wrapped in its own APIProvider (no APIProvider ancestor on ClientDashboard) — follows Pitfall 6 pattern from 27-RESEARCH.md"
  - "Save button gate uses local areaCoords state (null when no area set) not isConfigured hook value — isConfigured reflects DB state, local state gives instant feedback"
  - "LookingNowToggle renders nothing (graceful degradation) when geolocation API unavailable"
  - "LookingNowToggle shown for client role only in SearchSection via useAuthStore role check"
  - "Navbar uses (notif as any).type cast — project convention not to regenerate Supabase TS types mid-phase"
  - "AdminDashboard test failure pre-existing and out of scope — 139/140 tests pass"
metrics:
  duration_seconds: 213
  completed_date: "2026-03-19"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 3
---

# Phase 27 Plan 02: Location-Based Notifications UI Summary

Location-based notification UI layer: NotificationPreferencesSection form with Google Places Autocomplete area selector, LookingNowToggle GPS mode button, Alerts tab on ClientDashboard, and MapPin icon rendering for trainer_live_nearby notifications in the Navbar dropdown.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | NotificationPreferencesSection + LookingNowToggle | 44843f5 | NotificationPreferencesSection.tsx, LookingNowToggle.tsx |
| 2 | Wire into ClientDashboard, SearchSection, Navbar | 61e2b36 | ClientDashboard.tsx, SearchSection.tsx, Navbar.tsx |
| 3 | Verify notification preferences UI | auto-approved | — |

## What Was Built

**NotificationPreferencesSection** (`/components/client/NotificationPreferencesSection.tsx`):
- Wrapped in its own `<APIProvider>` with `libraries=['places']` — follows the same pattern as WorkoutLocationsManager (Pitfall 6: ClientDashboard has no APIProvider ancestor)
- Master ON/OFF toggle calling `toggleEnabled()` — disables rest of form with `opacity-50 pointer-events-none` when off
- Google Places Autocomplete input using `useMapsLibrary('places')` + `fetchAutocompleteSuggestions` with 300ms debounce
- Selected area displayed as accent pill/chip with clear button
- Radius slider 1-10 miles with live label display
- Save button gated: disabled when `areaCoords` is null (no area selected) — enforces NOTIF-06
- `isConfigured` from hook displayed as "Alerts are active for your saved area" status text

**LookingNowToggle** (`/components/search/LookingNowToggle.tsx`):
- Uses `useLookingNow()` hook for activate/deactivate/livePosition
- Inactive state: `<MapPin>` icon + "Looking Now" text, muted styling
- Active state: `animate-ping` pulsing dot (Tailwind) + accent color styling
- "Using your location" helper text when active with valid coordinates
- Graceful degradation: renders `null` when `navigator.geolocation` unavailable

**ClientDashboard** — Alerts tab added:
- Tab type widened to `'overview' | 'progress' | 'alerts'`
- Bell icon + "Alerts" tab button matching existing tab styling
- `activeTab === 'alerts'` renders `<NotificationPreferencesSection />`

**SearchSection** — LookingNowToggle integrated:
- Rendered alongside `<MapListToggle>` in the filter controls area
- Gated by `profile?.role === 'client'` — trainers do not see it

**Navbar** — trainer_live_nearby notification rendering:
- `MapPin` icon imported from lucide-react
- Conditional render: `(notif as any).type === 'trainer_live_nearby'` shows `<MapPin size={12} className="text-accent shrink-0" />` before the notification title

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

- 139/140 tests passing
- 1 pre-existing failure in `AdminDashboard.test.tsx` (users table 5-column grid check) — unrelated to this plan, out of scope

## Self-Check

Files created/modified:
- `Cenlar demand gt 1-17/src/components/client/NotificationPreferencesSection.tsx` — FOUND
- `Cenlar demand gt 1-17/src/components/search/LookingNowToggle.tsx` — FOUND
- `Cenlar demand gt 1-17/src/pages/ClientDashboard.tsx` — FOUND (modified)
- `Cenlar demand gt 1-17/src/components/search/SearchSection.tsx` — FOUND (modified)
- `Cenlar demand gt 1-17/src/components/layout/Navbar.tsx` — FOUND (modified)

Commits:
- 44843f5 — FOUND
- 61e2b36 — FOUND

## Self-Check: PASSED
