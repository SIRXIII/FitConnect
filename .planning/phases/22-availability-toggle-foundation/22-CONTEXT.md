# Phase 22: Availability Toggle Foundation - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Trainers can go online/offline with a live toggle and sleep timer from the trainer dashboard. The booking system gains Instant Book vs Request to Book modes (Airbnb-style), and an atomic PostgreSQL RPC prevents double-booking race conditions. Clients see live trainer status in real time via Supabase Realtime.

</domain>

<decisions>
## Implementation Decisions

### Toggle UX + Placement
- Sticky header bar on trainer dashboard -- always visible, never scrolls away
- Green accent bar + "You are LIVE" status text when online; neutral/dark when offline
- Toggle is a single tap to go live / go offline
- 5-second "Going live..." warm-up animation before trainer becomes visible to clients
- Going offline with upcoming bookings: allow with warning ("You have 2 upcoming bookings. Going offline won't cancel them.")
- First-time use: quick dismissible tooltip explaining the toggle

### Booking Mode (Instant vs Request)
- Per-session toggle: trainer sets default mode in settings, can override when going live
- **Instant Book**: client books immediately, slot is reserved atomically
- **Request to Book**: client sends request, trainer sees it in dashboard queue
- Badge on trainer profile card and profile page: "Instant Book" or "Request to Book"
- Request queue shows rich client card: name, avatar, Fitness Passport summary, booking history with this trainer, requested slot time, countdown to auto-decline
- Max 5 pending requests at a time; new clients see "Trainer is busy" when queue is full
- Individual accept/decline only (no batch operations)
- 30-minute auto-decline timeout on pending requests
- Switching from Request to Instant mid-session: pending requests stay alive, new bookings are instant
- Auto-decline all pending requests when trainer goes offline (manual or auto-expire)

### Sleep Timer
- Pill buttons in sticky header: 1hr, 2hr, 4hr, EOD
- Always-visible countdown next to status: "LIVE - 2h 14m remaining"
- EOD = midnight in trainer's local timezone
- Tap countdown to extend without going offline -- reopens pill buttons, new duration adds to current time

### Double-Booking Prevention
- Atomic PostgreSQL RPC for booking creation (SELECT ... FOR UPDATE on slot row)
- When client loses race: toast error "This slot was just booked by another client" + auto-refresh available slots
- Realtime slot updates on booking page -- grey out slots as they get booked by others in real time
- For Request mode: pending booking appears in "My Bookings" with "Pending Approval" status + countdown to auto-decline

### Auto-Expiry
- 10-minute warning notification before sleep timer expires: "Your availability expires in 10 minutes. Extend?"
- 12-hour maximum session duration cap (even without timer)
- pg_cron job checks for stale sessions every 5 minutes (per AVAIL-03)
- Auto-decline all pending requests when auto-expiry triggers

### Client-Side Availability Display
- Green dot + "Live Now" badge on trainer cards in search results
- Live trainers get visual priority in search results
- No live notifications in this phase (deferred to Phase 27: Location-Based Notifications)

### Concurrency + Slot Rules
- Strictly 1:1 personal training -- one client per slot
- No overlapping availability time ranges allowed
- Group sessions deferred to future phase

### Claude's Discretion
- Exact animation timing and easing for warm-up transition
- Header bar layout details (spacing, typography sizing)
- pg_cron implementation specifics
- Realtime channel naming and subscription patterns
- Error state handling beyond double-booking (network failures, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Availability requirements
- `.planning/REQUIREMENTS.md` -- AVAIL-01 through AVAIL-04 acceptance criteria

### Existing codebase patterns
- `Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx` -- Trainer dashboard with existing Realtime subscriptions (bookings + availability_slots channels)
- `Cenlar demand gt 1-17/src/pages/BookSession.tsx` -- Current booking creation logic (direct insert, needs atomic RPC replacement)
- `Cenlar demand gt 1-17/src/stores/auth.ts` -- Zustand auth store with trainerProfile state
- `Cenlar demand gt 1-17/src/components/booking/BookingWizard.tsx` -- Multi-step booking flow
- `Cenlar demand gt 1-17/src/components/subscription/BillingToggle.tsx` -- Existing two-state toggle pattern
- `Cenlar demand gt 1-17/src/types/supabase.ts` -- Database type definitions (trainer_profiles, availability_slots, bookings)
- `Cenlar demand gt 1-17/supabase/functions/cancel-booking/index.ts` -- Edge Function auth + RLS pattern

### No external specs
No external specs or ADRs -- requirements fully captured in decisions above and REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BillingToggle.tsx`: Two-state button pattern with conditional CSS (selected = `bg-ink text-white`)
- `useNotifications.ts`: Supabase Realtime subscription hook pattern
- `BookingWizard.tsx`: Multi-step wizard with framer-motion transitions (AnimatePresence)
- `sonner` toast library: Already used for notifications throughout the app

### Established Patterns
- Supabase Realtime: `supabase.channel('name').on('postgres_changes', {...}).subscribe()` -- used in TrainerDashboard, MyBookings, Messages
- Zustand store: Single auth store with `trainerProfile` state -- extend with availability fields
- Edge Functions: JWT auth + service-role key pattern (see cancel-booking)
- Tailwind CSS: Uppercase labels, tracking-wide, accent color system

### Integration Points
- `TrainerDashboard.tsx`: Add sticky header bar above existing tab content
- `auth.ts` store: Add `availability_status`, `booking_mode`, `sleep_timer_expires_at` to trainerProfile
- `BookSession.tsx`: Replace direct insert with atomic RPC call
- `trainer_profiles` table: Add columns for availability state
- New `booking_requests` table for Request to Book queue
- pg_cron: Add job for stale session cleanup (similar to existing weekly-payouts cron)

</code_context>

<specifics>
## Specific Ideas

- Airbnb-style Instant Book vs Request to Book -- trainer chooses per session, clients see badge
- "Going live..." 5-second warm-up feels premium, like Uber driver going online
- Rich client card in request queue shows Fitness Passport data so trainer can make informed accept/decline decisions
- Countdown always visible in header -- trainer never loses track of remaining time

</specifics>

<deferred>
## Deferred Ideas

- Group sessions / configurable slot capacity -- future phase
- Live notifications when favorite trainer goes online -- Phase 27 (Location-Based Notifications)
- Push notifications for booking requests -- requires push infrastructure (FCM)
- Overlapping availability for different locations -- future phase if multi-location is needed
- Auto-on scheduling for trainer availability -- deferred to AUTO-01 (complex per-trainer cron)

</deferred>

---

*Phase: 22-availability-toggle-foundation*
*Context gathered: 2026-03-18*
