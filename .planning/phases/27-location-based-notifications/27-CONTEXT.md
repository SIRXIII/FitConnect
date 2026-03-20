# Phase 27: Location-Based Notifications - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning
**Source:** Auto-mode (Claude's best judgment based on project patterns)

<domain>
## Phase Boundary

Clients can opt into location-based alerts, configure preferred area/neighborhood, enable live GPS "looking now" mode, and receive in-app notifications when a nearby trainer goes live. Frequency caps (3/day per client, 4hr cooldown per trainer) are enforced. Preferences must be configured before any alerts fire.

</domain>

<decisions>
## Implementation Decisions

### Notification preferences UI
- New "Notification Preferences" section on ClientDashboard (or ClientPassport)
- Toggle: Location-based alerts ON/OFF (master switch)
- Area selector: text input for neighborhood/city with Google Places Autocomplete (reuse from WorkoutLocationsManager)
- Radius slider: 1-10 miles (how far to search for trainers)
- Preferences MUST be set before any notifications fire (gate check)

### "Looking Now" live GPS mode
- Toggle button in the search/map area: "Looking Now" with pulsing indicator
- When active: uses browser geolocation API for real-time position instead of saved area
- Auto-disables after 2 hours (safety cap — battery consideration)
- Only available on mobile (Capacitor) and desktop browsers with geolocation

### In-app notification delivery
- Use existing `notifications` table pattern (already exists from prior milestones)
- Notification appears as a card in the notification dropdown/panel
- Content: "{Trainer Name} just went live at {Location} — {rate}/hr" with "View" CTA
- Triggered when a trainer calls goLive and there are clients with matching area preferences
- Edge Function or database trigger fires on trainer availability_status change to 'live'

### Frequency caps
- Max 3 location-based alerts per client per day (rolling 24hr window)
- 4-hour cooldown per trainer per client (same trainer can't re-notify within 4hrs)
- Enforced server-side in the notification trigger/function
- Caps stored as columns or checked via query on notifications table with timestamp filtering

### Claude's Discretion
- Whether to use a Supabase Edge Function or database trigger for notification creation
- Exact notification card styling (should match existing notification patterns)
- How "Looking Now" interacts with the map view (auto-center? show radius?)
- Whether radius uses Haversine or PostGIS distance (PostGIS preferred since already available)
- Notification preferences table schema vs columns on client_profiles

</decisions>

<canonical_refs>
## Canonical References

### Existing notification infrastructure
- `src/components/shared/NotificationPanel.tsx` or similar — existing notification UI
- `notifications` table — existing notification storage

### Location infrastructure (Phase 23)
- `src/hooks/useWorkoutLocations.ts` — Places Autocomplete pattern
- `src/components/trainer/WorkoutLocationsManager.tsx` — Address input with map preview
- PostGIS `trainers_in_view` RPC — spatial query pattern

### Availability (Phase 22)
- `src/hooks/useAvailabilitySession.ts` — goLive trigger point
- `src/components/trainer/AvailabilityHeader.tsx` — where goLive is called

### Database
- `.planning/REQUIREMENTS.md` — NOTIF-01 through NOTIF-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- notifications table + NotificationPanel — extend with location-based notification type
- Places Autocomplete from WorkoutLocationsManager — reuse for area selector
- PostGIS spatial queries — reuse for nearby trainer matching
- Geolocation API usage in MapView — reuse for "Looking Now"

### Integration Points
- goLive function — trigger point for sending notifications
- notifications table — storage
- client_profiles or new preferences table — store notification preferences
- Capacitor geolocation plugin (already in project for map)

</code_context>

<specifics>
## Specific Ideas

- "Looking Now" should feel like an Uber-style active search mode
- Notification content should be actionable — tap to view the trainer
- Frequency caps prevent notification fatigue while keeping the feature useful

</specifics>

<deferred>
## Deferred Ideas

- Push notifications via FCM/APNs — requires separate infrastructure, out of scope for v4.0
- Background location tracking — iOS App Store rejection risk, explicitly out of scope
- "Notify me when X trainer goes live" — trainer-specific alerts, could be future phase

</deferred>

---

*Phase: 27-location-based-notifications*
*Context gathered: 2026-03-19 via auto-mode*
