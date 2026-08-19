# v6.1 Requirements — Admin Portal Quality

**Milestone:** v6.1 "Admin Portal Quality"
**Goal:** The admin portal at fitconnect-2sn.pages.dev/admin looks professional (crisp typography, proper contrast), every tab fetches real data with zero console errors, no fake/hardcoded values remain, test data is purged, and the release pipeline (push → Cloudflare Pages canonical + Netlify sync) actually ships what's on main.

**Out of scope:** Pending Trainers tab internals (owned by another agent), Analytics time-series charts (v6.2 candidate), Stripe Connect onboarding flows, profiles RLS tightening (security follow-up).

---

## TYPO — Typography & Visual Clarity (Phase 39)

- [ ] TYPO-01: Google Fonts load via preconnect+preload in index.html; render-blocking @import removed from index.css
- [ ] TYPO-02: Body text renders with -webkit-font-smoothing: antialiased, -moz-osx-font-smoothing: grayscale, text-rendering: optimizeLegibility
- [ ] TYPO-03: KPI StatCard values render in Inter font-semibold with tabular-nums (Cormorant serif preserved on page titles/brand)
- [ ] TYPO-04: Readable labels (table headers, tabs, section headers) use text-ink/70 minimum at 10px+ — no readable text below text-ink/60 or 10px

## FETCH — Zero Broken Fetches (Phase 40)

- [ ] FETCH-01: Flagged-reviews query returns 200 (correct PostgREST embed verified against live FK names)
- [ ] FETCH-02: No 406 on /admin load — client_profiles personalization fetch guarded by role or maybeSingle()
- [ ] FETCH-03: get_referral_leaderboard RPC exists in live DB (backfill migration applied); no 404
- [ ] FETCH-04: approve_trainer + reject_trainer RPC definitions committed to supabase/migrations (exact live definitions, CREATE OR REPLACE)

## DATA — Real Data Everywhere (Phase 41)

- [ ] DATA-01: System Health rows reflect live probes (DB, Auth, Storage, Edge Functions) with timeout→degraded semantics
- [ ] DATA-02: Payout history "initiated by" shows the actual admin's name (initiated_by_admin_id column + capture on hold/approve)
- [ ] DATA-03: Transactions payout column never shows amount when fee exists (display guard trainer_payout || amount - fee)
- [ ] DATA-04: Audit log actor column resolves UUIDs to profile names (fallback truncated UUID)
- [ ] DATA-05: Test accounts purged from live DB (Demo Trainer, QA Client, client.golive.0611, Derek Salem + dependent rows); pt.golive.0611 + real accounts preserved

## REL — Release & Verification (Phase 42)

- [ ] REL-01: Admin login redirects to /admin (not /trainers)
- [ ] REL-02: main pushed to origin; no unpushed commits
- [ ] REL-03: Cloudflare Pages (canonical) + Netlify both serve a bundle containing the pending-trainer fixes (reject_trainer canary string)
- [ ] REL-04: Live /admin loads with zero 4xx console errors; all 10 tabs render
- [ ] REL-05: .claude/CLAUDE.md documents pages.dev as canonical URL; Obsidian Phase Log entry written with evidence

---

*v6.1 — 18 requirements across 4 categories — defined 2026-06-11*
