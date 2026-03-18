# Requirements: FitRush v4.0 -- The Live Platform

**Defined:** 2026-03-18
**Core Value:** Trainers monetize idle hours, clients get premium training at below-market prices -- now with real-time Uber-style availability, map discovery, and AI-powered matching.

## v4.0 Requirements

Requirements for the Live Platform milestone. Each maps to roadmap phases.

### Maps (MAP)

- [ ] **MAP-01**: Client can view a Google Map with clustered trainer location pins
- [ ] **MAP-02**: Client can click a pin to see trainer info card (name, specialty, rate, Book button)
- [ ] **MAP-03**: Client can toggle between map view and list view on the search page
- [ ] **MAP-04**: Map shows only trainers currently marked as available (live pin visibility)
- [ ] **MAP-05**: Trainer pins display location type icon (gym, park, in-home)
- [ ] **MAP-06**: Elite trainer pins display tier badge on map

### Trainer Locations (LOC)

- [ ] **LOC-01**: Trainer can add workout locations with address entry and Google Maps preview
- [ ] **LOC-02**: Trainer can adjust pin position on map after address entry
- [ ] **LOC-03**: Trainer can select location type (gym, park, in-home) for each workout spot
- [ ] **LOC-04**: Trainer can manage multiple workout locations

### Availability Toggle (AVAIL)

- [ ] **AVAIL-01**: Trainer can toggle online/offline availability (Uber-style live switch)
- [ ] **AVAIL-02**: Trainer can set sleep timer to auto-disable availability at a chosen time
- [ ] **AVAIL-03**: System auto-expires stale availability sessions via pg_cron
- [ ] **AVAIL-04**: Booking creation uses atomic PostgreSQL RPC to prevent double-booking race conditions

### Location Notifications (NOTIF)

- [ ] **NOTIF-01**: Client can set preferred area/neighborhood for trainer availability alerts
- [ ] **NOTIF-02**: Client can opt into live GPS mode when activating "looking now" toggle
- [ ] **NOTIF-03**: Client receives in-app alert when a nearby trainer goes live at a great rate
- [ ] **NOTIF-04**: Client can toggle location-based notifications on/off
- [ ] **NOTIF-05**: Notifications are frequency-capped (max 3/day per client, 4hr cooldown per trainer)
- [ ] **NOTIF-06**: Client can configure notification preferences before alerts begin

### AI Matching (AIMATCH)

- [ ] **AIMATCH-01**: Client sees "Recommended for You" trainers based on Fitness Passport data
- [ ] **AIMATCH-02**: Match score displays with 2-3 attribute explanation (e.g. "matches your HIIT goals")
- [ ] **AIMATCH-03**: Client prompted to complete Fitness Passport if data is below matching threshold
- [ ] **AIMATCH-04**: Match results cached for 24 hours to reduce computation

### AI Trainer Analytics (AIANALYTICS)

- [ ] **AIANALYTICS-01**: Trainer sees idle slot pattern analysis as a day/hour heatmap
- [ ] **AIANALYTICS-02**: Trainer receives actionable discount recommendation cards for empty slots
- [ ] **AIANALYTICS-03**: Trainer sees an optimization score based on slot utilization

### Google Calendar Sync (CALSYNC)

- [ ] **CALSYNC-01**: Trainer can connect Google Calendar via OAuth from settings
- [ ] **CALSYNC-02**: FitRush bookings automatically push to Google Calendar as events
- [ ] **CALSYNC-03**: External Google Calendar events block FitRush availability slots
- [ ] **CALSYNC-04**: Booking cancellation removes the corresponding Google Calendar event
- [ ] **CALSYNC-05**: Existing iCal export continues working as fallback during OAuth verification

### Session History (SESSION)

- [ ] **SESSION-01**: Trainer can write post-session notes for a completed booking
- [ ] **SESSION-02**: Client can view session notes written by trainers
- [ ] **SESSION-03**: Trainer can log structured workout data (exercises, sets, reps)
- [ ] **SESSION-04**: Client sees a progress timeline with session history and workout trends

### Email Capture (WAITLIST)

- [x] **WAITLIST-01**: Visitor can enter email on landing page to join the waitlist
- [x] **WAITLIST-02**: Visitor receives confirmation email after signup via Resend
- [ ] **WAITLIST-03**: Visitor sees their position in the waitlist after signup

## Future Requirements (v4.1+)

### AI Marketing Tier for Trainers

- **MKTG-01**: Trainer can link social media profiles (Instagram, TikTok, YouTube) to FitRush
- **MKTG-02**: AI generates marketing content and analytics for trainer social media
- **MKTG-03**: Social media posts sync to trainer's FitRush profile
- **MKTG-04**: Upgraded subscription tier with marketing tools included

### Deferred from Research

- **COLLAB-01**: "Clients like you also booked" collaborative filtering (needs 6+ months booking data)
- **DISCOUNT-01**: Discount effectiveness tracking with historical snapshots at booking time
- **PUSH-01**: Web Push / browser notifications via FCM (iOS PWA limitations)
- **WEARABLE-01**: Apple Health / Fitbit wearable integrations
- **AUTO-01**: Auto-on scheduling for trainer availability (complex per-trainer cron)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live GPS tracking of trainer movement | Creepy for trainers; static workout location sufficient |
| Street View integration | API cost + scope creep for minimal fitness value |
| Route/directions from map | Link to Google Maps deep link instead |
| Background location "Always" mode | iOS App Store rejection risk + battery drain |
| ML model training | No training data yet; deterministic scoring sufficient |
| Waitlist referral mechanic | Full growth product, not needed for v4.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WAITLIST-01 | Phase 21 | Complete |
| WAITLIST-02 | Phase 21 | Complete |
| WAITLIST-03 | Phase 21 | Pending |
| AVAIL-01 | Phase 22 | Pending |
| AVAIL-02 | Phase 22 | Pending |
| AVAIL-03 | Phase 22 | Pending |
| AVAIL-04 | Phase 22 | Pending |
| MAP-01 | Phase 23 | Pending |
| MAP-02 | Phase 23 | Pending |
| MAP-03 | Phase 23 | Pending |
| MAP-04 | Phase 23 | Pending |
| MAP-05 | Phase 23 | Pending |
| MAP-06 | Phase 23 | Pending |
| LOC-01 | Phase 23 | Pending |
| LOC-02 | Phase 23 | Pending |
| LOC-03 | Phase 23 | Pending |
| LOC-04 | Phase 23 | Pending |
| SESSION-01 | Phase 24 | Pending |
| SESSION-02 | Phase 24 | Pending |
| SESSION-03 | Phase 24 | Pending |
| SESSION-04 | Phase 24 | Pending |
| AIMATCH-01 | Phase 25 | Pending |
| AIMATCH-02 | Phase 25 | Pending |
| AIMATCH-03 | Phase 25 | Pending |
| AIMATCH-04 | Phase 25 | Pending |
| AIANALYTICS-01 | Phase 26 | Pending |
| AIANALYTICS-02 | Phase 26 | Pending |
| AIANALYTICS-03 | Phase 26 | Pending |
| NOTIF-01 | Phase 27 | Pending |
| NOTIF-02 | Phase 27 | Pending |
| NOTIF-03 | Phase 27 | Pending |
| NOTIF-04 | Phase 27 | Pending |
| NOTIF-05 | Phase 27 | Pending |
| NOTIF-06 | Phase 27 | Pending |
| CALSYNC-01 | Phase 28 | Pending |
| CALSYNC-02 | Phase 28 | Pending |
| CALSYNC-03 | Phase 28 | Pending |
| CALSYNC-04 | Phase 28 | Pending |
| CALSYNC-05 | Phase 28 | Pending |

**Coverage:**
- v4.0 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 — traceability confirmed after roadmap creation*
