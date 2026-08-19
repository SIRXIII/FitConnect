---
gsd_state_version: 1.0
milestone: v6.1
milestone_name: Admin Portal Quality
status: executing
stopped_at: Phase 39 starting
last_updated: "2026-06-11T18:30:00.000Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 4
  completed_plans: 0
---

# Project State -- FitRush

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-20)

**Core value:** Trainers monetize idle hours, clients get premium training at below-market prices
**Current focus:** v6.1 Admin Portal Quality -- EXECUTING. Audit complete; fixing typography, broken fetches, fake data, then one release to CF Pages (canonical) + Netlify.

## Current Position

Milestone: v6.1 Admin Portal Quality -- EXECUTING
4 phases (39-42), 18 requirements. Audit + plan: ~/.claude/plans/please-look-at-the-splendid-dream.md

```
v6.1 Progress: [----------] 0% (0/4 phases)

Phase 39: Typography & Visual Clarity   [ ] -- IN PROGRESS
Phase 40: Broken Fetches + RPC Backfill [ ]
Phase 41: Real Data + Test Data Purge   [ ]
Phase 42: Release + Verification        [ ]
```

## Coordination

- Pending Trainers tab (AdminDashboard.tsx ~428-490, ~1538-1600) OFF-LIMITS -- another agent owns it. Check `git log --oneline -3` before each phase.
- Never delete pt.golive.0611@fitrush.dev (pending trainer), sirxiii@gmail.com, hostcalifornia@gmail.com.
- 11 commits were unpushed at audit time; both live hosts serve stale bundles. Single release in Phase 42; Cloudflare Pages = canonical host (user decision 2026-06-11).

## Next Steps (carried from v6.0)

1. **Firebase iOS integration** (manual/CW steps): GoogleService-Info.plist, capacitor.config.ts push config, Xcode Push capability
2. **iOS rebuild** with v6.0 features; **App Store resubmission** after Apple review of Build 5.0.0(2)
3. **v4.1+ AI Marketing Tier** (deferred)

## Decisions

See `.planning/PROJECT.md` Key Decisions table for full history.
- [Phase 30]: Password reset routes through /auth/callback with type=recovery, then to dedicated /auth/reset-password page
- [Phase 30]: ProtectedRoute uses useLocation to preserve full path+search as ?redirect= param when redirecting to /login
- [Phase 32]: Sub-ratings (punctuality/expertise/communication) added to review modal — they were in the DB schema and displayed on TrainerProfile but were never collected or saved
- [Phase 33]: Admin dashboard retains demo data preview mode (clearly labeled) — intentional for new platform with no live data yet
- [Phase 34]: Pull-to-refresh uses pure touch events (no Capacitor plugin); notification dropdown gets manual refresh button instead of swipe gesture
- [v6.0 Planning]: Push notifications use Firebase Admin SDK in edge function (unifies web FCM + iOS APNs routing)
- [v6.0 Planning]: Group session capacity managed via RPC + booking count query, not a separate counter column
- [v6.0 Planning]: Video thumbnail captured client-side via canvas (same pattern as avatar compression in Phase 18)
- [Phase 36]: VideoUploader placed in TrainerDashboard profile tab above SettingsTab; fetchProfile(user.id) called on upload completion to refresh auth store
- [Phase 36]: intro_video_url added to legacy Trainer interface + mapped in dbTrainerToCardData — avoids refactoring TrainerCard to accept TrainerWithProfile directly
- [Phase 37]: Group slot creation uses dedicated form section in AvailabilityManager (not grid click) — capacity/rate params require more input than a single cell click can express
- [Phase 37]: create_booking_atomic updated to check capacity count for group slots instead of is_booked flag — group slots keep is_booked=false until truly full (DB trigger handles restoration)
- [Phase 37]: Participant list placed in TrainerBookings.tsx (not TrainerDashboard.tsx) — that's where booking detail views exist
- [Phase 33-admin-dashboard-live-data]: Admin payout bypass uses optional trainer_id body param in create-payout edge function, validated with admin role check + 403 guard
- [Phase 33-admin-dashboard-live-data]: get_admin_user_list joins auth.users via SECURITY DEFINER — only safe path to email/last_sign_in_at without exposing auth schema to RLS
- [Phase 33-admin-dashboard-live-data]: held status added to payout_transactions check constraint to support future admin hold workflow
- [Phase 33-admin-dashboard-live-data]: Demo data removed from AdminDashboard — real zeros preferred over misleading mock data for new platform
- [Phase 33-admin-dashboard-live-data]: MRR/subscriber counts read from top-level RPC response keys (data.mrr) not nested data.totals.mrr
- [Phase Phase 33-admin-dashboard-live-data]: Payouts tab approve calls create-payout edge function with trainer_user_id (not profile ID) matching the edge function's existing user_id lookup
- [Phase Phase 33-admin-dashboard-live-data]: Users tab uses client-side filtering after full get_admin_user_list fetch for instant filter responsiveness without extra RPC calls
- [Phase 38-client-workout-log-exercise-diagrams]: workout.ts kept separate from session.ts -- client-owned logs must not conflict with trainer-owned types from Phase 24
- [Phase 38-client-workout-log-exercise-diagrams]: exercise_key is nullable -- custom exercises have no key and fall back to muscle group SVG
- [Phase 38-client-workout-log-exercise-diagrams]: ExerciseDiagram SVG fallback via React useState + onError rather than CSS background-image
- [Phase 38-client-workout-log-exercise-diagrams]: ClientWorkoutSummary placed outside completed-status condition in TrainerBookings -- trainers see client history for any booking status
- [Phase 38-client-workout-log-exercise-diagrams]: ClientPassport workout history section uses border-t separator at bottom of page to keep profile editing fields uncluttered
- [Phase 38-client-workout-log-exercise-diagrams]: Exercise picker shows all EXERCISES when query is empty, sliced to 20 results to keep list manageable

## Blockers / Concerns

- **Phase 28**: Google OAuth verification must complete before GCal sync feature reaches production users (4-8 week external timeline, started Phase 21)
- **Phase 35**: Firebase secrets set, APNs key uploaded. Remaining: GoogleService-Info.plist copy + Xcode Push capability (CW manual step).

## Accumulated Context

- 38 phases shipped across 6 milestones (v1.0-v6.0)
- 90+ plans executed, 143+ requirements delivered
- ~33,000 LOC TypeScript/SQL, 18 Edge Functions, 34 migrations
- Supabase project: qecwxvvlpvrnrqyrdxrj
- Build: 3034 modules, clean (2026-04-05)

## Session Continuity

Last session: 2026-04-05
Stopped at: v6.0 Growth Engine complete, all 4 phases verified
Resume file: None
