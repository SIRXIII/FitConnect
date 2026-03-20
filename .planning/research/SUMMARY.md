# Project Research Summary

**Project:** FitRush v4.0 — The Live Platform
**Domain:** Fitness marketplace SPA — real-time availability, maps, AI matching, calendar sync, session tracking
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

FitRush v4.0 transforms an existing booking marketplace into an Uber-style live platform. The approach is well-understood: an online/offline toggle drives real-time map pin visibility via Supabase Realtime, Google Maps displays clustered trainer pins, and AI matching surfaces personalized trainer recommendations from the existing Fitness Passport data. The core technical model is an event-driven pipeline — trainer goes live, a Supabase DB trigger fires a location-notify Edge Function, a proximity query finds opted-in clients, notifications flow through the existing system. Only 2 new npm packages are needed on the frontend; all AI and calendar work runs server-side in Edge Functions.

The recommended build order prioritizes value over complexity: email capture ships in a day (zero dependencies), the availability toggle unblocks maps and notifications, session logging delivers immediate retention value with no external services, and AI matching can be deterministic (no ML, no external API) using the Fitness Passport data already in the database. Google Calendar bidirectional sync is the highest-complexity feature — it requires 4–8 weeks of Google OAuth verification before it can be used in production, so the process must begin before a single line of sync code is written.

The three non-negotiable risks to address before any v4.0 feature code ships: (1) set a hard Google Cloud billing budget cap to prevent runaway Maps API costs, (2) start Google OAuth app verification immediately for the calendar sync feature, and (3) wrap the existing booking creation in an atomic PostgreSQL RPC to prevent race conditions that the new live map view will make far more likely. All other pitfalls are addressable at the phase level.

## Key Findings

### Recommended Stack

The v4.0 stack is deliberately minimal. The entire feature set adds only 2 new npm packages to the frontend: `@vis.gl/react-google-maps` (Google's officially sponsored React library, replacing the unmaintained community fork) and `@googlemaps/markerclusterer` (official Google clustering library using supercluster internally). All other new capabilities — Google Calendar sync, AI matching, geolocation, location-based notifications — run server-side in Supabase Edge Functions (Deno), leaving the React bundle clean.

The existing stack handles everything else: Supabase Realtime for live map updates, pgvector for embedding-based matching (or deterministic Postgres RPCs for rule-based matching), `earth_distance` or PostGIS for proximity queries, Recharts for analytics charts, Zod + react-hook-form for the session log form, and Resend for notification emails.

**Core new technologies:**
- `@vis.gl/react-google-maps` ^1.x: Map display, AdvancedMarkers, Places Autocomplete — Google-endorsed, actively maintained
- `@googlemaps/markerclusterer` ^2.x: Cluster nearby trainer pins — official Google library, no redundant supercluster install needed
- PostGIS (Supabase extension): `ST_DWithin` for trainer proximity queries — enables spatial index on `geography(POINT)` column
- `googleapis` in Edge Function: Server-side Google Calendar OAuth and event writes — client_secret cannot live in the browser
- Gemini API (`gemini-2.0-flash-lite`) or deterministic Postgres RPC: AI matching — both options valid; deterministic RPC preferred for MVP cost and predictability
- `pgvector` (Supabase extension, already available): Embedding-based matching at scale — enable with migration, negligible cost
- `navigator.geolocation` (browser built-in) + `@capacitor/geolocation` (already installed): Cross-platform GPS via unified `useGeolocation()` hook — no new install needed

**New env vars:**
- `VITE_GOOGLE_MAPS_API_KEY` (frontend, domain-restricted)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY` (Edge Function secrets)

**What to defer:** Web Push (FCM + service worker + iOS limitations), background geolocation (`transistorsoft` $399 license), any ML model training.

### Expected Features

Research confirms 8 distinct features for v4.0. Features 1–3 form a tightly coupled core; Features 4–8 are independently shippable.

**Must have (table stakes):**
- Map view with trainer pins, clustering, InfoWindow, map/list toggle — users expect map discovery for any local service
- Uber-style online/offline toggle with pg_cron sleep timer — the entire live platform concept depends on this
- Location-based in-app notifications ("trainer nearby is now available") — payoff of the toggle
- AI trainer-client matching with visible match score and explanation — Fitness Passport data creates an expectation of personalization
- Post-session notes (trainer-written) visible to client — continuity and retention driver
- Email capture on landing page — zero-dependency, immediate business value

**Should have (competitive differentiators):**
- Real-time pin visibility tied to live toggle (only online trainers show as pins)
- Sleep timer auto-off (1hr, 2hr, 4hr, end of day) — prevents false availability signals
- AI discount analytics with idle pattern detection and actionable recommendation cards
- Structured workout log (JSONB fields: exercises, sets, reps, RPE) with Recharts progress charts
- Google Calendar bidirectional OAuth sync — push bookings to GCal, block FitRush slots from external GCal events
- Position-in-line display ("You're #342") on email capture

**Defer to v4.1+:**
- Auto-on scheduling (complex per-trainer cron, high complexity relative to value)
- "Clients like you also booked" collaborative filtering (needs 6+ months of booking data)
- Discount effectiveness tracking with historical snapshots (requires schema change for snapshot at booking time)
- Web Push / browser notifications (FCM + service worker + iOS PWA push limitations)
- Wearable integrations (Apple Health, Fitbit) — different product category
- Waitlist referral mechanic — full growth product, not needed for MVP

### Architecture Approach

The architecture follows a clear pattern: React SPA handles display and user interaction, Supabase Edge Functions handle all external API calls (Google Maps geocoding, Google Calendar writes, AI inference), PostgreSQL RPCs handle complex queries atomically, and Supabase Realtime broadcasts trainer availability changes to all connected map viewers via a single broadcast channel (not per-trainer channels). The existing 14 Edge Functions are extended, not replaced: `cancel-booking` gains GCal event deletion, `send-notification-email` gains a `trainer_available_nearby` notification type.

The most important architectural decision: PostGIS `geography(POINT)` columns on `trainer_profiles` and a new `trainer_locations` table, with a sync trigger that keeps `location_point` in sync with existing `latitude`/`longitude` columns. This enables `ST_DWithin` spatial index queries without changing the existing interface. A separate `trainer_locations` table handles trainers with multiple workout locations (gym + park, etc.), with each location producing its own map pin.

**Major components:**
1. `MapView` page + `useTrainersMap` hook — renders clustered pins for available trainers, subscribes to single `trainer-availability` Realtime channel for live pin updates
2. `AvailabilityToggle` component + `useAvailabilityToggle` hook — Uber-style switch with timer picker; updates `trainer_profiles.is_available` + `available_until`; pg_cron job expires stale sessions every 5 minutes
3. `location-notify` Edge Function — triggered via DB trigger on `is_available` flip; `ST_DWithin` proximity check against `client_profiles.notify_area_point`; rate-limited to 1 alert per trainer per 4-hour window per client
4. `ai-match` Edge Function or deterministic `get_trainer_recommendations` RPC — Fitness Passport fields scored against trainer specialties (100-point deterministic scale); 24-hour result cache in `client_profiles.ai_match_cache` JSONB
5. `google-calendar-webhook` + `google-calendar-sync` Edge Functions — OAuth callback, token refresh, event writes/deletes, watch channel registration and pg_cron renewal; tokens stored in Supabase Vault in a separate `trainer_gcal_tokens` table
6. `session_notes` + `workout_logs` tables — trainer writes post-session notes; client reads via RLS; `workout_log JSONB` for structured fields; Recharts visualizes progress over time
7. `email_subscribers` table + `capture-email` Edge Function — public insert RLS, Resend welcome email, position-in-line from row number

**New pg_cron jobs:** availability sleep timer expiry (every 5 min), GCal watch channel renewal (weekly), weekly analytics batch.

### Critical Pitfalls

1. **Google Maps API multi-SKU billing explosion** — A single map page load can trigger Maps JS API + Places API + Geocoding API simultaneously, each billed separately. Since March 2025, the $200/month credit was replaced by per-SKU free caps. Set a hard GCP billing quota cap at $10/month and restrict API key to HTTP referrers before writing any map code. Never re-geocode stored addresses; compute distances client-side from stored lat/lng; avoid Distance Matrix API entirely.

2. **Google Calendar OAuth verification takes 4–8 weeks** — `calendar.events` is a sensitive scope requiring Google's verification process (demo video, privacy policy, domain verification, scope justification). Building the full sync feature before submitting means it cannot reach production users for 4–8 weeks after development completes. Start verification before writing sync code; keep iCal export as the fallback during the verification window.

3. **Race condition on availability toggle + concurrent booking creation** — The new live map view significantly increases concurrent booking attempts for popular trainers. The existing check-then-act booking flow (read slot, check availability, create booking) is vulnerable to double-booking when two clients hit the same slot simultaneously. Move check + create into a single PostgreSQL RPC using `SERIALIZABLE` isolation. Must be addressed in the availability toggle phase before the map view ships.

4. **Notification spam causes permission revocation** — Firing one alert per trainer-goes-online event creates 5–15 notifications per day for clients in dense urban areas. Implement frequency caps (max 1 alert per trainer per 4-hour window, max 3 location alerts per day per client) and a notification preferences UI before the location alert feature goes live. iOS users who revoke notification permissions cannot be re-prompted without a re-install.

5. **iOS GPS battery drain and App Store rejection** — Continuous `watchPosition()` polling on iOS drains battery in 2–4 hours. Apple rejects apps with vague location usage descriptions. Use one-time `getCurrentPosition()` snapshot on toggle-on only; never continuous polling. Write a specific Info.plist description: "Your location is shared only when you activate availability to help clients find you nearby."

## Implications for Roadmap

Based on the feature dependency graph and pitfall severity, the recommended phase structure is 8 phases:

### Phase 1: Email Capture and Billing Controls
**Rationale:** Zero dependencies on any other v4.0 feature. Delivers immediate business value (email list growth) in 1–2 days of work. Critically, this is the correct time to set up Google Maps API keys with billing caps and domain restrictions — before any map code exists. Also the moment to submit the Google OAuth app verification to start the 4–8 week clock.
**Delivers:** Landing page waitlist form, `email_subscribers` table, Resend welcome email, position-in-line display, GCP billing budget alert at $10/month, API key with HTTP referrer restriction, Google OAuth consent screen submitted for verification.
**Addresses:** Feature 8 (Email Capture) fully.
**Avoids:** Pitfall 1 (Maps billing) by establishing controls before the Maps phase; Pitfall 3 (OAuth verification blockade) by starting verification immediately.

### Phase 2: Availability Toggle Foundation
**Rationale:** Feature 2 is the architectural keystone of v4.0 — map pins, location notifications, and AI discount analytics all depend on `is_available` being live. The race condition fix must ship here because the live map view is coming next and will increase concurrent booking attempts.
**Delivers:** `trainer_profiles.is_available` + `available_until` columns, pg_cron sleep timer expiry, `AvailabilityToggle` component with timer picker, atomic booking RPC using `SERIALIZABLE` transaction.
**Addresses:** Feature 2 (Availability Toggle) fully; atomic booking RPC prevents Pitfall 4.
**Avoids:** Pitfall 4 (race condition), Pitfall 2 (iOS GPS — one-time snapshot only, no continuous polling).

### Phase 3: Map View with Live Trainer Pins
**Rationale:** Requires Phase 2 (toggle live). The visual payoff of the entire v4.0 milestone. PostGIS migration and `trainer_locations` table can be designed knowing the toggle data model is final.
**Delivers:** MapView page, clustered trainer pins, InfoWindow popups, map/list toggle, Places Autocomplete for trainer address entry, single Realtime broadcast channel for live pin updates, PostGIS `geography(POINT)` migration with sync trigger.
**Uses:** `@vis.gl/react-google-maps`, `@googlemaps/markerclusterer`, PostGIS `ST_DWithin`, `search_trainers_geo` RPC.
**Avoids:** Pitfall 1 (billing caps already set in Phase 1), Pitfall 10 (single broadcast channel, not per-trainer channels), Pitfall 12 (API key restricted to HTTP referrer).

### Phase 4: Session Logging and Workout History
**Rationale:** Highest value-to-complexity ratio of any remaining feature. No external services, no new npm packages, builds entirely on existing bookings and Recharts infrastructure. Ships independently of maps and notifications.
**Delivers:** `session_notes` + `workout_logs` tables, `SessionNoteForm` component, "My Progress" client tab, session count/streak metrics, optional "Send Summary" email via existing Resend integration.
**Addresses:** Feature 7 (Session Logging) fully.
**Avoids:** Pitfall 13 (PHI risk — scope notes to workout data, add UI guidance against medical observations).

### Phase 5: AI Trainer-Client Matching
**Rationale:** Deterministic scoring RPC approach (no ML, no external API) delivers high value from existing Fitness Passport data. Cold start handling must be designed in from the start — gate score display behind completeness threshold.
**Delivers:** `get_trainer_recommendations(client_id)` RPC with 100-point scoring function, "Recommended for You" section on search page, match score chip with 2–3 attribute explanation, Fitness Passport completeness prompt in booking wizard.
**Addresses:** Feature 4 (AI Matching) fully for MVP. pgvector/embedding path deferred to v4.1.
**Avoids:** Pitfall 7 (cold start — hide score when Fitness Passport below completeness threshold).

### Phase 6: AI Discount Analytics
**Rationale:** Requires 4+ weeks of `availability_slots` data to produce meaningful recommendations — shipping the UI early starts the data accumulation clock. Rule-based pattern detection using existing slot classification, no new external services.
**Delivers:** New "Optimization" tab in trainer analytics dashboard, slot utilization heat-map (day/hour grid, Recharts), recommendation cards ("5 idle Tuesday slots — try 20–30% off"), `get_trainer_idle_analysis` and `get_trainer_optimization_score` RPCs.
**Addresses:** Feature 5 (AI Discount Analytics) fully.
**Uses:** Existing `availability_slots.slot_type` enum, existing Recharts, existing discount slider.

### Phase 7: Location-Based Notifications
**Rationale:** Depends on Phase 2 (toggle) being live with real usage data, and requires notification frequency caps + preferences UI before the feature goes live. PostGIS infrastructure from Phase 3 is already in place for the proximity queries.
**Delivers:** `notify_on_available`, `notify_radius_km`, `notify_area_point` columns on `client_profiles`, notification preferences UI, `location-notify` Edge Function with `ST_DWithin` proximity check and 4-hour rate limiting, DB trigger on `is_available` flip (or pg_cron fallback on free tier).
**Addresses:** Feature 3 (Location Notifications) fully.
**Avoids:** Pitfall 5 (notification spam — frequency caps and preferences UI ship before alerts go live), Pitfall 9 (server-side proximity query, not OS geofencing), Pitfall 11 (GDPR location consent checkbox before any location data collected).

### Phase 8: Google Calendar Bidirectional Sync
**Rationale:** Highest complexity, most external dependencies. Google OAuth verification started in Phase 1 should be approved by the time development reaches this phase. Building sync logic in parallel with verification avoids a post-code dead zone.
**Delivers:** `google-calendar-webhook` and `google-calendar-sync` Edge Functions, OAuth consent flow in TrainerSettings, GCal event creation on booking confirmation, GCal event deletion on cancellation, watch channel registration and pg_cron renewal, sync loop prevention via `extendedProperties` tagging.
**Addresses:** Feature 6 (Google Calendar Sync) fully.
**Avoids:** Pitfall 3 (verification started in Phase 1), Pitfall 8 (product rules documented before sync code: FitRush authoritative for booking existence, GCal authoritative for blocked time), Pitfall 14 (OAuth tokens in separate `trainer_gcal_tokens` table, not on `trainer_profiles`).

### Phase Ordering Rationale

- Phase 1 before Phase 3: billing controls must exist before Maps API key touches production; OAuth verification must start before sync code is written.
- Phase 2 before Phases 3 and 7: the toggle is the data source for both map pin visibility and notification triggers; the atomic booking RPC must precede the concurrent traffic increase from the map view.
- Phase 3 before Phase 7: PostGIS migration established once, reused for notification proximity queries.
- Phase 4 can ship after Phase 2 independently — no dependency on maps or notifications.
- Phase 5 before Phase 6: client-facing AI (matching) has higher retention impact than trainer-facing AI (analytics); both are similar complexity.
- Phase 8 last: hard external constraint (verification timeline) that no engineering effort can accelerate.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Maps):** PostGIS vs `earth_distance` conflict between ARCHITECTURE.md (recommends PostGIS) and PITFALLS.md (recommends `earth_distance` to avoid TypeScript type breakage) — resolve with a spike before the migration. Also verify Supabase Realtime `REPLICA IDENTITY FULL` performance impact.
- **Phase 7 (Notifications):** Confirm `pg_net` extension availability on the current Supabase plan before designing the DB trigger pattern; if on free tier, must fall back to pg_cron polling instead.
- **Phase 8 (Calendar Sync):** Confirm Supabase Edge Runtime is on Deno 2.2+ (required for `googleapis` gcp-metadata fix). Write conflict resolution product rules before implementation planning.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Email Capture):** Standard Supabase + Resend pattern, fully documented.
- **Phase 2 (Availability Toggle):** Standard pg_cron pattern, mirrors existing `weekly-payouts` job.
- **Phase 4 (Session Logging):** Pure Supabase table + Zod + Recharts — extends existing infrastructure.
- **Phase 5 (AI Matching):** Deterministic SQL scoring function — no ML, well-understood pattern from Fitness Passport data.
- **Phase 6 (AI Analytics):** Aggregate SQL + Recharts — extends existing analytics dashboard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library recommendations sourced from official Google/Supabase/Capacitor docs. Only MEDIUM uncertainty: Gemini vs OpenAI vs deterministic RPC for AI matching — deterministic RPC resolves this for MVP without external dependency. |
| Features | HIGH | 8 features fully specified with table stakes, differentiators, user flows, and anti-features. MVP priority order cross-validated by dependency graph in FEATURES.md. |
| Architecture | HIGH | Based on direct codebase inspection and official docs. PostGIS migration SQL, Realtime channel pattern, Edge Function code patterns all provided in ARCHITECTURE.md. |
| Pitfalls | HIGH (critical) / MEDIUM (moderate) | Critical pitfalls sourced from official Google docs and Supabase discussions. Moderate pitfalls from multiple community sources agreeing on patterns. |

**Overall confidence:** HIGH

### Gaps to Address

- **PostGIS vs earth_distance:** ARCHITECTURE.md recommends PostGIS; PITFALLS.md recommends `earth_distance` to avoid TypeScript type complexity. Resolve before Phase 3 migration. Recommended resolution: use PostGIS with explicit TypeScript type overrides for geography columns — better long-term for a live platform with growing spatial query needs.
- **AI matching model:** Research identifies three valid options (deterministic RPC, Gemini Edge Function, pgvector embeddings). Start with deterministic RPC in Phase 5; add Gemini explanation text as Phase 5 enhancement; defer pgvector to v4.1. Document this decision in Phase 5 plan.
- **Supabase plan level:** `pg_net` extension (DB trigger to Edge Function) requires Pro plan. Confirm before Phase 7 design — if free tier, the notification trigger must use pg_cron polling with 5-minute delay instead of real-time trigger.
- **Google OAuth verification outcome:** 4–8 week external dependency. If verification is delayed beyond Phase 8, GCal sync ships in Testing mode (100 users max). Prepare a communication plan for this scenario.
- **Notification rate limits:** The 4-hour window and 3/day cap are editorial estimates from research. Validate against early opt-in data and adjust before broad rollout.

## Sources

### Primary (HIGH confidence)
- [@vis.gl/react-google-maps official docs](https://visgl.github.io/react-google-maps/) — Maps library selection and component patterns
- [Google Maps Platform pricing (March 2025 model)](https://developers.google.com/maps/billing-and-pricing/pricing) — Billing SKU structure and free tier caps
- [Google Maps Platform Manage Costs](https://developers.google.com/maps/billing-and-pricing/manage-costs) — Billing quota controls
- [Google Sensitive Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) — Calendar OAuth verification timeline
- [Google Calendar API push notifications](https://developers.google.com/workspace/calendar/api/guides/push) — Watch channel behavior and expiry
- [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector) — Vector embedding pattern
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) — Channel count and connection constraints
- [Supabase AI embeddings guide](https://supabase.com/docs/guides/ai) — pgvector + OpenAI integration
- [Capacitor Geolocation plugin docs](https://capacitorjs.com/docs/apis/geolocation) — iOS GPS pattern and permissions
- [OpenAI text-embedding-3-small pricing](https://openai.com/api/pricing/) — Embedding cost baseline

### Secondary (MEDIUM confidence)
- [Bidirectional Calendar Sync Implementation Guide 2025](https://calendhub.com/blog/implement-bidirectional-calendar-sync-2025/) — Conflict resolution patterns
- [googleapis + Supabase Edge Function gcp-metadata fix](https://github.com/orgs/supabase/discussions/33244) — Deno 2.2 compatibility confirmation
- [Supabase Race Conditions SERIALIZABLE Isolation](https://github.com/orgs/supabase/discussions/30334) — Atomic booking RPC pattern
- [Alert Fatigue Push Notifications 2025](https://onesignal.com/blog/how-mobile-push-expectations-have-changed/) — Notification frequency cap guidance
- [Geofencing Accuracy Real-World](https://radar.com/blog/how-accurate-is-geofencing) — Urban GPS drift data (100–200m)
- [Supabase Distance-Based Filtering](https://blog.mansueli.com/leveraging-supabase-and-postgresql-for-distance-based-filtering-and-location-data-retrieval) — PostGIS RPC implementation pattern
- [AI in Personalized Fitness Apps 2025](https://www.kitlabs.us/ai-personalized-fitness-apps/) — Matching algorithm patterns

### Tertiary (LOW confidence)
- [Cold Start Problem Recommender Systems 2025](https://www.shaped.ai/blog/glossary-cold-start-problem) — Cold start content-based fallback pattern (multiple sources agree on this approach)
- [Google OAuth Verification: Costs, Timelines, Process](https://www.nylas.com/blog/google-oauth-app-verification/) — 4–8 week timeline estimate

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
