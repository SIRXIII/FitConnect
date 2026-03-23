# FitRush Project — Claude Context

## App Identity
- **App Name:** FitRush (originally FitConnect — repo/folder still named FitConnect)
- **Live URL:** https://fitrush-app.netlify.app
- **GitHub:** https://github.com/SIRXIII/FitConnect
- **Supabase Project:** qecwxvvlpvrnrqyrdxrj

## Tech Stack
- **Frontend:** React 19 + TypeScript, Vite 6, Tailwind CSS, Zustand, Framer Motion, Recharts
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions on Deno)
- **Payments:** Stripe Connect (trainer payouts) + Stripe Billing (subscriptions)
- **Mobile:** Capacitor 8 (iOS)
- **Hosting:** Netlify (frontend), Supabase (backend + edge functions)
- **Email:** Resend.com (transactional — from noreply@resend.dev)
- **Testing:** Vitest

## Key Supabase Tables
- `profiles`, `trainer_profiles`, `client_profiles`
- `bookings`, `availability_slots`
- `reviews`, `notifications`
- `subscription_events`

## Edge Functions (14 total)
- `create-payment-intent`, `stripe-webhook`, `stripe-billing-webhook`
- `create-connect-account`, `create-setup-intent`
- `create-payout`, `weekly-payouts`
- `create-subscription`, `manage-subscription`
- `cancel-booking`
- `process-referral-reward`
- `send-notification-email`
- `export-user-data`

## Development Workflow
- Uses **/gsd** (Get Shit Done) Claude Code workflow for structured, phase-based development
- Planning docs in `.planning/` directory
- 20+ phases completed, tracked in `.planning/`
- Git tags: v2.0, v2.1, v3.0

## Important Context
- Stripe destination charge flow: app takes application fee, remainder transfers to trainer's connected account
- Referral rewards: $10 payout credit to referring trainer, $5 discount to referred client
- Cancellation policy: 24-hour window enforced in `cancel-booking` edge function
- Weekly auto-payouts triggered via pg_cron for trainers with ≥$50 balance
- GDPR data export available via `export-user-data` edge function

## Writing Rules
- **NO em-dashes** (the long dash character). Use commas, periods, or rewrite the sentence instead.

## Notes for Claude
- Always check `.planning/` for phase context before starting new work
- Prefer minimal, focused changes, don't refactor broadly unless asked
- Run `npm run dev` to start local dev server (Vite on default port)
- Run `supabase functions serve` to test edge functions locally
