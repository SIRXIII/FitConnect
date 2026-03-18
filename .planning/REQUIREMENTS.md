# Requirements: FitRush v3.0 — The Premium Experience & Trust Update

**Defined:** 2026-03-17
**Core Value:** Harden the platform's trust foundation, give trainers calendar tools that match their real workflow, introduce rich trainee profiles that improve trainer-client matching, and polish the experience to feel marketing-ready.

## v3.0 Requirements

### Security & Trust (SEC)

- [ ] **SEC-01**: All Edge Functions verify JWT tokens before processing requests (currently some accept unverified calls)
- [ ] **SEC-02**: Trainer search `ilike` queries are parameterized to prevent SQL injection
- [ ] **SEC-03**: RLS policies audit — every table has row-level security enforced; no public read/write without policy
- [ ] **SEC-04**: Payment race condition fixed — booking status only transitions to `confirmed` after Stripe payment_intent succeeds (webhook-driven, not client-side)
- [ ] **SEC-05**: Cancellation refund flow — cancelled bookings within refund window trigger Stripe refund via Edge Function; admin can override refund eligibility
- [ ] **SEC-06**: All user-facing form inputs validated with Zod schemas (shared between frontend and Edge Functions)
- [ ] **SEC-07**: Audit log table records security-sensitive mutations (tier overrides, refunds, admin actions) with actor, action, timestamp, and before/after values

### Calendar & Scheduling (CAL)

- [x] **CAL-01**: Trainer can export their availability schedule as an `.ics` file (RFC 5545) downloadable from Trainer Settings
- [x] **CAL-02**: Trainer can subscribe to a live iCal feed URL that auto-updates when slots or bookings change (calendar apps poll this URL)
- [x] **CAL-03**: iCal feed uses an opaque `calendar_export_token` (not trainer UUID) to prevent ID enumeration; token is resettable from Trainer Settings
- [x] **CAL-04**: Trainer can configure buffer time between bookings (15, 30, 45, or 60 minutes) in Trainer Settings
- [x] **CAL-05**: Buffer time is enforced server-side — booking attempts that violate buffer time are rejected with a clear error message
- [x] **CAL-06**: Existing `get_visible_slots` RPC respects buffer times, hiding slots that fall within another booking's buffer window

### Trainee Profile — "Fitness Passport" (FIT)

- [x] **FIT-01**: Client can upload a profile avatar (max 5MB, JPEG/PNG/WebP) that is compressed client-side before upload to Supabase Storage
- [x] **FIT-02**: Client can write a bio/description (up to 500 characters) visible on their profile
- [x] **FIT-03**: Client can complete a "Fitness Passport" intake form capturing: fitness goals, preferred workout types, training frequency preference, and physical limitations/injuries
- [x] **FIT-04**: Fitness Passport data is stored in the existing `client_profiles` table (fields already exist from onboarding migration)
- [x] **FIT-05**: Trainers can view a client's Fitness Passport summary on the booking detail page before accepting a session
- [x] **FIT-06**: Client can update their Fitness Passport at any time from their profile settings

### UX Polish (UXP)

- [ ] **UXP-01**: Booking flow redesigned for premium feel — progress indicator, animated transitions, clear pricing breakdown before confirmation
- [x] **UXP-02**: All user-uploaded images (avatars, trainer photos) optimized with client-side compression (target: <200KB) and served via Supabase Storage CDN
- [x] **UXP-03**: Loading states across the app use skeleton screens instead of spinners for a polished feel
- [x] **UXP-04**: Error states show actionable messages (not raw error strings) with retry options where applicable

## Acceptance Criteria

Each requirement maps 1:1 to a testable criterion. A requirement is "done" when:
1. The feature works as described in the requirement
2. Edge cases are handled (empty state, error state, permission denied)
3. No regression in existing functionality

## Scope Boundaries

**In scope for v3.0:**
- iCal export and subscription feed (one-way: FitRush → external calendar)
- Buffer time enforcement
- Trainee profile intake using existing `client_profiles` schema
- Security hardening of existing code

**Explicitly deferred to v3.1+:**
- Google Calendar OAuth bidirectional sync (requires OAuth consent screen verification, refresh token storage, channel renewal)
- Trainer profile photo upload (trainers already have photos; focus on client avatars first)
- AI-powered trainer-client matching based on Fitness Passport data

## Cross-References

- Security backlog originated from v1.1 audit (see `.planning/MILESTONES.md`)
- `client_profiles` table created in `20260315120000_onboarding.sql`
- Calendar architecture details in `.planning/research/ARCHITECTURE.md`
- Stack decisions in `.planning/research/STACK.md`

---
*Defined: 2026-03-17 | Milestone: v3.0*
