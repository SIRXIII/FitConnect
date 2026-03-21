---
phase: 35-push-notifications
plan: 01
subsystem: infra
tags: [firebase, fcm, push-notifications, service-worker, capacitor, ios, supabase, edge-function]

requires:
  - phase: 34-capacitor-ios-build
    provides: Capacitor 8 integrated, iOS build pipeline in place

provides:
  - push_subscriptions DB table with RLS
  - FCM service worker at /firebase-messaging-sw.js
  - send-push-notification edge function (web + iOS delivery via Firebase Admin SDK)
  - pushNotifications.ts client lib (subscribeToPush, unsubscribeFromPush, getIOSDeviceToken)

affects:
  - 35-02-push-notifications-triggers
  - any future phase that needs to deliver a push

tech-stack:
  added:
    - firebase ^10.7.1 (web FCM client, dynamic import)
    - "@capacitor/push-notifications ^8.0.1 (iOS APNs token registration)"
    - firebase-admin (npm: specifier, Deno edge function)
  patterns:
    - Firebase config passed to SW via postMessage (not hardcoded in SW file)
    - Dynamic import of firebase/* prevents bundle failure when env vars absent
    - Stale FCM token cleanup on messaging/registration-token-not-registered error
    - Type stubs in src/types/ for packages that require runtime install

key-files:
  created:
    - supabase/migrations/20260320_push_subscriptions.sql
    - public/firebase-messaging-sw.js
    - supabase/functions/send-push-notification/index.ts
    - src/lib/pushNotifications.ts
    - src/types/firebase.d.ts
    - src/types/capacitor-push.d.ts
  modified:
    - package.json

key-decisions:
  - "Firebase config injected into SW via postMessage on registration (avoids hardcoding public keys in SW file)"
  - "firebase/* dynamically imported so app runs without Firebase configured (graceful degradation)"
  - "Type stubs created for firebase and @capacitor/push-notifications since npm install not possible (disk full)"
  - "push_subscriptions.endpoint stores FCM token for both web and iOS (device_token mirrors it for clarity)"

patterns-established:
  - "Pattern: dynamic import for optional cloud SDK — import only when env vars confirmed present"
  - "Pattern: SW config via postMessage — main thread sends FIREBASE_CONFIG message after SW registration"

requirements-completed:
  - PUSH-01
  - PUSH-02

duration: 18min
completed: 2026-03-20
---

# Phase 35 Plan 01: Push Notifications Infrastructure Summary

**FCM service worker + push_subscriptions table + Firebase Admin edge function delivering web and iOS push via unified send-push-notification endpoint**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-03-20T00:00:00Z
- **Completed:** 2026-03-20T00:18:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `push_subscriptions` table with RLS: users manage their own subscriptions; service role can read all for sending
- FCM service worker at `/firebase-messaging-sw.js` with background message handling and notification click routing
- `send-push-notification` edge function using Firebase Admin SDK — handles both web FCM and iOS APNs (Firebase routes), with automatic stale token cleanup
- `pushNotifications.ts` client lib with graceful degradation when Firebase env vars are absent

## Task Commits

1. **Task 1: DB migration + service worker** - `57d3dbe` (feat)
2. **Task 2: Edge function + pushNotifications client lib** - `6189ad7` (feat)

## Files Created/Modified

- `supabase/migrations/20260320_push_subscriptions.sql` - push_subscriptions table + RLS policies
- `public/firebase-messaging-sw.js` - FCM service worker, postMessage config pattern, notification click handler
- `supabase/functions/send-push-notification/index.ts` - Firebase Admin delivery for web + iOS, stale token cleanup
- `src/lib/pushNotifications.ts` - subscribeToPush, unsubscribeFromPush, getIOSDeviceToken
- `src/types/firebase.d.ts` - Type stubs for firebase/app and firebase/messaging
- `src/types/capacitor-push.d.ts` - Type stubs for @capacitor/push-notifications
- `package.json` - Added firebase and @capacitor/push-notifications dependencies

## Decisions Made

- Firebase config injected into SW via `postMessage` from the main app thread on registration, not hardcoded in the SW file. This keeps secrets out of the service worker and allows env vars to control the config.
- All Firebase imports are dynamic (`await import('firebase/app')`) and guarded by `hasFirebaseConfig()`. The app remains fully functional without Firebase credentials — push simply no-ops with a console.warn.
- Type declaration stubs added to `src/types/` because `npm install` failed due to disk space. The stubs are minimal but accurate for the call patterns used. They will be superseded by real package types once installed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added TypeScript type stubs for uninstallable packages**
- **Found during:** Task 2
- **Issue:** `firebase` and `@capacitor/push-notifications` could not be installed (disk full). TypeScript would error on `import('firebase/app')` etc.
- **Fix:** Created `src/types/firebase.d.ts` and `src/types/capacitor-push.d.ts` with accurate minimal stubs
- **Files modified:** src/types/firebase.d.ts, src/types/capacitor-push.d.ts
- **Verification:** TypeScript can resolve types for dynamic imports
- **Committed in:** 6189ad7

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock TypeScript compilation without disk space. Real packages should be installed when space is available (`npm install`).

## Issues Encountered

- Disk space exhausted — `npm install` failed for `firebase` and `@capacitor/push-notifications`. Worked around with type stubs in `src/types/`. User should run `npm install` in the project directory when disk space is freed.

## User Setup Required

Firebase requires manual configuration before push notifications will work:

1. Create a Firebase project at console.firebase.google.com
2. Enable Cloud Messaging API in Project Settings > Cloud Messaging
3. Generate VAPID key pair (Web Push certificates) in Project Settings > Cloud Messaging > Web configuration
4. Generate service account private key in Project Settings > Service Accounts > Generate new private key
5. Add to `.env.local`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_VAPID_KEY`
6. Add to Supabase secrets (`supabase secrets set`):
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
7. For iOS: Upload APNs Auth Key (.p8) to Firebase Console > Project Settings > Cloud Messaging > Apple app configuration

## Next Phase Readiness

- Plan 35-02 can proceed — all infrastructure contracts (send-push-notification endpoint, pushNotifications.ts exports) are in place
- Firebase env vars not yet configured — pushes will no-op gracefully until configured

---
*Phase: 35-push-notifications*
*Completed: 2026-03-20*
