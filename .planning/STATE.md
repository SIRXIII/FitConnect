---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: -- The Live Platform
status: unknown
stopped_at: Completed 33-02-PLAN.md (Admin Dashboard Live Data - UI Layer)
last_updated: "2026-03-23T08:06:09.463Z"
progress:
  total_phases: 10
  completed_phases: 3
  total_plans: 9
  completed_plans: 14
---

# Project State -- FitRush

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-20)

**Core value:** Trainers monetize idle hours, clients get premium training at below-market prices
**Current focus:** v6.0 Growth Engine -- planned, ready to execute

## Current Position

Milestone: v6.0 Growth Engine -- IN PROGRESS
All 3 phases planned, 6 plans total, 16 requirements.

```
v6.0 Progress: [##########] 100% (6/6 plans)

Phase 35: Push Notifications        [x] 2/2 plans
Phase 36: Trainer Video Intros      [x] 2/2 plans
Phase 37: Group Sessions            [x] 2/2 plans
```

## Next Steps

Phases 35, 36, and 37 are all Wave 1 relative to each other (independent — no cross-phase dependencies). Can be executed in any order or in parallel worktrees.

Execute with:
```
/gsd:execute-phase 35-push-notifications
/gsd:execute-phase 36-trainer-video-intros
/gsd:execute-phase 37-group-sessions
```

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

## Blockers / Concerns

- **Phase 28**: Google OAuth verification must complete before GCal sync feature reaches production users (4-8 week external timeline, started Phase 21)
- **Phase 35**: Firebase project setup and APNs key upload required. Run `npm install` once disk space freed (firebase + @capacitor/push-notifications not yet installed). Until then, push gracefully no-ops.

## Accumulated Context

- 31 phases shipped across 5 milestones (v1.0-v5.0 including v6.0 planning)
- 81+ plans executed, 127+ requirements delivered
- ~31,000 LOC TypeScript/SQL, 17 Edge Functions, 31 migrations
- Supabase project: qecwxvvlpvrnrqyrdxrj

## Session Continuity

Last session: 2026-03-23T08:06:09.461Z
Stopped at: Completed 33-02-PLAN.md (Admin Dashboard Live Data - UI Layer)
Resume file: None
