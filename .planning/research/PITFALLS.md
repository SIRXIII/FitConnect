# Domain Pitfalls: v4.0 The Live Platform

**Domain:** Adding Google Maps, geolocation, real-time availability toggle, AI matching, Google Calendar OAuth sync, session logging, and push notifications to an existing Supabase/React fitness marketplace
**Project:** FitRush v4.0 — The Live Platform
**Researched:** 2026-03-18
**Confidence:** HIGH for Google Maps billing, Google OAuth, and race conditions (primary source verified). MEDIUM for geolocation battery/Capacitor and GDPR patterns (multiple sources, no official docs). LOW for AI cold-start recommendations (community patterns only).

---

## Critical Pitfalls

Mistakes in this section cause runaway billing, data corruption, App Store rejection, or regulatory exposure. Address before writing any v4.0 feature code.

---

### Pitfall 1: Google Maps API Cost Explosion — Multiple SKUs Billed Per Interaction

**What goes wrong:**

A single map interaction can trigger multiple billable SKUs simultaneously. Loading a map view fires the Maps JavaScript API SKU. Displaying trainer pins with address lookups fires the Places API SKU. Calculating distance to each trainer fires the Distance Matrix SKU. An autocomplete field fires the Places Autocomplete SKU (billed per keystroke). Developers see "Google gives $200/month free" and assume they're covered — but as of March 1, 2025, Google replaced the $200 monthly credit with per-SKU free caps: 10,000/month for Essentials SKUs and 5,000/month for Pro SKUs. A map view with trainer search, address autocomplete, and distance filtering can exhaust free tiers at a fraction of the expected request volume.

**Why it happens:**

The FitRush trainer search page already has filtering logic. Adding a map view feels like "just adding a component." But each feature layer (pins, clustering, address lookup, distance sort) maps to a different billing SKU that developers don't notice until the first invoice arrives. The landmark case: a startup's Google Maps bill went from $500 to $12,000 overnight when an unrestricted API key was scraped by a bot.

**Consequences:**

Uncontrolled Google Cloud billing. No hard billing cap exists by default — Google sends alerts but does not stop requests. An unguarded key or one viral traffic day can produce thousands of dollars in charges before anyone notices.

**Prevention:**

1. Set a Google Cloud Billing budget alert at $10/month and a hard quota cap via the Google Cloud Console Quotas page before any key is used in code.
2. Restrict the API key: HTTP referrer restrictions for the frontend key (fitrush-app.netlify.app), IP restrictions for any server-side key.
3. Audit every map feature against the SKU billing table before building. Specifically: avoid Places Details API for address display — store the formatted address string in `trainer_profiles` after a one-time geocode. Avoid Distance Matrix API for all trainers on every page load — compute distance client-side from stored lat/lng.
4. Use Static Maps API (not Dynamic Maps) anywhere interactivity is not needed (e.g., trainer profile address preview).
5. Cache geocode results in the database — never re-geocode an address that already has coordinates.

**Detection:** Google Cloud Console billing graph. Set daily cost anomaly alerts. Check `Maps JavaScript API` + `Places API` SKUs in billing breakdown separately.

**Phase:** Must address in the phase that adds Google Maps integration. Cannot defer.

---

### Pitfall 2: Capacitor iOS GPS — Background Location Destroys Battery, Apple Rejects Vague Justifications

**What goes wrong:**

Two distinct failure modes:

**Mode A — Battery drain:** Continuous GPS polling at high accuracy drains a device battery in 2–4 hours. The standard Capacitor Geolocation plugin (`@capacitor/geolocation`) does not have motion-detection intelligence. If the FitRush trainer availability toggle calls `watchPosition()` without a distanceFilter, it polls GPS at full rate even when the trainer is stationary at their gym.

**Mode B — App Store rejection:** iOS requires `NSLocationAlwaysAndWhenInUseUsageDescription` and `NSLocationAlwaysUsageDescription` keys in Info.plist for background location. Apple App Review rejects apps whose privacy usage description strings are generic ("We use your location"). They require a specific, user-benefit-oriented explanation. Apple additionally audits whether the declared background mode matches actual usage — an availability toggle does not inherently require "always on" background location.

**Why it happens:**

The FitRush iOS Capacitor wrapper is already configured (v3.0) but location was never needed. Adding GPS without understanding iOS entitlement tiers is a common oversight. The community plugin (`capacitor-community/background-geolocation`) is noted as less accurate and may fail silently in background.

**Consequences:**

App Store submission rejected in Review (2–4 day delay minimum, re-submission required). Or: app ships but trainers' phones die by 2pm. Negative reviews on battery. Churn from trainer side.

**Prevention:**

1. For the Uber-style availability toggle: do NOT use continuous GPS polling. The toggle should record a lat/lng snapshot on toggle-on, then stop polling. Only refresh location if the trainer manually updates or the sleep timer fires.
2. For client location-based notifications: use a one-time `getCurrentPosition()` call when the client opens the map, not a persistent watcher.
3. If background location is genuinely needed: use `transistorsoft/capacitor-background-geolocation` (commercial, $399 license) — it has motion-detection intelligence that turns off GPS when the device is stationary, cutting battery impact by 60–80%. Alternatively, geofencing via `CLRegionMonitoring` wakes the device only on boundary cross, not continuously.
4. Write a specific Info.plist description: "Your location is shared with FitRush only when you activate your availability to help clients find you nearby. Location is not tracked in the background."
5. Request "When In Use" authorization only. Do not request "Always" unless App Review will accept the justification — which requires demonstrating that background tracking is core to the app's primary function.

**Detection:** Test on a real device (not simulator) with Xcode Instruments Energy Log. Simulator does not accurately represent GPS battery impact.

**Phase:** Address in the availability toggle phase, before any App Store submission.

---

### Pitfall 3: Google Calendar OAuth — 4–8 Week Verification Blockade Before Production

**What goes wrong:**

`calendar.events` and `calendar.readonly` are classified as **sensitive scopes** under Google's OAuth verification framework. Any application requesting these scopes that is not in "Testing" mode (limited to 100 test users) must complete Google's OAuth app verification before it can authorize new users. Verification requires submitting a demonstration video, privacy policy URL, homepage URL, and detailed scope justification. The process takes 4–8 weeks and Google will reject for specific reasons that reset the clock.

Common rejection reasons observed in the developer community (2025):
- **Domain ownership not confirmed:** The authorized domain in the OAuth consent screen must be verified in Google Search Console under the same Google account that owns the GCP project.
- **Incomplete demo video:** Video must show the full OAuth consent screen URL bar visible, the login flow, and how calendar data is actually used in the app. Hiding the browser URL bar causes instant rejection.
- **Generic scope justification:** "We need calendar access to sync sessions" is rejected. Required: specific explanation of why read-write access is needed vs. read-only, what data is written back, and why a narrower scope is insufficient.
- **Missing developer contact email:** Google's Trust & Safety team sends "need more information" emails to the developer contact listed in the GCP project. If this email is unmonitored, the review pauses indefinitely.

**Why it happens:**

The FitRush iCal export (v3.0) uses a token-based feed — no OAuth required. The jump to bidirectional Google Calendar sync requires OAuth, which is a different compliance track entirely. Teams often discover the verification requirement only after coding the full sync feature.

**Consequences:**

Google Calendar sync feature built but blocked from production users for 4–8 weeks. Or: app ships in Testing mode, then breaks for users #101+ who get "This app is not verified" error and cannot complete OAuth.

**Prevention:**

1. Start the OAuth consent screen verification process before writing any bidirectional sync code. Submit as soon as the privacy policy is live and the domain is verified in Search Console.
2. Request only `calendar.events` (read-write) not broader scopes. Justify specifically: "FitRush writes one calendar event per booking and reads events solely to detect scheduling conflicts. No calendar data is stored on FitRush servers beyond the event ID for update/delete operations."
3. Monitor the developer contact email in GCP daily during review. A 48-hour non-response to a Google inquiry can extend the review by weeks.
4. Plan the feature phases so that the one-way iCal feed (already shipped) remains the fallback for users while verification is pending.

**Detection:** GCP Console → APIs & Services → OAuth consent screen → Verification status.

**Phase:** Start verification in the first phase that plans Google Calendar work. Build the UI and sync logic in parallel with the verification timeline.

---

### Pitfall 4: Race Condition — Availability Toggle + Booking Create Fire Simultaneously

**What goes wrong:**

The existing `availability_slots` table uses a soft-delete pattern (`deleted_at` column). The current booking flow reads a slot, checks availability, then creates a booking. This is a classic check-then-act race condition. With an Uber-style online/offline toggle that marks all upcoming slots as unavailable, a client booking flow that started 200ms before the toggle fires can complete successfully against a slot that the trainer just deactivated.

A second race: two clients both open the same trainer's slot at the same millisecond (e.g., from the new map view). Both read the slot as available. Both proceed to payment. Both payments succeed at Stripe. One booking gets written first; the other creates a double-booking because the check happened before either write.

**Why it happens:**

Supabase's architecture makes classic pessimistic locking (`SELECT ... FOR UPDATE` held across an HTTP request boundary) impractical. The JS client auto-commits transactions, releasing locks between operations. The existing booking flow works for low-concurrency because simultaneous bookings are rare — but the map view with live "online now" trainer indicators will increase concurrent attempts for popular trainers.

**Consequences:**

Double-booked sessions. Trainer shows up to two clients. Payment charged to client for a session that then gets cancelled because the trainer went offline. Trust damage is severe for a premium marketplace.

**Prevention:**

1. Move the slot availability check and booking creation into a single PostgreSQL RPC function using `SERIALIZABLE` transaction isolation or a `SELECT ... FOR UPDATE` within a stored procedure called via `supabase.rpc()`. Since the entire operation executes server-side in one transaction, locks hold correctly.
2. For the availability toggle: use an atomic DB update — `UPDATE availability_slots SET deleted_at = NOW() WHERE trainer_id = $1 AND start_time > NOW() AND deleted_at IS NULL` — not a series of individual row updates.
3. Add a unique partial index on `availability_slots (slot_id)` where `deleted_at IS NULL` to enforce at the DB level that only one active booking can reference a slot.
4. On the Realtime subscription for slot availability: optimistically mark slots as "pending" in the UI the moment a booking attempt starts, before the DB confirms.

**Detection:** Write a Vitest concurrent test that fires two booking requests for the same slot simultaneously and asserts only one succeeds.

**Phase:** Must address in the availability toggle phase. The existing system has tolerable risk at current traffic; the live map view changes the concurrency profile significantly.

---

## Moderate Pitfalls

Mistakes in this section cause user experience failures, data integrity issues, or integration blockers that require rework.

---

### Pitfall 5: Notification Spam — Location Alerts Fire Too Frequently, Users Disable Notifications

**What goes wrong:**

A location-based alert system that fires every time a trainer comes online within a client's saved area will produce 5–15 notifications per day for active clients in dense urban areas. Push notification open rates dropped 31% since 2020 according to OneSignal's 2025 data, largely due to alert fatigue. Users who receive more than 10 notifications per hour reduce engagement by 52%. For a luxury marketplace, unsolicited frequency signals spam rather than service.

**Why it happens:**

The existing `notifications` table and `send-notification-email` edge function send one notification per event. Wiring availability toggle events directly to this pipeline with no throttling or preference checks creates a many-to-many fan-out: every trainer toggle fires a notification to every client who has that trainer's area saved.

**Consequences:**

Push notification permission revocation. iOS and Android prompt users to review notification permissions after repeated dismissals. Once revoked, re-requesting is not possible without a re-install prompt. Users who revoke notifications are effectively invisible to the retention channel.

**Prevention:**

1. Implement notification frequency caps at the user level: maximum one location alert per trainer per 4-hour window, maximum 3 location alerts total per day per client.
2. Build a notification preferences UI before launching location alerts. Allow clients to set: preferred areas, minimum trainer rating filter for alerts, days/times to receive alerts (e.g., "weekday mornings only").
3. Delay the first location alert for a newly online trainer by 60 seconds — trainers who toggle on briefly then off should not trigger a broadcast.
4. Track notification dismissal rates in the `notifications` table (add a `dismissed_at` column). Auto-reduce frequency for users who consistently dismiss without clicking.

**Phase:** Notification preferences UI must ship before the location-based alert feature goes live.

---

### Pitfall 6: PostGIS Extension — Added Complexity for FitRush's Actual Query Patterns

**What goes wrong:**

PostGIS is the standard recommendation for geospatial queries in PostgreSQL, but it adds operational complexity that may not be justified for FitRush's query pattern. FitRush needs: (a) find trainers within X miles of a point, (b) sort trainers by distance. These are achievable without PostGIS using PostgreSQL's built-in `earth_distance` extension with a GiST index on a `point` column, or simply with the Haversine formula in a SQL function.

PostGIS-specific pitfalls:
- Enabling PostGIS on Supabase requires a migration and cannot be done via the table UI
- PostGIS geometry column data types are opaque to Supabase's auto-generated TypeScript types — the existing `supabase gen types typescript` workflow breaks for geometry columns, requiring manual type overrides
- The existing FitRush codebase already uses `as unknown as X` casts for RPC types (noted in PROJECT.md) — PostGIS would add more of these
- `ST_DWithin` queries require the geometry to be in a projected CRS (EPSG:3857) for accurate meter-based distances, not WGS84 (EPSG:4326) latitude/longitude — using the wrong CRS produces silently wrong distances

**Why it happens:**

"Use PostGIS for geodata" is the default recommendation. But for a single-city or metro-area marketplace with fewer than 10,000 trainers, the `earth_distance` extension with a Haversine function is 95% as accurate for distances up to 50 miles, requires no special data types, and works with standard Supabase TypeScript client types.

**Prevention:**

1. Use `earth_distance` + `cube` extensions (already available in Supabase) rather than PostGIS unless polygon/routing queries are needed.
2. Store trainer location as `lat FLOAT, lng FLOAT` columns on `trainer_profiles` — simple to type, simple to migrate, compatible with existing Supabase JS client.
3. Create a PostgreSQL function `trainers_within_distance(lat, lng, radius_miles)` as an RPC. Returns trainer IDs sorted by distance. Client renders pins from this response.
4. If PostGIS is chosen later (e.g., geofencing with polygon boundaries), add it as an extension to a separate migration, not mixed with the trainer location column migration.

**Phase:** Decide before the trainer location migration. Changing coordinate storage format after data exists requires a data migration.

---

### Pitfall 7: AI Matching Cold Start — New Clients and New Trainers Produce Garbage Recommendations

**What goes wrong:**

The AI matching feature relies on Fitness Passport data (goals, workout types, frequency, limitations) for the client side and booking history for the trainer side. New clients who skip or minimally fill in the Fitness Passport get generic recommendations indistinguishable from the existing search sort. New trainers with zero bookings have no signal for compatibility matching.

FitRush's PROJECT.md explicitly rules out ML models ("Requires 6-12 months of booking data"). The AI matching MVP will therefore use content-based filtering (match Fitness Passport fields to trainer specialties) rather than collaborative filtering. Content-based filtering still fails when the Fitness Passport is empty — there is no data to match against.

**Why it happens:**

The v3.0 Fitness Passport intake is optional-feeling: clients can fill in varying levels of detail. The onboarding flow doesn't force completion before showing the trainer search. A client who skipped goals and workout types receives a match score based on zero overlapping fields.

**Consequences:**

AI matching shows recommendations that are random or purely rate-sorted, identical to the existing search. Users distrust the "AI" label. The feature becomes a liability rather than a differentiator.

**Prevention:**

1. Gate the AI match score display behind Fitness Passport completeness. Show "Complete your profile to see your match score" placeholder instead of a low-confidence score.
2. Define a minimum Fitness Passport completeness threshold (e.g., at least goals + one workout type selected) before generating any match score.
3. For new trainers (zero bookings): weight trainer specialty tags and certification data heavily. A trainer with "strength training" specialty gets a non-zero match score against a client with strength goals even without booking history.
4. Add a Fitness Passport completion prompt in the booking wizard (Step 1) — "Your Fitness Passport helps us recommend the right trainer. Takes 30 seconds." This converts the passive optional into an active nudge at the highest-intent moment.
5. Log every match score calculation with the input fields used. After 30 days, identify which fields drive the most bookings — prioritize those in the onboarding flow.

**Phase:** Fitness Passport completeness prompt should ship before or with AI matching. Match score must have a confidence threshold below which it is hidden.

---

### Pitfall 8: Google Calendar Bidirectional Sync — Conflict Resolution Is a Product Decision, Not a Technical One

**What goes wrong:**

Bidirectional sync has three conflict scenarios:
1. A session booked on FitRush exists. Trainer deletes it from Google Calendar. What happens to the booking?
2. Trainer creates a manual "busy" block in Google Calendar. Client tries to book that time. Does the block prevent booking?
3. Trainer reschedules a booking in Google Calendar. FitRush doesn't know about the time change.

There is no universally correct resolution strategy. Last-write-wins (by timestamp) silently discards legitimate calendar edits. Source-of-truth-is-FitRush means Google Calendar is read-only in practice, defeating the purpose of bidirectional sync. Merge strategies require knowing which fields changed on each side, requiring storing "shadow copies" of every synced event.

**Why it happens:**

The existing FitRush iCal export is one-way (FitRush → calendar). The mental model of "just make it two-way" underestimates the semantic complexity. A trainer who deletes a FitRush session from their Google Calendar probably means "I want to cancel this booking," not "I want to hide this from my calendar view."

**Consequences:**

Undetected cancellations (trainer deletes from calendar, client shows up expecting a session). Sync loops where FitRush re-creates deleted events, Google deletes again, infinitely. Trust damage when calendar and app are out of sync.

**Prevention:**

1. Define explicit rules in the product spec before writing sync code:
   - **FitRush is authoritative for booking existence.** Deleting a FitRush booking from Google Calendar does NOT cancel it — it only removes the calendar event.
   - **Google Calendar is authoritative for busy/blocked time.** A manually created "busy" block in Google Calendar prevents FitRush from allowing bookings in that time window.
   - **Reschedule must happen in FitRush.** Calendar edits to booking time are not synced back.
2. Store a `gcal_event_id` on each booking for update/delete targeting. Never re-create an event that was deleted from Google Calendar — mark it as `gcal_sync: 'detached'` instead.
3. Implement sync loop prevention: tag all FitRush-created calendar events with an `extendedProperty` (e.g., `source: 'fitrush'`). On webhook receive, skip events with this tag when determining what "changed."
4. Use Google Calendar push notifications (webhooks) rather than polling. Polling `events.list` every N minutes is rate-limited and introduces staleness. Webhook channels expire every 7 days and must be renewed via a cron job.

**Phase:** Write the product rules document before the sync implementation phase. The implementation is straightforward once rules are defined; the danger is building without them.

---

### Pitfall 9: Geofencing Accuracy — Urban GPS Drift Produces False "Nearby" Triggers

**What goes wrong:**

Geofencing accuracy in urban environments ranges from 100–200 meters due to GPS signal multipath (signals bouncing off buildings). In a dense metro area, a trainer at a gym and a trainer two blocks away may both trigger "nearby" notifications for a client standing outside their apartment building. A 500-meter radius geofence in Manhattan can encompass 20+ gyms.

The FitRush use case — "notify me when a trainer comes online near me" — is based on the client's saved area (presumably a neighborhood or zip code, not a precise GPS point). The saved area is a coarse polygon, not a GPS geofence. Conflating these two concepts produces either over-broad notifications (too many false positives) or under-broad notifications (trainers 0.4 miles away not included).

**Why it happens:**

"Location-based notification" sounds like geofencing, but FitRush's actual requirement is proximity search against a database of trainer locations, not OS-level geofence monitoring. OS geofencing fires when the device crosses a boundary; FitRush needs to fire when a trainer's status changes and the trainer's location is within the client's preferred area.

**Prevention:**

1. Do not use OS-level geofencing (`CLLocationMonitor`) for the client notification feature. The correct approach is: when a trainer toggles online, run a server-side proximity query (`trainers_within_distance`) against all clients who have opted into location alerts and have a saved area that overlaps the trainer's location. Push the notification from the server (via `send-notification-email` edge function extended to support push).
2. Use a minimum radius of 2 miles for saved-area proximity. Smaller radii produce too many false negatives due to GPS drift and address geocoding imprecision.
3. For the map view, show trainers within the visible map bounds (bounding box query), not within a fixed radius. Bounding box queries are cheaper and more intuitive than radius queries for a map interface.

**Phase:** Define whether "saved area" means a neighborhood polygon, a zip code, or a radius before the notification phase. This choice affects the data model.

---

### Pitfall 10: Supabase Realtime — Channel Count Grows With Concurrent Map Users

**What goes wrong:**

The FitRush map view showing live trainer availability will subscribe every connected user to trainer status changes. The current Supabase Realtime architecture uses one channel per subscribed table + filter combination. If each client subscribes to individual trainer channels to get live pin updates, a map with 50 visible trainers requires 50 channels per connected user. With 20 concurrent map users, that's 1,000 channels.

Supabase's free plan has a concurrent connection limit (documented at ~200 peak connections). The Pro plan increases this but still charges $10 per 1,000 peak connections over quota. Presence channels (for tracking "who is currently online") have separate message rate limits.

**Why it happens:**

The existing Supabase Realtime usage is for messaging (point-to-point channels). The map view requires a fan-out pattern: all online trainers, broadcast to all viewing clients. Fan-out is architecturally different and often implemented naively as N individual channels.

**Prevention:**

1. Use a single broadcast channel for trainer availability updates (`trainer_availability`), not one channel per trainer. Publish all status changes to this channel and filter client-side by visible map bounds.
2. Alternatively, use Supabase Realtime Postgres Changes on the `trainer_profiles` table filtered by `is_online = true` — a single subscription covers all trainer status changes.
3. Set a debounce on the map's Realtime listener: don't re-render pin positions on every message — batch updates at 2-second intervals.
4. Implement a fallback polling mode (every 30 seconds) for clients who hit connection limits or whose WebSocket is blocked by a corporate firewall. Realtime is an enhancement, not a requirement for core functionality.

**Phase:** Realtime architecture design must be decided before building the map view. Retrofitting from N channels to 1 channel requires client and server changes.

---

## Minor Pitfalls

Mistakes in this section cause rework or polish failures but do not block shipping.

---

### Pitfall 11: GDPR / Privacy — Location Data Requires Explicit Consent and Data Minimization

**What goes wrong:**

GPS coordinates are personal data under GDPR. For EU users (FitRush is US-first, but any EU visitor counts), storing precise GPS coordinates requires:
- Explicit consent (not just acknowledgment in ToS) before location collection begins
- A stated retention period for location data
- The ability to delete location history on request

The existing FitRush `export-user-data` edge function exports profile data but does not include location history. The existing account deletion path (deferred in PROJECT.md) does not purge location records.

Additionally, fitness data (workout types, limitations, health goals in the Fitness Passport) may qualify as health data under GDPR Article 9, requiring special processing conditions. Adding AI matching that processes health data to make recommendations (matching trainers to clients with physical limitations) increases this risk profile.

**Prevention:**

1. Add a location consent checkbox to the "Enable location features" toggle — separate from general ToS acceptance. Store consent timestamp and version.
2. Define a location data retention policy in the privacy policy (e.g., "Location snapshots are retained for 30 days then deleted"). Implement an automated cleanup via a pg_cron job: `DELETE FROM location_snapshots WHERE created_at < NOW() - INTERVAL '30 days'`.
3. Extend the `export-user-data` edge function to include location history when adding location features.
4. For Fitness Passport data used in AI matching: the matching computation should occur server-side and return a score, not expose raw health data to client-side matching logic.

**Phase:** Consent UI and data retention policy must exist before location data is collected. Retrofit is technically simple but legally requires that no data was collected without consent.

---

### Pitfall 12: Google Maps API Key Exposed in Frontend Bundle

**What goes wrong:**

The Maps JavaScript API key is loaded in the browser (unavoidable for a JS API). An unrestricted key scraped from the bundle allows any third party to load maps at the FitRush billing account's expense. This is one of the most common Google Cloud billing emergencies.

**Prevention:**

1. Restrict the API key to HTTP referrers: `fitrush-app.netlify.app/*` and `localhost:*` for development. Create a separate key for each environment.
2. Enable only the specific APIs needed on each key (Maps JavaScript API, Places API). Do not use a single omnibus key.
3. Set a Google Cloud billing quota limit per API per day (e.g., Maps JavaScript API: 2,000 loads/day initially). This caps exposure if the key is abused.

**Phase:** Before committing any code that imports the Maps API.

---

### Pitfall 13: Session History — `session_notes` Contains PHI If Trainers Document Injuries

**What goes wrong:**

Post-session notes written by trainers ("client mentioned knee pain," "modified squats due to lower back issue") can qualify as Protected Health Information (PHI) under HIPAA if FitRush operates in a context where trainers are providing health-related services. The existing Fitness Passport data (limitations field) is already borderline. If session notes are stored in plaintext in a Supabase column with standard RLS, a data breach exposes health records.

FitRush is not a HIPAA-covered entity (it's a marketplace, not a healthcare provider), but the data it holds may be subject to FTC Health Breach Notification Rule.

**Prevention:**

1. Scope session notes to objective workout data: sets, reps, weights, exercises performed. Add guidance in the UI: "Record workout details, not medical observations."
2. Do not store session notes in plaintext if they may contain health information. At minimum, ensure RLS prevents clients from reading trainer notes unless the trainer explicitly shares them.
3. Add a note in the privacy policy that trainers are responsible for not entering PHI into session notes.

**Phase:** Define the session notes schema with these constraints before building the feature.

---

### Pitfall 14: iCal Export Token Conflict After Adding OAuth Sync

**What goes wrong:**

The existing iCal feed uses an `opaque calendar_export_token` on `trainer_profiles` (v3.0 decision). The upcoming Google Calendar OAuth sync will need to store `gcal_access_token`, `gcal_refresh_token`, and `gcal_token_expiry`. These are different credentials for different purposes but both live on the trainer profile. A developer adding the OAuth columns may accidentally touch the iCal token column or use a confusingly similar naming convention.

**Prevention:**

1. Keep OAuth credentials in a separate table (`trainer_gcal_tokens`) rather than adding columns to `trainer_profiles`. This isolates the sensitive refresh tokens, limits their surface area in RLS policies, and keeps `trainer_profiles` readable without exposing OAuth credentials.
2. Never include `gcal_refresh_token` in the `trainer_profiles` select in the frontend. The token should only be readable by the edge function that performs calendar operations.

**Phase:** Decide the storage architecture before the Google Calendar OAuth migration.

---

## Phase-Specific Warnings

| Phase Topic | Pitfall | Severity | Mitigation |
|-------------|---------|----------|------------|
| Google Maps integration | Multiple SKUs billed per map load (Pitfall 1) | CRITICAL | Set billing cap before first commit |
| Google Maps integration | API key exposed in bundle (Pitfall 12) | HIGH | Restrict to HTTP referrer before any key usage |
| Trainer location storage | PostGIS type complexity vs. simple lat/lng (Pitfall 6) | MEDIUM | Choose `earth_distance` unless polygon queries needed |
| Availability toggle | Race condition with concurrent booking (Pitfall 4) | CRITICAL | Atomic RPC function for check + book |
| Availability toggle | iOS battery drain from GPS polling (Pitfall 2) | HIGH | Snapshot on toggle, no continuous `watchPosition` |
| Availability toggle iOS | App Store rejection for vague location justification (Pitfall 2) | HIGH | Specific Info.plist description before submission |
| Location notifications | Notification spam / user fatigue (Pitfall 5) | HIGH | Frequency caps + preferences UI ships first |
| Location notifications | Geofencing accuracy in urban areas (Pitfall 9) | MEDIUM | Use server-side proximity query, not OS geofencing |
| AI matching | Cold start for new users (Pitfall 7) | MEDIUM | Gate match score on Fitness Passport completeness |
| Google Calendar sync | OAuth verification 4–8 week timeline (Pitfall 3) | CRITICAL | Start verification before coding sync feature |
| Google Calendar sync | Bidirectional conflict resolution (Pitfall 8) | HIGH | Write product rules before implementation |
| Google Calendar sync | iCal token conflict with OAuth columns (Pitfall 14) | MEDIUM | Store OAuth creds in separate table |
| Real-time map view | Supabase Realtime channel count explosion (Pitfall 10) | MEDIUM | Single broadcast channel, not per-trainer channels |
| Session history | PHI risk in trainer notes (Pitfall 13) | MEDIUM | Scope to workout data, add UI guidance |
| Any location feature | GDPR consent and retention (Pitfall 11) | MEDIUM | Consent checkbox and pg_cron cleanup before collection |

---

## Integration-Specific Warnings for Existing FitRush Code

### Existing `availability_slots` soft-delete pattern
The `deleted_at IS NULL` filter used throughout the codebase will need to interact correctly with the online/offline toggle. Ensure the toggle uses the same soft-delete pattern (`deleted_at = NOW()`) rather than a separate `is_cancelled` flag — otherwise existing RLS policies and queries that filter by `deleted_at` will miss toggled-off slots.

### Existing `notifications` table fan-out
The current notification system fires one row per notification per user. Location-based alerts to all clients in an area will create N rows per trainer toggle event. At scale this creates table bloat. Consider adding a `notification_type = 'location_alert'` category with a separate retention policy (auto-delete after 7 days) to prevent unbounded growth.

### Existing `stripe-webhook` and `create-payout` edge functions
Session history with completion logging may interact with payout eligibility (completed sessions unlock trainer earnings). If session completion is confirmed via a new "session logged" event rather than booking status, ensure the payout calculation SQL query is updated to include both paths.

### Existing TypeScript `as unknown as X` casts
If adding an RPC function for the atomic booking operation (Pitfall 4 prevention), add a proper TypeScript type for the RPC response to the `database.types.ts` file. Stacking another untyped RPC call will degrade the codebase health noted in PROJECT.md.

---

## Sources

- [Google Maps Platform API Pricing 2025](https://developers.google.com/maps/billing-and-pricing/pricing) — HIGH confidence (official docs)
- [Google Maps Platform Manage Costs](https://developers.google.com/maps/billing-and-pricing/manage-costs) — HIGH confidence (official docs)
- [Google Maps API Cost Gotchas 2026](https://radar.com/blog/google-maps-api-cost) — MEDIUM confidence (verified against official pricing)
- [Google Sensitive Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) — HIGH confidence (official docs)
- [Google OAuth Consent Screen Configuration](https://developers.google.com/workspace/guides/configure-oauth-consent) — HIGH confidence (official docs)
- [Google OAuth Verification: Costs, Timelines, Process](https://www.nylas.com/blog/google-oauth-app-verification/) — MEDIUM confidence (multiple developer reports corroborate)
- [OAuth Consent Screen review for calendar.readonly](https://issuetracker.google.com/issues/461543459) — MEDIUM confidence (official Google Issue Tracker)
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) — HIGH confidence (official docs)
- [Supabase Realtime Concurrent Peak Connections Quota](https://supabase.com/docs/guides/troubleshooting/realtime-concurrent-peak-connections-quota-jdDqcp) — HIGH confidence (official docs)
- [Transistorsoft Capacitor Background Geolocation](https://transistorsoft.github.io/capacitor-background-geolocation/classes/backgroundgeolocation.html) — MEDIUM confidence (official plugin docs)
- [Capacitor Community Background Geolocation](https://github.com/capacitor-community/background-geolocation) — MEDIUM confidence (official plugin repo)
- [PostGIS Geo Queries Supabase](https://supabase.com/docs/guides/database/extensions/postgis) — HIGH confidence (official Supabase docs)
- [Supabase Distance-Based Filtering](https://blog.mansueli.com/leveraging-supabase-and-postgresql-for-distance-based-filtering-and-location-data-retrieval) — MEDIUM confidence (verified pattern)
- [Supabase Race Conditions SERIALIZABLE Isolation](https://github.com/orgs/supabase/discussions/30334) — MEDIUM confidence (official Supabase discussion)
- [Geofencing Accuracy Real-World](https://radar.com/blog/how-accurate-is-geofencing) — MEDIUM confidence (industry source with cited data)
- [GDPR Compliance for Fitness Apps](https://www.gdpr-advisor.com/gdpr-compliance-for-fitness-apps-safeguarding-personal-health-information/) — MEDIUM confidence (regulatory guidance, not official DPA document)
- [Alert Fatigue Push Notifications 2025](https://onesignal.com/blog/how-mobile-push-expectations-have-changed/) — MEDIUM confidence (OneSignal industry data)
- [Bidirectional Calendar Sync 2025](https://calendhub.com/blog/implement-bidirectional-calendar-sync-2025/) — LOW confidence (community guide, verify implementation details)
- [Cold Start Problem Recommender Systems 2025](https://www.shaped.ai/blog/glossary-cold-start-problem) — MEDIUM confidence (multiple sources agree on content-based fallback pattern)
