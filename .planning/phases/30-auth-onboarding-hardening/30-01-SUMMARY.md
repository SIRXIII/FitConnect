---
phase: 30
plan: 01
subsystem: auth
tags: [auth, onboarding, protected-routes, password-reset]
dependency_graph:
  requires: []
  provides: [password-reset-flow, protected-route-redirect-preservation]
  affects: [Login, AuthCallback, ProtectedRoute, App]
tech_stack:
  added: []
  patterns: [supabase-recovery-type, url-redirect-preservation]
key_files:
  created:
    - Cenlar demand gt 1-17/src/pages/ResetPassword.tsx
  modified:
    - Cenlar demand gt 1-17/src/components/shared/ProtectedRoute.tsx
    - Cenlar demand gt 1-17/src/pages/AuthCallback.tsx
    - Cenlar demand gt 1-17/src/pages/Login.tsx
    - Cenlar demand gt 1-17/src/App.tsx
decisions:
  - Reset password flow routes through /auth/callback with type=recovery in hash, then redirects to dedicated /auth/reset-password page
  - ProtectedRoute uses useLocation to capture full path+search for redirect preservation
metrics:
  duration: 8m
  completed: "2026-03-20"
  tasks_completed: 5
  files_changed: 5
---

# Phase 30 Plan 01: Auth & Onboarding Hardening Summary

Auth flows hardened end-to-end: password reset with dedicated page, protected route destination preservation, and verification that all existing auth paths (sign-up, role selection, error handling) were already correct.

## Tasks

### Task 1 (AUTH-01): Email sign-up flow
No changes needed. `signUpWithEmail` already passes correct `emailRedirectTo` (`window.location.origin + '/auth/callback'`). Toast message already says "check your email to confirm." Working as intended.

### Task 2 (AUTH-02): Forgot password flow
**Fixes applied:**
- Created `/src/pages/ResetPassword.tsx` — form calling `supabase.auth.updateUser({ password })` with confirm-password validation
- Updated `AuthCallback.tsx` to detect `type=recovery` in the URL hash and redirect to `/auth/reset-password`
- Fixed `resetPasswordForEmail` redirect URL in `Login.tsx` from `/login` to `/auth/callback` (required for Supabase to include `type=recovery` in the hash)
- Added `/auth/reset-password` route to `App.tsx`

### Task 3 (AUTH-03): Role selection
No changes needed. `RoleSelect.tsx` calls `setRole(selected)` correctly, navigates to trainer or client onboarding, and handles referral attribution. Working as intended.

### Task 4 (AUTH-04): Auth error handling
No changes needed. `AuthCallback.tsx` already decodes and toasts errors from hash/query params. All auth calls in Login, RoleSelect use try/catch with toast.error. No raw JSON exposed.

### Task 5 (AUTH-05): Protected route redirects
**Fix applied:** Updated `ProtectedRoute.tsx` to capture `location.pathname + location.search` via `useLocation()` and pass it as `?redirect=` param when redirecting unauthenticated users to `/login`. Login already reads this param and navigates to the intended destination after successful sign-in.

## Deviations from Plan

None beyond scope — all changes were fixes for gaps identified in the plan's task descriptions.

## Self-Check: PASSED
