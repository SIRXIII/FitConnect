# Phase 16.1: QA Hotfix — Route Guards, 404, Mobile Contrast

**Type:** Decimal phase (hotfix between v2.1 and v3.0)
**Trigger:** Browser QA testing via Playwright revealed 5 issues

## Issues Found & Fixed

### Priority 1 — Fixed
1. **Protected routes show blank pages** — `/dashboard`, `/role-select`, `/onboarding`, `/signup` showed only footer when unauthenticated. Added `<Navigate to="/login">` redirects for legacy routes and wrapped onboarding routes with `ProtectedRoute skipRoleCheck`.
2. **No 404 page** — Invalid routes showed blank content. Created `NotFound.tsx` with catch-all `<Route path="*">`.
3. **Mobile hero nearly invisible** — Thin serif font (weight 300) at 6xl was too faint on mobile. Changed to `font-normal md:font-light` and `text-5xl md:text-8xl`. Bumped subtitle opacity from 60% to 80% on mobile.

### Priority 2 — Fixed
4. **Referral leaderboard 404 console error** — `get_referral_leaderboard` RPC doesn't exist. Added try/catch + error check so it silently skips.
5. **Footer dead links** — All footer links pointed to `#`. Updated to use React Router `<Link>` components pointing to real pages (`/#search`, `/#how-it-works`, `/#safety`, `/pricing`, `/login`). Privacy/Terms/Cookies changed to static text (no pages yet).

### Deferred
- Social media links (Instagram, Twitter, LinkedIn) — user will provide URLs later
- `trainer_profiles` 400 error — schema-level issue, will be addressed in v3.0 security phase
- `availability_slots` 400 error — same root cause

## Files Changed
- `src/pages/NotFound.tsx` — NEW: 404 page matching FitRush design language
- `src/App.tsx` — Added NotFound import, Navigate import, catch-all route, legacy redirects, protected onboarding routes
- `src/components/shared/ProtectedRoute.tsx` — Added `skipRoleCheck` prop for onboarding routes
- `src/components/landing/Hero.tsx` — Mobile font weight/size/opacity fixes
- `src/components/landing/ReferralLeaderboard.tsx` — Error handling for missing RPC
- `src/components/layout/Footer.tsx` — React Router Links, aria-labels, static Privacy/Terms
