---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: The Live Platform
status: executing
stopped_at: Completed 28-03-PLAN.md
last_updated: "2026-03-19T21:22:38.853Z"
last_activity: 2026-03-19 -- GCal OAuth connect/disconnect Edge Function, useGcalConnection hook, GoogleCalendarConnect UI card
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 24
  completed_plans: 24
---

# Project State -- FitRush

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-18)

**Core value:** Trainers monetize idle hours, clients get premium training at below-market prices
**Current focus:** v4.0 The Live Platform — Phase 21 next

## Current Position

Phase: 28 of 28 (Google Calendar Bidirectional Sync)
Plan: 2 of 3 (complete)
Status: In Progress
Last activity: 2026-03-19 -- GCal OAuth connect/disconnect Edge Function, useGcalConnection hook, GoogleCalendarConnect UI card

```
v4.0 Progress: [██████████] 96% (23/24 plans)

Phase 21: Email Capture + Platform Controls  [x] Complete
Phase 22: Availability Toggle Foundation     [x] Complete
Phase 23: Map View + Trainer Locations       [x] Complete
Phase 24: Session Logging                    [x] Complete (3/3 plans)
Phase 25: AI Trainer-Client Matching         [x] Complete
Phase 26: AI Discount Analytics              [x] Complete (2/2 plans)
Phase 27: Location-Based Notifications       [x] Complete
Phase 28: Google Calendar Bidirectional Sync [ ] In Progress (2/3 plans)
```

## Decisions

See `.planning/PROJECT.md` Key Decisions table for full history.

Recent decisions relevant to v4.0:
- Use `@vis.gl/react-google-maps` (Google-endorsed, replaces unmaintained community fork)
- AI matching: deterministic Postgres RPC (100-point scale, no external API) for MVP
- PostGIS `geography(POINT)` for spatial queries (with explicit TS type overrides)
- OAuth tokens in separate `trainer_gcal_tokens` table, not on `trainer_profiles`
- [Phase 21]: Silent 200 on duplicate email (23505) prevents enumeration attacks
- [Phase 21]: Service-role key for waitlist insert bypasses RLS without exposing anon policy
- [Phase 21-02]: Hero input uses type=text not type=email — browser HTML5 validation in jsdom blocks form submit before Zod runs
- [Phase 21-02]: Zod 4 uses result.error.issues not result.error.errors (breaking change from Zod 3)
- [Phase 21-02]: No waitlist position number shown — simple "You're In." confirmation per CONTEXT.md locked decision overriding WAITLIST-03 literal
- [Phase 22-01]: pg_cron scheduled with graceful DO $$ IF EXISTS $$ fallback — migration won't fail on Free plan
- [Phase 22-01]: expire_stale_availability auto-declines pending requests in two passes: first for trainers who went offline, then 30-minute timeout — order matters
- [Phase 22]: [22-02] DB write on goLive fires after 5s timeout completes — warm-up keeps trainer offline to clients (Pitfall 5 compliance)
- [Phase 22]: [22-02] AvailabilityHeader top-16 z-40, TrainerDashboard padding pt-32 -> pt-48 (nav 64px + header 64px)
- [Phase 22]: [22-02] cancelWarmup clears setTimeout without DB write — correct since no DB change happens during warm-up
- [Phase 22]: [22-02] 10-minute warning fires when remaining in 590-600s range to handle 1s tick jitter
- [Phase 22]: Request mode navigates immediately to /client/bookings after booking_requests insert — avoids payment wizard for request flow
- [Phase 22]: [Phase 22-03]: create_booking_atomic function signature added manually to supabase.ts Types until supabase types are regenerated
- [Phase 23-map-view-trainer-locations]: geo_point omitted from TS types — GENERATED ALWAYS column is server-side only
- [Phase 23-map-view-trainer-locations]: trainers_in_view uses SET search_path TO '' for security — all refs fully schema-qualified
- [Phase 23]: TrainerInfoCard rendered as AdvancedMarker (not floating div) to stay anchored to map coordinates
- [Phase 23]: RadiusCircle uses imperative google.maps.Circle with useEffect/useRef — no JSX return, cleanup on unmount
- [Phase 23]: Inline styles for pin internals inside AdvancedMarker — Tailwind utilities may not reliably apply in Google Maps DOM
- [Phase 23]: WorkoutLocationsManager wrapped in APIProvider with libraries=['places'] per @vis.gl/react-google-maps requirement
- [Phase 23]: GoLiveLocationPicker rendered outside header div using React Fragment — modal overlay sibling to sticky header
- [Phase 23]: Map component aliased as GoogleMap to avoid collision with native Map type
- [Phase 23]: filteredPins computed at MapView level shared between MapInner and MobileTrainerSheet
- [Phase 23.1-01]: New field Zod schemas are standalone (healthConditionsSchema etc.) not merged into fitnessPassportSchema — supports independent auto-save field-level validation
- [Phase 23.1-01]: HEALTH_CONDITION_VALUES uses as-unknown cast from .map() to satisfy Zod enum-compatible readonly tuple type
- [Phase 23.1-02]: Supabase TypeScript types not regenerated for client_profiles — use (supabase as any) cast rather than regenerating types mid-phase
- [Phase 23.1-02]: Use .toBeTruthy() not .toBeInTheDocument() in component tests — project has no vitest setup file for @testing-library/jest-dom matchers
- [Phase 23.1-03]: (supabase as any) cast for client_profiles secondary query in TrainerBookings — Supabase TS types not regenerated mid-phase
- [Phase 23.1-03]: ClientSummaryCard returns null when data is null — graceful no-op for unenriched booking requests
- [Phase 24-01]: expandedLogs tracked as Set<string> at TrainerBookings level — survives tab switches, avoids state loss on re-render
- [Phase 24-01]: isLocked based on slotEndTime + 86400000, not session_logs.created_at — trainer who logs immediately after session still has full 24hr edit window
- [Phase 24-01]: (supabase as any) cast for session_logs — project convention not to regenerate TS types mid-phase
- [Phase 24]: (supabase as any) cast for session_logs secondary query in MyBookings — project convention not to regenerate TS types mid-phase
- [Phase 24]: SessionNotesDisplay returns null when notes and exercises both empty — no expand button rendered for clients on bookings without logged data
- [Phase 24]: Two-query fallback in ProgressTab if nested Supabase join fails — maintains data display without crashing
- [Phase 24]: aggregateByWeek uses YYYY-WXX lexicographic sort key to avoid date parsing overhead
- [Phase 25]: localStorage for match cache (vs Supabase table): simpler, zero-infrastructure, sufficient for single-device MVP
- [Phase 25-01]: Single hourly_budget_max (not min+max range): simplifies scoring and UI; neutral 30/60 fallback when null
- [Phase 25-01]: clearMatchCache on ALL saveField calls: any passport change should invalidate stale matches
- [Phase 25]: CarouselInner inner component used to avoid conditional hook call in RecommendedCarousel role-gate block
- [Phase 25]: [Phase 25-02]: Silent null return on carousel fetch error — recommendation is non-critical path, main grid unaffected
- [Phase 26-ai-discount-analytics]: Status filter placed in ON clause of LEFT JOIN for get_trainer_idle_heatmap RPC to preserve LEFT JOIN semantics
- [Phase 26-ai-discount-analytics]: buildIdleCellMap uses 'day-hour' string key for O(1) heatmap cell lookup in Plan 02 UI
- [Phase 26-ai-discount-analytics]: Visible hours 6-22 only for fitness heatmap context
- [Phase 27]: Use sonner (not react-hot-toast) for toast.error in useLookingNow — project-wide toast library
- [Phase 27]: vi.hoisted() + waitFor pattern for async hook testing with React 19 + testing-library v16 + Vitest 4 (act() hangs in this environment)
- [Phase 27]: NotificationPreferencesSection wrapped in own APIProvider (no ancestor on ClientDashboard) - follows Pitfall 6 pattern
- [Phase 27]: LookingNowToggle renders null when geolocation unavailable - graceful degradation
- [Phase 28]: gcal-helpers listGcalEvents uses privateExtendedProperty=source!=fitrush to exclude FitRush booking events from blocks (Pitfall 4 prevention)
- [Phase 28]: GoogleCalendarCallback not wrapped in ProtectedRoute — popup window has no auth context
- [Phase 28]: Edge Function handles both connect and disconnect in one function via action param to keep deploy surface minimal
- [Phase 28]: prompt=consent + access_type=offline hardcoded in OAuth URL to guarantee refresh_token on every auth (Pitfall 1)
- [Phase 28]: sessionStorage for CSRF state in OAuth popup flow — cleared on tab close, scoped to origin
- [Phase 28]: GCal deletion on cancellation is best-effort (non-blocking) — cancellation never fails due to GCal
- [Phase 28]: sync-gcal-events accepts both service-role (pg_cron) and user auth (manual sync) in one function

## Blockers / Concerns

- **Phase 21**: Start Google OAuth consent screen verification immediately — 4–8 week external timeline
- **Phase 21**: Set GCP billing budget cap ($10/month) and restrict Maps API key before any map code ships
- **Phase 27**: Confirm `pg_net` extension availability on current Supabase plan before designing notification trigger (free tier requires pg_cron polling fallback)
- **Phase 28**: Google OAuth verification must complete before sync feature reaches production users

## Strategic Todos

- **TRUST INFRASTRUCTURE**: Differentiation must be built around: (1) verified credentials and safety guardrails (integrate certification verification flows already available), (2) transparent pricing and in-app cancellation with explicit renewal controls, (3) matching system that prevents availability and location misrepresentation before charging, (4) PT tooling that removes admin pain (autosave, undo, exercise-level notes, scalable programming, structured check-ins). Must deliver 2+ at meaningfully better level than incumbents to avoid slow growth, high churn, and expensive acquisition with low defensibility.

## Accumulated Context

- 20 phases shipped across 4 milestones (v1.0–v3.0)
- 57+ plans executed, 83+ requirements delivered
- ~17,700 LOC TypeScript/SQL, 14 Edge Functions, 22 migrations
- Supabase project: qecwxvvlpvrnrqyrdxrj
- Live at: fitrush-app.netlify.app

## Session Continuity

Last session: 2026-03-19T21:21:59.025Z
Stopped at: Completed 28-03-PLAN.md
Resume file: None
