# FitConnect (Web MVP)

Luxury fitness marketplace MVP with trainer/client roles, OAuth auth, availability publishing, booking flow, reviews, notifications, and Stripe Connect payments.

## Canonical App Boundary

- Active app code lives in `src/`.
- Vite entrypoint is `src/main.tsx`.
- Root-level legacy files (`App.tsx`, `index.tsx`, `types.ts`, `constants.ts`, `components/`) are historical and not part of the active build.

## Local Development

Prerequisites:

- Node.js 20+
- npm
- A Supabase project
- Stripe account (test mode is fine)

Install + run:

```bash
npm install
npm run dev
```

Type-check:

```bash
npm run lint
```

## Environment Variables

Create `.env.local`:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_STRIPE_PUBLISHABLE_KEY=<stripe-publishable-key>
GEMINI_API_KEY=<optional>
```

## Supabase Backend (Current-Schema Track)

Schema + RLS source of truth:

- `supabase/migrations/20260311143000_fitconnect_current_schema.sql`

This migration provisions:

- `profiles`, `trainer_profiles`, `availability_slots`, `bookings`, `reviews`, `notifications`, `payments`
- Auth signup profile trigger
- Booking safety triggers (slot lock, active booking uniqueness, cancellation slot reopen)
- Booking transition validation
- Review rating aggregation
- RLS policies per table

## Supabase Edge Functions

Implemented:

- `create-connect-account` (Stripe Connect onboarding link generation)
- `create-payment-intent` (booking ownership checks + destination charge intent)
- `stripe-webhook` (payment reconciliation into `payments` and `bookings`)

Required function secrets:

```bash
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```
