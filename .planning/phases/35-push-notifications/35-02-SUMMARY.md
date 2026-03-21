---
phase: 35-push-notifications
plan: 02
subsystem: ui
tags: [push-notifications, firebase, fcm, framer-motion, capacitor, settings, booking, cancellation]

requires:
  - phase: 35-push-notifications
    provides: send-push-notification edge function, push_subscriptions table, pushNotifications.ts

provides:
  - Push fires to trainer on new booking (create-payment-intent)
  - Push fires to trainer on client cancellation (cancel-booking)
  - NotificationPermissionPrompt component (custom modal, shows once)
  - Push toggle in NotificationPreferencesSection (client alerts tab)
  - NotificationSettings page with push toggle

affects:
  - any future edge function that needs to trigger push
  - trainer booking flow
  - client cancellation flow

tech-stack:
  added: []
  patterns:
    - Fire-and-forget push: fetch() with .catch(() => {}) — push failure never blocks main response
    - Permission prompt shows once via localStorage key push_prompt_shown
    - vite.config.ts rollupOptions.external for uninstalled optional packages

key-files:
  created:
    - src/components/NotificationPermissionPrompt.tsx
    - src/pages/NotificationSettings.tsx
  modified:
    - supabase/functions/create-payment-intent/index.ts
    - supabase/functions/cancel-booking/index.ts
    - src/components/client/NotificationPreferencesSection.tsx
    - src/pages/TrainerDashboard.tsx
    - src/pages/ClientDashboard.tsx
    - vite.config.ts

key-decisions:
  - "Push calls are fire-and-forget (.catch(() => {})) — push failure never blocks booking or cancel response"
  - "Permission prompt uses localStorage (push_prompt_shown) to show exactly once per browser"
  - "firebase/* and @capacitor/push-notifications marked as Rollup external — build passes without npm install"

patterns-established:
  - "Pattern: optional NPM dependency — add to package.json + rollupOptions.external until installed"

requirements-completed:
  - PUSH-03
  - PUSH-04
  - PUSH-05

duration: 22min
completed: 2026-03-20
---

# Phase 35 Plan 02: Push Notifications Triggers Summary

**Push notifications wired into booking/cancellation flows with custom permission modal and per-device toggle in notification settings**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Trainer receives push when client books (create-payment-intent) or cancels (cancel-booking)
- NotificationPermissionPrompt shows once per browser, gold CTA, Framer Motion fade
- Push toggle in client alerts tab and new NotificationSettings page
- Build verified: npx vite build succeeds (2181 modules, 2.09s)

## Task Commits

1. **Task 1: Wire push triggers** - `001b39b` (feat)
2. **Task 2: Permission prompt + settings toggle** - `943d853` (feat)

## Deviations from Plan

**1. [Rule 3 - Blocking] Added rollupOptions.external for uninstalled firebase packages**
- Build failed — firebase not in node_modules (disk full). Added external config to vite.config.ts.
- Remove once npm install succeeds.

## Issues Encountered

- cancel-booking query needed expansion to include trainer_profiles.user_id for push targeting
- push_subscriptions not in generated Supabase types — used `supabase as any` cast
- Pre-existing google namespace errors in NotificationPreferencesSection (not caused by this phase)

## Next Phase Readiness

- Phase 35 complete. Run `npm install` to get firebase bundled, then configure Firebase env vars.

---
*Phase: 35-push-notifications*
*Completed: 2026-03-20*
