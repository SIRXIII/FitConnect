# Phase 35 Context — Push Notifications

**Phase:** 35
**Milestone:** v6.0 Growth Engine
**Status:** Ready to plan

## Goal

Trainers get instant push notifications when someone books, cancels, or messages. Clients get booking confirmations and trainer-live alerts on their phone. Works on both web (FCM) and iOS (APNs via Capacitor).

## Requirements

- PUSH-01: Firebase Cloud Messaging (FCM) for web push
- PUSH-02: Capacitor Push Notifications plugin for iOS (APNs)
- PUSH-03: Permission prompt on first dashboard visit
- PUSH-04: Push triggers: new booking, cancellation, new message, trainer goes live nearby
- PUSH-05: User toggle for push on/off from notification settings

## Success Criteria

1. Trainer receives a push notification on their phone when a client books a session
2. Client receives push when booking is confirmed or a nearby trainer goes live
3. Push works on both web (FCM) and iOS (APNs via Capacitor)
4. User can enable/disable push from settings

## Technical Context

### Current Notification Infrastructure
- `notifications` table already exists (in-app notifications via Supabase Realtime)
- `send-notification-email` edge function sends email notifications via Resend
- `client_notification_preferences` table stores notification settings (created Phase 27)
- Location trigger in `pg_triggers` fires on trainer availability change
- Capacitor 8 already integrated (Phase 34)

### New Infrastructure Needed

**Web Push (FCM):**
- Firebase project with FCM enabled — VAPID public key for subscription
- `push_subscriptions` table: `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `platform` ('web'|'ios'), `created_at`
- Service worker `public/firebase-messaging-sw.js` — handles background push events
- `send-push-notification` edge function — calls FCM API, handles both web and APNs via Firebase Admin SDK

**iOS Push (APNs via Capacitor):**
- `@capacitor/push-notifications` plugin already available in Capacitor ecosystem
- Device token registered via Capacitor listener, stored in `push_subscriptions` with `platform='ios'`
- APNs certificate configured in Firebase Console (Firebase routes APNs for iOS)

### Trigger Points
Push notifications fire from edge functions already handling these events:
- `create-payment-intent` (on booking creation) — send to trainer
- `cancel-booking` — send to trainer + client
- In-app messaging (Phase 6) — send to message recipient
- Location notification trigger (Phase 27) — extend to push

### Key Decisions
- Use Firebase Admin SDK in edge function (Deno-compatible via CDN import) to unify web + iOS delivery
- Store push subscriptions in `push_subscriptions` table (not `client_notification_preferences` — different concern)
- Service worker lives at `/firebase-messaging-sw.js` (root path required by FCM spec)
- Permission prompt: check `Notification.permission` on dashboard mount, show custom modal before calling `requestPermission()` (better UX than raw browser prompt)

## Constraints

- Firebase free tier (Spark): unlimited FCM messages — no cost concern
- APNs requires Apple Developer account with push capability (user must configure)
- Deno edge function imports Firebase Admin SDK from `npm:firebase-admin` or CDN

## User Setup Required

- Create Firebase project, enable FCM, get VAPID key pair
- Add `FIREBASE_SERVER_KEY` / `FIREBASE_PROJECT_ID` / `FIREBASE_PRIVATE_KEY` to Supabase secrets
- For iOS: Upload APNs auth key (.p8) to Firebase Console
- For iOS: Add `NSUserNotificationsUsageDescription` to iOS Info.plist
