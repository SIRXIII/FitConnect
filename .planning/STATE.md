---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: The Live Platform
status: completed
stopped_at: Completed 21-02-PLAN.md (Hero email capture + GCP checklist) — Phase 21 complete
last_updated: "2026-03-18T21:19:37.401Z"
last_activity: 2026-03-18 -- Hero email capture form and GCP checklist complete
progress:
  total_phases: 8
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# Project State -- FitRush

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-18)

**Core value:** Trainers monetize idle hours, clients get premium training at below-market prices
**Current focus:** v4.0 The Live Platform — Phase 21 next

## Current Position

Phase: 21 of 28 (Email Capture + Platform Controls)
Plan: 2 of 2 (complete — checkpoint approved, phase fully done)
Status: Complete
Last activity: 2026-03-18 -- Hero email capture form and GCP checklist complete

```
v4.0 Progress: [█░░░░░░░] 12% (1/8 phases)

Phase 21: Email Capture + Platform Controls  [x] Complete
Phase 22: Availability Toggle Foundation     [ ] Not started
Phase 23: Map View + Trainer Locations       [ ] Not started
Phase 24: Session Logging                    [ ] Not started
Phase 25: AI Trainer-Client Matching         [ ] Not started
Phase 26: AI Discount Analytics              [ ] Not started
Phase 27: Location-Based Notifications       [ ] Not started
Phase 28: Google Calendar Bidirectional Sync [ ] Not started
```

## Decisions

See `.planning/PROJECT.md` Key Decisions table for full history.

Recent decisions relevant to v4.0:
- Use `@vis.gl/react-google-maps` (Google-endorsed, replaces unmaintained community fork)
- AI matching: deterministic Postgres RPC (100-point scale, no external API) for MVP
- PostGIS `geography(POINT)` for spatial queries (with explicit TS type overrides)
- OAuth tokens in separate `trainer_gcal_tokens` table, not on `trainer_profiles`
- [Phase 21]: Silent 200 on duplicate email (23505) prevents enumeration attacks
- [Phase 21]: Service-role key for waitlist insert bypasses RLS without exposing anon policy
- [Phase 21-02]: Hero input uses type=text not type=email — browser HTML5 validation in jsdom blocks form submit before Zod runs
- [Phase 21-02]: Zod 4 uses result.error.issues not result.error.errors (breaking change from Zod 3)
- [Phase 21-02]: No waitlist position number shown — simple "You're In." confirmation per CONTEXT.md locked decision overriding WAITLIST-03 literal

## Blockers / Concerns

- **Phase 21**: Start Google OAuth consent screen verification immediately — 4–8 week external timeline
- **Phase 21**: Set GCP billing budget cap ($10/month) and restrict Maps API key before any map code ships
- **Phase 27**: Confirm `pg_net` extension availability on current Supabase plan before designing notification trigger (free tier requires pg_cron polling fallback)
- **Phase 28**: Google OAuth verification must complete before sync feature reaches production users

## Strategic Todos

- **TRUST INFRASTRUCTURE**: Differentiation must be built around: (1) verified credentials and safety guardrails (integrate certification verification flows already available), (2) transparent pricing and in-app cancellation with explicit renewal controls, (3) matching system that prevents availability and location misrepresentation before charging, (4) PT tooling that removes admin pain (autosave, undo, exercise-level notes, scalable programming, structured check-ins). Must deliver 2+ at meaningfully better level than incumbents to avoid slow growth, high churn, and expensive acquisition with low defensibility.

## Accumulated Context

- 20 phases shipped across 4 milestones (v1.0–v3.0)
- 57+ plans executed, 83+ requirements delivered
- ~17,700 LOC TypeScript/SQL, 14 Edge Functions, 22 migrations
- Supabase project: qecwxvvlpvrnrqyrdxrj
- Live at: fitrush-app.netlify.app

## Session Continuity

Last session: 2026-03-18T21:15:48.641Z
Stopped at: Completed 21-02-PLAN.md (Hero email capture + GCP checklist) — Phase 21 complete
Resume file: None
