# FitRush Webapp (fitrush.io) — Project Instructions

## Deploy target (MANDATORY)
Production = **Cloudflare Pages project `fitconnect`** (fitrush.io / www / app), auto-deploys on push to `main`.
The Netlify site `fitrush-app` has NO custom domain — a green Netlify build proves nothing. Verify prod by bundle hash per `~/Documents/Obsidian Vault/Projects/FitRush/Deploy Targets & Production Verification.md`.

## Supabase Edge Function ownership (MANDATORY — incident 2026-08-17)
The Supabase project is SHARED with the FitRush Flutter mobile app. On 2026-08-17 a bulk
`supabase functions deploy` from this repo overwrote `create-payment-intent`,
`stripe-webhook`, and `create-connect-account` with stale copies — breaking booking in the
shipped App Store build and re-introducing a destination-charge double-pay bug that the
Model B cutover had removed.

Rules:
- **NEVER run `supabase functions deploy` without an explicit slug from this repo.**
- Mobile repo (`/Volumes/Crucial X9/Developer/FitRush-Flutter`) owns the money-path and
  shared-service slugs: `create-payment-intent`, `stripe-webhook`, `create-connect-account`,
  `create-payout`, `weekly-payouts`, `cancel-booking`, `complete-booking`,
  `manage-subscription`, `notify-admin-signup`, `send-push-notification`.
- This repo owns webapp-only slugs (e.g. `create-payment-intent-web`, `nominate-trainer`).
  The webapp's booking flow calls `create-payment-intent-web` (booking-first contract).
- All charges are Model B platform-only (escrow → weekly/admin payout). Never add
  `transfer_data` / `application_fee_amount` to a booking PaymentIntent.
- Cleanup COMPLETE 2026-08-19: this repo tracks NO mobile-owned slugs anymore (last
  duplicated copies deleted after diffing webapp vs live vs mobile; canonical sources,
  including the unreleased create-payout integrity gate + `payoutValidation.ts`, moved
  to the mobile repo). Every remaining fn dir here was verified equal to or ahead of its
  live deploy, except: `create-subscription` and `send-notification-email` were synced
  FROM live (repo copies were stale — live has the working hardcoded PRICE_MAP and the
  service-role auth path respectively). `delete-account` could not be diffed (Supabase
  returns 500 on its bundle download); treat live as canonical until re-deployed.

## Error digest / user problem reports
Weekly error digest push or any user-reported problem: run /fitrush-triage (user-global skill at ~/.claude/skills/fitrush-triage/SKILL.md; protocol table in Obsidian "Projects/FitRush/Notification Playbook.md").
