---
phase: 11-referral-program-v1
plan: "03"
subsystem: referral-ui
tags: [referral, ui, cookie-attribution, notifications]
dependency_graph:
  requires: [11-01]
  provides: [referral-widget, landing-cookie-capture, roleselect-attribution, attribution-notification]
  affects: [TrainerDashboard, ClientDashboard, Landing, RoleSelect]
tech_stack:
  added: []
  patterns: [cookie-capture-useEffect, silent-try-catch-attribution, null-guard-conditional-render]
key_files:
  created:
    - Cenlar demand gt 1-17/src/components/shared/ReferralWidget.tsx
  modified:
    - Cenlar demand gt 1-17/src/pages/Landing.tsx
    - Cenlar demand gt 1-17/src/pages/RoleSelect.tsx
    - Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx
    - Cenlar demand gt 1-17/src/pages/ClientDashboard.tsx
decisions:
  - "ReferralWidget placed at bottom of TrainerDashboard overview and ClientDashboard — non-disruptive placement after existing content"
  - "Attribution block in single try/catch wrapping both referrals.insert and notifications.insert — either succeeds together or fails silently"
  - "profile.role guard (null check) ensures attribution only fires on first role selection, not on repeat visits"
metrics:
  duration: "2m"
  completed: "2026-03-15"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 11 Plan 03: Referral UI + Attribution Flow Summary

**One-liner:** Referral widget with copy-to-clipboard, Landing ?ref= cookie capture, and RoleSelect attribution inserting referrals row + immediate referrer notification.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ReferralWidget + Landing cookie capture | 933c663 | ReferralWidget.tsx (new), Landing.tsx |
| 2 | RoleSelect attribution + dashboard integrations | cad3b78 | RoleSelect.tsx, TrainerDashboard.tsx, ClientDashboard.tsx |

## What Was Built

**ReferralWidget** (`src/components/shared/ReferralWidget.tsx`): Reusable component accepting `referralCode: string`. Renders the code in large serif uppercase, the full shareable link via `buildReferralLink()`, and a copy button that fires `toast.success('Referral link copied!')` via sonner. Copy/Check icon toggle with 2-second reset.

**Landing.tsx**: Added `useEffect` on mount that reads `searchParams.get('ref')` and calls `captureReferralCode(refCode)`. Uses `useSearchParams` from react-router-dom. Cookie is SameSite=Lax, 30-day expiry (handled inside referral.ts from Plan 01).

**RoleSelect.tsx attribution block**: After `await setRole(selected)` succeeds, guards on `!profile?.role` (new user only). Reads referral cookie, looks up referrer by `referral_code`, inserts into `public.referrals` with `status: 'pending'`, clears the cookie, then immediately inserts a `type: 'referral_new'` notification to the referrer. Entire block in a single `try/catch` — logs to console, never blocks role selection.

**TrainerDashboard.tsx**: Imported `ReferralWidget`, added `{profile?.referral_code && <ReferralWidget referralCode={profile.referral_code} />}` at the end of the overview tab section.

**ClientDashboard.tsx**: Same pattern — `ReferralWidget` imported and rendered after the Quick Actions grid, behind the `profile?.referral_code` null guard.

## Verification Results

- Build: green (`✓ built in 2.45s`, chunk size warning only — pre-existing)
- `ReferralWidget` exports default, `referralCode: string` prop
- `Landing.tsx` calls `captureReferralCode` in useEffect
- `RoleSelect.tsx` calls `readReferralCode()` + `supabase.from('referrals').insert()` + `supabase.from('notifications').insert()` with `type: 'referral_new'`
- Both dashboards render `<ReferralWidget referralCode={profile.referral_code} />`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `Cenlar demand gt 1-17/src/components/shared/ReferralWidget.tsx`: FOUND
- `Cenlar demand gt 1-17/src/pages/Landing.tsx`: FOUND (modified)
- `Cenlar demand gt 1-17/src/pages/RoleSelect.tsx`: FOUND (modified)
- `Cenlar demand gt 1-17/src/pages/TrainerDashboard.tsx`: FOUND (modified)
- `Cenlar demand gt 1-17/src/pages/ClientDashboard.tsx`: FOUND (modified)
- Commit 933c663: FOUND
- Commit cad3b78: FOUND
