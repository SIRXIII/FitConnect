# Feature Landscape

**Domain:** Live fitness marketplace — Uber-style availability, maps, AI matching, calendar sync, session tracking
**Researched:** 2026-03-18
**Milestone:** v4.0 — The Live Platform
**Confidence:** HIGH (Google APIs, official docs) / MEDIUM (pattern research, competitive analysis) / LOW (AI matching specifics)

---

## Scope

This file covers only the **new** v4.0 features. All v1.0–v3.0 table stakes (auth, booking, payments, availability slots, referrals, subscriptions, Fitness Passport) are already shipped and excluded.

Existing features this milestone depends on:
- Availability slot system (create/delete, soft-delete pattern) — base for toggle visibility
- Fitness Passport (client goals, workout types, fitness level, limitations) — feeds AI matching
- AI scheduling MVP (slot classification: booked/blocked/buffer/idle) — feeds discount analytics
- Trainer discount slider (0–80%) — target of AI discount recommendations
- iCal export with calendar_export_token — existing one-way sync to replace/augment with bidirectional
- Notifications system (Supabase Realtime + email) — foundation for location-based notifications
- Subscription tiers (Free/Pro/Elite) — gates for some v4.0 features

---

## Feature 1: Google Maps — Map View with Trainer Pins

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Map view with trainer location pins | Users expect map-based discovery once locations are shown — it's industry standard for local services | MEDIUM | @vis.gl/react-google-maps v1.7.1 (Google-endorsed, actively maintained) |
| Trainer address entry on profile | Trainers must declare where they work (gym, park, client home area) before pins can display | LOW | Address field + optional lat/lng geocoding on save |
| Marker clustering at zoom-out | Without clustering, 50+ pins on one city block renders unreadable | MEDIUM | @googlemaps/markerclusterer (official Google library) |
| InfoWindow on pin click | Users expect to tap a pin and see trainer name, rate, specialty before navigating away | LOW | Built into @vis.gl/react-google-maps |
| Map/list toggle | Users switch between map discovery and list browsing based on preference | LOW | State toggle; no architectural change — same data source |
| Mobile-responsive map | Map must work on mobile; fixed-height containers with touch handling | LOW | Maps JS API handles touch natively |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real-time pin visibility tied to availability toggle | Only online trainers show as pins — reinforces "available now" urgency (Uber model) | MEDIUM | Supabase Realtime subscription on trainer availability status; pin add/remove on state change |
| Location type icons (gym vs park vs in-home) | Visual differentiation on map speeds discovery for clients with location preferences | LOW | Custom AdvancedMarker icons; 3 SVG variants |
| Trainer tier badge on pin | Gold star or badge for Elite trainers on the map pin; visible premium signal | LOW | CSS overlay on AdvancedMarker |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Live GPS tracking of trainer movement | Creepy for trainers; Uber-style live tracking only makes sense for in-transit service, not fitness booking | Show static workout location address; live tracking only for "currently available" toggle state |
| Street View integration | Scope creep; adds API cost and build complexity for minimal fitness value | Static map pin + address text is sufficient |
| Route/directions from map | Fitness sessions are planned in advance; turn-by-turn is unnecessary | Link to Google Maps deep link for directions when confirmed booking |

### User Flow

1. Client opens "Find a Trainer" — sees list view by default (preserves existing UX).
2. Client taps "Map" toggle — map renders with clustered pins for available trainers.
3. Client zooms into neighborhood — clusters expand to individual pins.
4. Client taps a pin — InfoWindow shows trainer name, specialty, rate, "Book" button.
5. "Book" navigates to existing trainer detail page and booking wizard.

### Dependencies on Existing Features

- Trainer profiles (location field added) — needs DB migration for `workout_location_address`, `workout_location_lat`, `workout_location_lng`, `workout_location_type`
- Availability toggle (Feature 2) — determines which pins are visible
- Existing trainer search RPC — add location coords to response

### Complexity Notes

Google Maps JavaScript API billing: Static Maps = $2/1000 loads; Dynamic Maps = $7/1000 loads. At <10K MAU, Maps costs are negligible (<$70/month). Require Maps API key with domain restriction. MEDIUM overall due to Supabase Realtime integration for pin visibility, not due to mapping library itself.

---

## Feature 2: Uber-Style Availability Toggle with Sleep Timer

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Online/offline toggle on trainer dashboard | Core mechanic of the Uber model — trainers must control when they appear as available | LOW | Boolean column `is_live` on `trainer_profiles`; toggle updates via PATCH |
| Toggle persists across sessions | Trainers should not need to re-enable every time they open the app | LOW | DB-persisted state, not session storage |
| Offline = hidden from map and "available now" list | The toggle must have visible consequence — being offline means clients cannot see or book you | MEDIUM | RLS + query filter on trainer search; Realtime broadcast on change |
| Clear visual state indicator | Prominent online (green) / offline (gray) status visible at all times on trainer dashboard | LOW | Header badge or persistent status bar |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sleep timer auto-off (1hr, 2hr, 4hr, end of day) | Trainers forget to go offline; auto-off prevents false availability signals and protects trainer privacy | MEDIUM | `is_live_until` timestamp column; server-side pg_cron or Edge Function checks expiry; client polls or Realtime listens |
| "Active window" scheduling (auto-on at set time) | Power users want to set "go live at 7am" rather than manually toggling each morning | HIGH | Cron-per-trainer complexity; defer to v4.1 unless trivial |
| Last seen timestamp | Clients see "Online 2 hrs ago" — adds credibility and urgency | LOW | `last_seen_at` timestamp updated on toggle-on |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-off triggered by inactivity/no bookings | Too aggressive; trainers go online to signal availability, not to guarantee bookings | Use sleep timer with explicit duration only — trainer chooses when to go offline |
| Mandatory reason for going offline | Adds friction with no client-facing value | Silent toggle — no reason required |
| "Busy" intermediate state | Unnecessary complexity for MVP; booking conflicts handled by slot availability | Binary online/offline is sufficient |

### User Flow

**Going Online:**
1. Trainer opens dashboard — sees "Go Live" button (gray/offline state).
2. Trainer taps "Go Live" — modal offers: "Stay online until: [1hr] [2hr] [4hr] [End of Day] [Manually turn off]".
3. Trainer selects duration — status flips to green "Live", timer countdown shown in header.
4. Trainer pin appears on map; clients in saved area get push notification (Feature 3).
5. Timer reaches zero — status auto-flips to offline; trainer pin removed from map.

**Going Offline:**
1. Trainer taps green "Live" badge — one-tap confirmation toggles offline immediately.
2. Pin removed from map in real time via Supabase Realtime broadcast.

### Implementation Notes

- `trainer_profiles` columns: `is_live BOOLEAN DEFAULT false`, `is_live_until TIMESTAMPTZ NULL`
- pg_cron job every 5 minutes: `UPDATE trainer_profiles SET is_live = false WHERE is_live_until < NOW() AND is_live = true`
- Supabase Realtime broadcast on `is_live` change — clients subscribed to map view receive delta updates
- Sleep timer options drive `is_live_until` calculation on client; server only needs to honor the timestamp

### Dependencies

- Maps Feature 1 — toggle controls pin visibility
- Notifications Feature 3 — toggle-on triggers location-based push
- pg_cron already in use for weekly-payouts — same pattern applies here

---

## Feature 3: Location-Based Notifications for Clients

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "Trainer nearby is now available" in-app notification | Clients who opt in to an area expect to be alerted when a trainer goes live — this is the core value of the real-time model | MEDIUM | Edge Function triggered on `is_live` change; query clients with matching saved area |
| Saved location area preference | Clients need to specify their geographic interest area before notifications can be targeted | LOW | `client_profiles` column: `notification_area_geom` (PostGIS geometry) or city/zip preference |
| Notification opt-in/opt-out controls | Users must be able to control which notifications they receive | LOW | Existing notifications preferences; add location notification type |
| Notification badge count and read state | Standard mobile notification UX — unread badge drives re-engagement | LOW | Already exists in FitRush notification system — extend with new type |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Live GPS opt-in for "trainers near me right now" | Highest-intent notification — client shares current location, gets alerted when trainer within X miles goes live | HIGH | Browser Geolocation API + PostGIS `ST_DWithin` query; requires HTTPS; user permission required each session |
| "Your saved trainer just went online" priority alert | Clients who have previously booked or favorited a trainer get a priority notification over generic area alerts | MEDIUM | `saved_trainers` junction table needed; priority queue logic in Edge Function |
| Discount-specific notifications ("Trainer offering 30% off in your area") | Combines availability toggle + discount slider to surface deals — reinforces FitRush's value prop | MEDIUM | Include discount_pct in notification payload; filter for clients who have opted into deal alerts |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| SMS notifications | Costs money per message; adds TCPA compliance complexity | In-app + email via existing Resend integration is sufficient for MVP |
| Browser push notifications (Web Push API) | Requires service worker, VAPID keys, complex permission UX — PWA scope; iOS support was broken until recently | Start with in-app + email; add Web Push in v5.0 with PWA/Capacitor |
| Real-time location tracking of client | Privacy concern; clients share location only momentarily for match, not continuously | Point-in-time geolocation check only; don't store client GPS coordinates persistently |

### User Flow

**Saved Area Setup (client):**
1. Client opens notification settings — sees "Location Alerts" section.
2. Client types city/neighborhood or taps "Use my location" — area saved as preference.
3. Client toggles "Alert me when trainers go live nearby".

**Notification Trigger (server):**
1. Trainer toggles `is_live = true` — Supabase database webhook or Realtime triggers Edge Function.
2. Edge Function queries: clients with `notification_area` overlapping trainer's `workout_location`, who have opted in, who haven't been notified in last 30 minutes (rate limit).
3. For each matching client: create `notifications` row (existing table) + send email via Resend if email alerts enabled.
4. Client sees in-app notification bell badge + toast.

### Implementation Notes

- Simplest viable version: store city/zip on client profile, match by trainer city/zip (no PostGIS required for MVP).
- Upgraded version: PostGIS `ST_DWithin` for radius-based matching (requires enabling PostGIS extension in Supabase — it's available but needs enabling).
- Rate limit notifications per client per trainer: 1 per 30-minute window to avoid spam.
- Edge Function reuse: extend `send-notification-email` with location alert type.

### Dependencies

- Availability Toggle (Feature 2) — notification trigger source
- Existing notifications table + in-app notification system
- Existing `send-notification-email` Edge Function

---

## Feature 4: AI Trainer-Client Matching

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "Recommended for you" trainer section on search page | Clients with completed Fitness Passports expect the platform to use that data | MEDIUM | Rule-based matching using Fitness Passport fields against trainer specialties |
| Match score display | Clients need to understand WHY a trainer is recommended — score or explanation increases trust | LOW | "95% match" label or 2-3 matched attributes ("Specializes in weight loss, flexible schedule") |
| Fallback to popularity when no passport | New clients without Fitness Passport should not see empty state | LOW | Fallback to existing tier-ranked search when match data unavailable |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-factor compatibility scoring | Score based on: specialty vs. client goals (primary), fitness level fit, location proximity, availability overlap, price range preference, past booking history | MEDIUM | Deterministic scoring function in Postgres RPC — no ML required, uses existing data |
| Fitness Passport → specialty matching | "Client wants weight loss + HIIT → surface trainers with those specialties at top" — obvious but must be explicit | LOW | JSON overlap query between `client_profiles.fitness_goals` and `trainer_profiles.specialties` |
| "Clients like you also trained with" | Social proof + collaborative signal without ML: find trainers frequently booked by clients with similar Fitness Passport profiles | HIGH | Requires booking volume data to be meaningful; defer until 6+ months of data |
| AI-generated match explanation | LLM generates a 1-sentence explanation: "Matches your strength training goals and works near Downtown" — increases perceived intelligence | MEDIUM | Simple prompt + Supabase Edge Function calling OpenAI or Claude API; deterministic data fed as context |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| ML model trained on FitRush data | Platform has insufficient booking history for meaningful model training (per PROJECT.md: Predictive AI/ML out of scope) | Rule-based scoring using Fitness Passport fields; revisit in v6.0 |
| Real-time ranking recalculation on every search | Expensive; over-engineering for MVP matching | Pre-compute match scores daily via pg_cron; re-run on Fitness Passport update |
| "Magic AI" black box with no explanation | Users distrust unexplained recommendations | Always show 2-3 specific matched attributes as the reason |

### User Flow

1. Client opens trainer search — "Recommended for You" section appears above regular search results (only if Fitness Passport is complete, >50% filled).
2. Trainer cards show a "95% match" chip with tooltip: "Matches your goal: weight loss, specialty: HIIT, near your area".
3. Client who has not filled Fitness Passport sees CTA: "Complete your Fitness Passport to get personalized recommendations".
4. Client books a recommended trainer — booking experience unchanged.

### Implementation Notes

**Scoring function (deterministic, no ML):**
- Goal match: +30 points if trainer specialty overlaps client fitness goals
- Workout type match: +20 points if trainer specialties include client preferred workout types
- Fitness level appropriateness: +15 points if trainer bio/tags indicate experience with client's fitness level
- Location proximity: +20 points if trainer workout_location within client's preferred area
- Availability overlap: +10 points if trainer has available slots in client's preferred time windows
- Price fit: +5 points if trainer rate within client's budget range (if budget field added later)

Total score 0–100, threshold 60+ for "Recommended" section.

**Infrastructure:** Postgres RPC function `get_trainer_recommendations(client_id)` — computable at query time, no pre-computation needed for small trainer catalogs (<500 trainers).

### Dependencies

- Fitness Passport (v3.0) — primary data source for matching
- Trainer specialty/location data on `trainer_profiles`
- Availability slots system — optional overlap scoring

---

## Feature 5: AI Trainer Analytics — Discount Recommendations

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "When to offer discounts" insights in trainer dashboard | Trainers already have the discount slider; they need guidance on when and how much to discount idle slots | MEDIUM | Pattern analysis on existing `availability_slots` classification data (idle/buffer/booked) |
| Slot utilization rate over time | Trainers need a baseline metric before discount recommendations make sense | LOW | Aggregate query: booked slots / total slots per week, visualized in existing analytics dashboard |
| Actionable recommendation card (not just data) | "You have 5 idle slots on Tuesday afternoons — try offering 20% off" is more valuable than raw charts | MEDIUM | Rule-based recommendation engine using slot history + time-of-week patterns |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Day-of-week idle pattern detection | Identify which days/hours consistently go unbooked and surface discount recommendation specifically for those windows | MEDIUM | GROUP BY day_of_week, hour aggregation on slot history; compare idle_count to total_count |
| Discount effectiveness tracking | Show trainer: "Last month you offered 25% off Tuesdays — bookings on Tuesdays increased 40%" | HIGH | Requires storing discount_pct on bookings at time of booking, not just current trainer slider; needs schema change |
| Optimal discount suggestion | Suggest specific discount percentage based on comparable trainers' booking rates (if trainer consent) | HIGH | Requires cross-trainer aggregate data; privacy sensitive; defer unless trainer opt-in |
| "Seasonal demand" alerts | Alert trainers when platform-wide booking demand spikes (e.g., "January resolution season — lower your discount, demand is high") | LOW | Admin-triggered broadcast; simple notification type |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Fully automated dynamic pricing | Removes trainer agency; violates the luxury brand positioning where trainers control rates | Recommendations only, never automatic; trainer must apply discount manually |
| Predictive ML model | Insufficient data; per PROJECT.md this is explicitly out of scope | Rule-based pattern recognition using existing slot classification data |
| Per-slot granular discount pricing | Complex UX and Stripe integration; individual slot prices require new payment flow | Keep single discount slider; recommendations indicate WHEN to apply the trainer's chosen discount |

### User Flow

1. Trainer opens earnings analytics dashboard — new "Optimization" tab added.
2. Tab shows: slot utilization rate (this week / last 4 weeks / all time).
3. Pattern section: heat-map-style day/hour grid showing idle vs. booked history.
4. Recommendation cards: "Idle pattern detected: Tuesday 2–5 PM has 0% booking rate over 4 weeks. Consider offering 20–30% discount for this window."
5. Trainer taps "Apply 25% to Tuesday slots" — navigates to availability management (discount slider is trainer-level, not slot-level; recommendation is informational for now).

### Implementation Notes

- Data source: existing `availability_slots` table with `slot_type` enum (booked/blocked/buffer/idle)
- New Postgres RPC: `get_trainer_slot_patterns(trainer_id, weeks_back)` — GROUP BY day_of_week, EXTRACT(hour FROM slot_start)
- Recommendation threshold: flag day+hour combinations with idle_rate > 70% over last 4 weeks
- Existing analytics dashboard already has Recharts — add new tab, no new chart library needed
- Confidence: MEDIUM — rule-based, deterministic, requires adequate slot history (trainers need 4+ weeks of data)

### Dependencies

- Existing AI scheduling slot classification system (v3.0)
- Existing discount slider (trainer profile)
- Existing earnings analytics dashboard with Recharts

---

## Feature 6: Google Calendar Bidirectional OAuth Sync

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| OAuth 2.0 "Connect Google Calendar" flow | Industry standard for calendar sync; users expect OAuth not password | MEDIUM | Google OAuth scopes: `https://www.googleapis.com/auth/calendar.events`; store `access_token` + `refresh_token` in `trainer_profiles` |
| Push confirmed bookings to Google Calendar | Trainers want bookings to appear in their Google Calendar automatically | MEDIUM | Create GCal event on booking confirmation; store `google_event_id` on booking row for later sync |
| Delete/update GCal event on booking cancellation | Bidirectional: when booking cancelled in FitRush, remove from Google Calendar | MEDIUM | Cancel webhook triggers GCal event deletion using stored `google_event_id` |
| Block FitRush slots when GCal event exists | When trainer has external meeting in Google Calendar, FitRush should mark that slot as blocked | HIGH | Google Calendar push notifications (watch channel) → webhook → slot blocking logic |
| Disconnect / revoke integration | Users must be able to unlink Google Calendar without losing their FitRush data | LOW | Revoke OAuth token, clear stored tokens, remove GCal event IDs |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Conflicts blocked automatically" | Trainer's personal appointments in Google Calendar automatically block corresponding FitRush slots — eliminates double-booking | HIGH | Requires watch channel (push notifications from Google) + webhook endpoint; watch channels expire every 7 days and must be renewed |
| Event description includes client Fitness Passport summary | Calendar event includes client name, goals, limitations — trainer has session context without opening FitRush | LOW | Populate GCal event description field on booking write |
| Availability slots auto-created from GCal "Free" time | Parse trainer's free windows from GCal and suggest as FitRush availability | HIGH | Complex; misinterprets trainer intent; defer |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| iCal replacement | The existing iCal feed already serves clients who sync one-way; don't remove it | Keep iCal export as-is; GCal OAuth is an additive trainer-facing feature |
| Bidirectional sync for clients | Client calendars are lower-priority; iCal already covers client one-way export | Trainer-side bidirectional only for v4.0; client sync via iCal feed |
| Recurring event sync from GCal to FitRush slots | Complex deduplication; recurrence IDs create sync loop risks | Block individual event occurrences only; recurring handling deferred |

### User Flow

1. Trainer opens profile settings — sees "Calendar Integrations" section.
2. Trainer clicks "Connect Google Calendar" — OAuth consent flow (standard Google sign-in consent screen).
3. FitRush stores `access_token`, `refresh_token`, `token_expiry` on `trainer_profiles`.
4. FitRush creates a GCal watch channel for trainer's primary calendar — webhook URL points to new Edge Function `google-calendar-webhook`.
5. Confirmed bookings: `create-payment-intent` success → also calls GCal Events.insert → stores `google_event_id` on booking.
6. External event added in GCal → Google pings webhook → Edge Function checks for FitRush slot overlap → marks slot as blocked.
7. Booking cancelled in FitRush → `cancel-booking` Edge Function also calls GCal Events.delete.

### Implementation Notes

- **New Edge Function needed:** `google-calendar-webhook` (receives watch channel pings, fetches changed events, maps to FitRush slots)
- **New Edge Function needed:** `google-calendar-sync` (handles OAuth token exchange + initial setup)
- **Token refresh:** GCal `access_token` expires in 1 hour; refresh logic must run before every API call
- **Watch channel renewal:** expire in 7 days max; pg_cron job renews before expiry
- **Scope:** `calendar.events` (read/write specific events) — do NOT request `calendar` (full calendar management) — users are more willing to grant narrower scopes
- **Conflict detection:** `calendar_sync_mappings` table: `booking_id`, `google_event_id`, `external_event_id`, `sync_version`, `synced_at`
- **Loop prevention:** Track event origin; do not re-sync changes that originated from FitRush itself
- **OAuth app verification:** Google requires domain verification + privacy policy URL; app may show "unverified" warning to users until submitted for review

### Dependencies

- Existing iCal export system (calendar_export_token pattern — keep as-is)
- `cancel-booking` Edge Function (extend to include GCal delete)
- pg_cron (already used for weekly-payouts — reuse for watch channel renewal)

---

## Feature 7: Session History and Workout Logging

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Post-session notes by trainer | Trainers need to record what was done in a session for continuity | LOW | `session_notes` table: `booking_id`, `trainer_id`, `notes TEXT`, `created_at`; accessible from completed booking detail |
| Post-session notes visible to client | Client should be able to read their session notes — builds value and retention | LOW | RLS: clients read own session notes; trainers read/write for their bookings |
| Session history list (client-facing) | Clients expect a "My workout history" view — list of completed sessions with notes | LOW | Query completed bookings + JOIN session_notes; new page `/sessions` or extend existing booking history |
| Session count and streak metrics | Simple engagement metrics: "12 sessions completed", "3-session streak" | LOW | Aggregate query over completed bookings; displayed on client profile/dashboard |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Structured workout log template | Post-session form with structured fields: exercises performed, sets/reps, perceived effort (RPE), focus area — not just a freeform note | MEDIUM | JSONB column `workout_log JSONB` on session_notes; structured UI with optional fields |
| Progress charts over time | "Average session intensity over 12 weeks", RPE trend — motivates continued training | MEDIUM | Recharts already in use; aggregate JSONB workout_log fields over time |
| Trainer session prep notes (pre-session) | Trainers review client Fitness Passport + prior session notes before the appointment — adds professionalism | LOW | Link to Fitness Passport + prior notes from trainer's upcoming booking detail view |
| Client-written post-session reflection | Client can also add their own note: how they felt, what they want to work on next — creates dialogue | LOW | Second `client_notes TEXT` column on session_notes; or separate `client_session_reflections` table |
| "Send session summary" email to client | Trainer taps "Send summary" — Resend email with session notes delivered to client | MEDIUM | Extend `send-notification-email` Edge Function with session_summary type |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| In-app exercise database with search | Full exercise library is a dedicated product (Hevy, Strong); out of scope for a booking marketplace | Free-text exercise names in workout log; no search, no taxonomy |
| Photo/video upload per session | Expensive storage, content moderation risk, scope creep | Text-only session notes for v4.0 |
| Wearable integration (Apple Health, Fitbit) | Significant complexity; different platform; different value prop | FitRush is a booking marketplace, not a fitness tracker; mention it as future vision only |
| Mandatory session logging | Forcing trainers to log before booking closes creates friction and churn risk | Optional; prompt with reminder notification if no note added 24hrs after session |

### User Flow

**Trainer flow:**
1. Completed session appears in trainer dashboard "Recent Sessions" list (existing).
2. New "Add Session Notes" button on completed booking detail.
3. Trainer opens form: freeform notes + optional structured fields (exercises, focus area).
4. Trainer saves — client sees notes in their session history.
5. Optional: Trainer taps "Send Summary to Client" — email sent.

**Client flow:**
1. Client opens new "My Progress" tab on dashboard.
2. Sees list of completed sessions with trainer name, date, session notes.
3. Progress metrics at top: total sessions, sessions this month, current streak.
4. Client can add their own reflection to any session.

### Dependencies

- Existing `bookings` table (completed status)
- Fitness Passport (v3.0) — session notes should reference client passport context
- Existing `send-notification-email` Edge Function
- Recharts (v2.0+) — already in use for earnings analytics

---

## Feature 8: Email Capture / Join the List

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Email input on landing page | Simplest possible waitlist/interest capture; expected on any pre-launch or feature-announcing product | LOW | Single field, submit button, success state |
| Immediate thank-you feedback | User must know their email was received — success message or confirmation screen | LOW | Inline success state on same page; no redirect needed |
| Email deduplication | Don't store or email the same address twice | LOW | Unique constraint on `email_captures` table |
| Admin visibility into captures | Product team needs to see who signed up | LOW | Supabase dashboard + simple admin query; no UI needed for MVP |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Social proof counter ("Join 847 others") | Psychological trigger — real-time or cached count of signups displayed near the form | LOW | COUNT query on `email_captures` table; cache in KV or revalidate every hour |
| Position-in-line (waitlist number) | "You're #342 on the list" — creates anticipation and virality | LOW | Use insert order / row number as position; display in thank-you state |
| Referral mechanic on waitlist | "Share your link to move up the list" — viral growth loop | HIGH | Full referral mechanic for waitlist is a product in itself; defer unless v4.0 explicitly needs growth push |
| Targeted CTA based on role | Two CTAs: "I'm a trainer" / "I'm a client" — capture intent alongside email | LOW | Add `intended_role ENUM('trainer', 'client', 'unknown')` to `email_captures`; drives segmented email campaigns |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Modal pop-up on page load | Universally disliked; hurts first impression for a luxury brand | Inline section in landing page hero or footer; exit-intent popup is acceptable but not entry |
| Multi-field form (name + phone + email) | Every additional field reduces conversion; email-only converts best | Email-only; optionally add role toggle (single click, not typed field) |
| Third-party waitlist service (Waitlist.ly, etc.) | Adds external dependency; FitRush can store emails in Supabase with a single table | Simple Supabase `email_captures` table + Edge Function for Resend welcome email |
| Double opt-in confirmation flow | Adds friction for a waitlist; appropriate for marketing lists but overkill here | Single opt-in; add GDPR note "We'll only email you about FitRush" |

### User Flow

1. Visitor lands on FitRush landing page — sees email capture section ("Be first to know when new features arrive").
2. Visitor optionally selects "I'm a trainer" or "I'm a client" toggle.
3. Visitor enters email, taps "Get Early Access".
4. Edge Function validates email format, checks for duplicate, inserts into `email_captures`, sends welcome email via Resend.
5. Inline success state: "You're #342! We'll be in touch."
6. Admin queries `email_captures` from Supabase dashboard for outreach.

### Implementation Notes

- Table: `email_captures(id, email UNIQUE, intended_role, created_at, source TEXT DEFAULT 'landing_page')`
- Edge Function: extend `send-notification-email` or create lightweight `capture-email` function
- Welcome email: simple Resend template; one-time send on capture
- No marketing automation platform needed at this scale

---

## Feature Dependencies Map

```
Feature 2 (Availability Toggle)
  └── Feature 1 (Map Pins) — toggle controls pin visibility
  └── Feature 3 (Location Notifications) — toggle-on triggers notification

Feature 3 (Location Notifications)
  └── Feature 2 (Availability Toggle) — trigger source
  └── Existing notifications system (v1.0)

Feature 4 (AI Matching)
  └── Fitness Passport (v3.0) — primary data source
  └── Feature 2 (Availability Toggle) — optional: surface only online trainers in recommendations

Feature 5 (AI Analytics)
  └── Existing AI slot classification (v3.0)
  └── Existing discount slider (v3.0)
  └── Feature 2 (Availability Toggle) — online/offline patterns feed utilization analysis

Feature 6 (Google Calendar Sync)
  └── Existing iCal system (v3.0) — keep as-is, GCal is additive
  └── cancel-booking Edge Function — extend for GCal delete
  └── Feature 2 (Availability Toggle) — GCal blocking should respect online/offline state

Feature 7 (Session Logging)
  └── Existing bookings table (all versions)
  └── Fitness Passport (v3.0) — context for session notes
  └── Existing send-notification-email Edge Function

Feature 8 (Email Capture)
  └── No dependencies on other v4.0 features — can ship independently first
```

---

## MVP Recommendation (Phase Priority Order)

**Highest value, lowest risk first:**

1. **Feature 8 — Email Capture** — Ship immediately. Zero dependencies, maximum business value, 1-2 hours to build.

2. **Feature 2 — Availability Toggle** — Foundation for map pins and notifications. Single DB column + pg_cron job. Unblocks Features 1 and 3.

3. **Feature 1 — Maps View** — Visual payoff of the toggle. @vis.gl/react-google-maps is well-documented, marker clustering is official library. Maps API cost is low at current scale.

4. **Feature 7 — Session Logging** — High client retention value, low complexity. Builds on existing booking infrastructure. No new external services needed.

5. **Feature 4 — AI Matching** — Deterministic scoring function; no ML required. Immediate value from existing Fitness Passport data. Requires thoughtful RPC design.

6. **Feature 5 — AI Discount Analytics** — Requires adequate slot history data (4+ weeks). Can ship the UI framework early; recommendations improve as data accumulates.

7. **Feature 3 — Location Notifications** — Depends on Feature 2 (toggle) being live and having real usage data. PostGIS adds infrastructure complexity; ship with city/zip matching first.

8. **Feature 6 — Google Calendar Sync** — Highest complexity, most external dependencies (OAuth app verification, watch channel renewal, loop prevention). Ship last to avoid blocking other features.

**Defer to v4.1:**
- Auto-on scheduling (Feature 2 enhancement)
- "Clients like you also trained with" collaborative filtering (Feature 4 enhancement)
- Discount effectiveness tracking with historical snapshot (Feature 5 enhancement)
- Web Push / browser notifications (Feature 3 enhancement)
- Wearable integration (Feature 7 future)
- Waitlist referral mechanic (Feature 8 growth)

---

## Complexity Summary

| Feature | Complexity | Primary Risk | External Service |
|---------|------------|--------------|-----------------|
| Email Capture | LOW | None | Resend (existing) |
| Availability Toggle | LOW | pg_cron timing precision | None |
| Maps View | MEDIUM | API key security, billing | Google Maps JS API |
| Session Logging | LOW-MEDIUM | Schema design for JSONB workout log | None |
| AI Matching | MEDIUM | Cold start (empty Fitness Passport) | None (deterministic) |
| AI Discount Analytics | MEDIUM | Insufficient historical data for recommendations | None (deterministic) |
| Location Notifications | MEDIUM-HIGH | PostGIS setup, notification rate limiting | None (extends Resend) |
| Google Calendar Sync | HIGH | OAuth verification, watch channel expiry, loop prevention | Google Calendar API |

---

## Sources

- [@vis.gl/react-google-maps npm package](https://www.npmjs.com/package/@vis.gl/react-google-maps) — v1.7.1, Google-endorsed, actively maintained
- [Google Maps Marker Clustering](https://developers.google.com/maps/documentation/javascript/marker-clustering) — official documentation
- [Google Calendar API Incremental Sync](https://developers.google.com/workspace/calendar/api/guides/sync) — sync token pattern
- [Google Calendar Push Notifications](https://developers.google.com/workspace/calendar/api/guides/push) — watch channel documentation
- [Google Calendar API Scopes](https://developers.google.com/calendar/api/auth) — scope selection guidance
- [Bidirectional Calendar Sync Implementation Guide 2025](https://calendhub.com/blog/implement-bidirectional-calendar-sync-2025/) — MEDIUM confidence
- [Location-Based Push Notifications Best Practices](https://www.moengage.com/learn/location-based-push-notifications/) — MEDIUM confidence
- [Uber Driver App Stay Online](https://help.uber.com/en/driving-and-delivering/article/stay-online-with-driver-app) — availability toggle behavior reference
- [AI in Personalized Fitness Apps 2025](https://www.kitlabs.us/ai-personalized-fitness-apps/) — matching patterns, MEDIUM confidence
- [Waitlist Landing Page Optimization Guide](https://waitlister.me/growth-hub/guides/waitlist-landing-page-optimization-guide) — email capture best practices
- [Fitness App UX Design Principles](https://stormotion.io/blog/fitness-app-ux/) — session logging UX patterns
- [AI Fitness App Recommendation Systems](https://indatalabs.com/resources/ai-fitness-app) — matching algorithm patterns, MEDIUM confidence
