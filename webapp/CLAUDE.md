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
- Mobile repo (`/Volumes/Crucial X9/Developer/FitRush-Flutter`) owns the money-path slugs:
  `create-payment-intent`, `stripe-webhook`, `create-connect-account`, `create-payout`,
  `weekly-payouts`, `cancel-booking`, `complete-booking`.
- This repo owns webapp-only slugs (e.g. `create-payment-intent-web`, `nominate-trainer`).
  The webapp's booking flow calls `create-payment-intent-web` (booking-first contract).
- All charges are Model B platform-only (escrow → weekly/admin payout). Never add
  `transfer_data` / `application_fee_amount` to a booking PaymentIntent.
- Copies of mobile-owned functions were deleted from this repo on 2026-08-18 so a bulk
  deploy can't clobber them again. Remaining duplicated slugs (`create-payout`,
  `weekly-payouts`, `cancel-booking`, `complete-booking`, others) still need diff/cleanup.
