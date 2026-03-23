# Phase 38: Client Workout Log & Exercise Diagrams - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Clients can log their workouts (exercises, sets, reps, weight) with visual exercise illustrations. Logs persist across sessions and trainers. The next trainer sees the client's last workout so they can pick up where the previous trainer left off. Creates continuity even when switching trainers.

</domain>

<decisions>
## Implementation Decisions

### Exercise Illustrations
- Static SVG exercise illustrations bundled in the app (no external API)
- Library of 40-60 common exercises covering major muscle groups
- Each exercise has a key (e.g., "bench_press", "squat", "deadlift") mapped to an SVG illustration
- Illustrations are clean line-art style matching FitRush editorial aesthetic
- Fallback: generic muscle group icon when no specific illustration exists

### Log Entry UX
- Post-session quick-add form accessible from completed booking and standalone from client dashboard
- Exercise selection from predefined searchable list with "Add custom exercise" option
- Per exercise: multiple sets, each set has reps and weight (lbs/kg toggle)
- Quick-add pattern: tap exercise, enter sets inline, save
- Optional session notes field (free text)
- Mobile-first input design, minimal taps

### Trainer View
- Read-only summary of client's recent workout logs
- Visible on: booking detail page (before/during session) and client's Fitness Passport
- Shows last 5 sessions grouped by date with trainer name
- Each session expandable to show exercises, sets, reps, weight
- Trainer sees this automatically when viewing a client's upcoming booking

### Data Model
- `workout_logs` table: id, client_id, booking_id (nullable for standalone logs), logged_at, notes, created_at
- `workout_exercises` table: id, log_id, exercise_name, exercise_key (for illustration lookup), sort_order, sets (JSONB array of {reps: number, weight: number, unit: 'lbs'|'kg'})
- RLS: client can CRUD own logs, trainer can SELECT logs for their booked clients
- Client dashboard shows workout history with pagination

### Claude's Discretion
- Exact SVG illustration style and sourcing approach
- Exercise list curation (which 40-60 exercises to include)
- Animation on log entry (Framer Motion transitions)
- Pagination approach for workout history
- How to handle unit conversion (lbs/kg)

</decisions>

<canonical_refs>
## Canonical References

No external specs. Requirements fully captured in decisions above.

### Key source files
- `src/pages/ClientDashboard.tsx` - Client dashboard where workout log tab will be added
- `src/pages/ClientPassport.tsx` - Fitness Passport where trainer sees client history
- `src/pages/BookSession.tsx` - Booking flow where trainer could see prior logs
- `src/pages/TrainerBookings.tsx` - Trainer booking management
- `src/hooks/useAvailability.ts` - Pattern for Supabase hooks with CRUD
- `src/components/trainer/AvailabilityManager.tsx` - Pattern for grid-based interactive UI

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ClientDashboard.tsx` tab system (Overview, Fitness Profile, Settings, Progress, Alerts, Support) can add a "Workouts" tab
- `ClientPassport.tsx` already shows client fitness data to trainers, workout logs integrate naturally
- Framer Motion already used throughout for animations
- Sonner toast for success/error feedback
- Supabase client pattern with `(supabase as any)` for tables not in generated types

### Established Patterns
- Tab-based dashboards (client, trainer, admin all use tabs)
- useCallback + useEffect for data fetching
- Loading states with spinner component
- Accordion/expandable sections (FAQ, HelpCenter patterns)

### Integration Points
- New "Workouts" tab in ClientDashboard
- Workout summary section in ClientPassport (trainer-visible)
- Link from completed booking to "Log Workout"
- New Supabase migration for workout_logs and workout_exercises tables
- Static SVG assets in public/assets/exercises/

</code_context>

<specifics>
## Specific Ideas

- User wants clean diagrams/illustrations of actual exercises (not just text)
- Key use case: client switches trainers, new trainer sees last session's exercises and picks up from there
- Think of it as a portable workout passport that travels with the client
- Should feel like a natural extension of the Fitness Passport concept

</specifics>

<deferred>
## Deferred Ideas

- AI-powered workout suggestions based on log history
- Trainer can create workout plans and assign to clients
- Progress charts (weight progression over time per exercise)
- Social sharing of workout achievements

</deferred>

---

*Phase: 38-client-workout-log-exercise-diagrams*
*Context gathered: 2026-03-23*
