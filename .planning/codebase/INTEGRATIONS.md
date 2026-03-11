# External Integrations

**Analysis Date:** 2026-03-11

## APIs & External Services

**Authentication & User Management:**
- Supabase Auth - OAuth provider authentication
  - Supported providers: Google, Facebook, Apple
  - SDK: `@supabase/supabase-js`
  - Implementation: `src/stores/auth.ts` (signInWithProvider method)
  - Session management: Auto-refresh, persist session, detect session in URL

**Payment Processing:**
- Stripe - Payment processing for trainer bookings
  - SDK: `@stripe/stripe-js` (client)
  - React integration: `@stripe/react-stripe-js`
  - Publishable key: `VITE_STRIPE_PUBLISHABLE_KEY` (env var)
  - Payment flow: `src/pages/BookSession.tsx` (PaymentForm component)
  - Stripe account IDs: Stored in `trainer_profiles.stripe_account_id`
  - Payment intent creation: Via Supabase Edge Function at `{VITE_SUPABASE_URL}/functions/v1/create-payment-intent`

**AI/ML Services (Planned):**
- Google Gemini API - For AI features (configured in Vite)
  - Key: `GEMINI_API_KEY` (exposed via Vite define in vite.config.ts)
  - Status: Integrated in config but not actively used in codebase

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Connection: Managed via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  - Client: `@supabase/supabase-js` (built-in SQL client)

**Database Tables & Relationships:**
- `profiles` - User profile data
  - Columns: id, role, full_name, avatar_url, phone, created_at, updated_at
  - Relationship: One-to-many with trainer_profiles

- `trainer_profiles` - Trainer-specific data
  - Columns: id, user_id, specialty, bio, hourly_rate, optimized_rate, location, latitude, longitude, certifications (array), verified, rating, review_count, stripe_account_id, created_at, updated_at
  - Foreign key: user_id → profiles.id
  - Relationship: One-to-many with availability_slots

- `availability_slots` - Trainer availability for booking
  - Columns: id, trainer_id, start_time, end_time, is_booked, created_at
  - Foreign key: trainer_id → trainer_profiles.id
  - Relationship: One-to-many with bookings

- `bookings` - Client-trainer session bookings
  - Columns: id, client_id, trainer_id, slot_id, status, rate_charged, platform_fee, trainer_payout, notes, created_at, cancellation_reason, cancelled_by
  - Foreign keys: client_id → profiles.id, trainer_id → trainer_profiles.id, slot_id → availability_slots.id
  - Relationship: One-to-many with reviews

- `reviews` - Client reviews of completed sessions
  - Columns: id, booking_id, client_id, trainer_id, rating, comment
  - Foreign keys: booking_id → bookings.id, client_id → profiles.id, trainer_id → trainer_profiles.id

- `notifications` - User notifications (realtime via PostgREST)
  - Columns: id, user_id, type, title, message, link, read, created_at
  - Foreign key: user_id → profiles.id
  - Realtime subscription in `src/hooks/useNotifications.ts`

**File Storage:**
- Supabase Storage (implied) - User avatars and images
  - Avatar URLs stored in: `profiles.avatar_url`, `trainer_profiles.avatar_url`
  - External image URLs from: Unsplash (mock trainer images in `src/lib/constants.ts`)

**Caching:**
- None detected - Real-time data fetched from Supabase on demand

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (OAuth)
- Implementation: `src/stores/auth.ts` (useAuthStore)

**Authentication Flow:**
1. User initiates OAuth sign-in via `signInWithProvider('google'|'facebook'|'apple')`
2. Redirects to OAuth provider, then returns to `/auth/callback`
3. `src/pages/AuthCallback.tsx` handles callback and session establishment
4. Session stored with auto-refresh enabled
5. User role selected at `/onboarding/role` (RoleSelect page)

**Session Management:**
- Zustand store maintains: user, session, profile, trainerProfile
- Auto-initialization on app load via `useAuthStore.initialize()`
- Real-time auth state changes tracked via `supabase.auth.onAuthStateChange()`

**Protected Routes:**
- `src/components/shared/ProtectedRoute.tsx` - Enforces role-based access
- Supports requiredRole prop: 'trainer' or 'client'

## Monitoring & Observability

**Error Tracking:**
- Not detected - Errors logged to console

**Logs:**
- Console logging in error scenarios (e.g., payment failures in BookSession.tsx)
- Firebase integration mentioned in docs but not implemented

## CI/CD & Deployment

**Hosting:**
- Supabase (backend/database)
- Stripe (payment infrastructure)
- Frontend: Compatible with static hosting (Vercel, Netlify, etc.)

**CI Pipeline:**
- Not detected - Manual npm build/deploy

**Build Process:**
- Vite builds to `dist/` directory
- Environment variables required at build time for Supabase URL/keys and Stripe key

## Environment Configuration

**Required Environment Variables (`.env.local`):**

| Variable | Purpose | Required | Source |
|----------|---------|----------|--------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes | Supabase dashboard |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous API key | Yes | Supabase dashboard |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | No* | Stripe dashboard |
| `GEMINI_API_KEY` | Google Gemini API key | No | Google Cloud Console |

*Stripe is optional: If not configured, payment is skipped and bookings created as pending

**Environment Access:**
- Loaded via Vite's `loadEnv()` in `vite.config.ts`
- Supabase env vars accessed in `src/lib/supabase.ts`
- Stripe key accessed in `src/lib/stripe.ts`
- Gemini key exposed via Vite define (not actively used)

**Secrets Location:**
- `.env.local` file (git-ignored)
- Supabase dashboard and Stripe dashboard for sensitive keys
- Never commit secrets to version control

## Webhooks & Callbacks

**Incoming:**
- OAuth callback: `/auth/callback` - Handles Supabase auth redirects
  - Implementation: `src/pages/AuthCallback.tsx`
  - Detects session in URL and initializes auth store

- Stripe webhooks: Expected at Supabase Edge Function (not fully visible)
  - Endpoint: `{VITE_SUPABASE_URL}/functions/v1/create-payment-intent`
  - Purpose: Create payment intent for bookings

**Outgoing:**
- Stripe Payment Intent confirmations
  - Initiated from `src/pages/BookSession.tsx`
  - Confirmation URL: `{window.location.origin}/client/bookings`
  - Redirect: 'if_required' (only if 3D Secure or additional auth needed)

**Realtime Subscriptions:**
- Supabase PostgREST realtime for notifications
  - Subscription: `src/hooks/useNotifications.ts`
  - Channel: 'notifications' table with filter on user_id
  - Events: INSERT events trigger unread notification counts
  - Auto-unsubscribe on component unmount

## Data Sync & Consistency

**Database Queries:**
- All data operations use `@supabase/supabase-js` query builder
- Examples:
  - Trainer search: `useTrainers()` hook in `src/hooks/useTrainers.ts`
  - Availability slots: `useAvailability()` hook in `src/hooks/useAvailability.ts`
  - Bookings: `MyBookings.tsx` loads via `.select()` with joins

**Query Patterns:**
- Joined queries with foreign key relationships (e.g., trainer + profile + avatar)
- Filtering: `.eq()`, `.gte()`, `.lte()`, `.ilike()` operators
- Ordering: `.order()` with ascending/descending
- Pagination: `.limit()` for notifications

**Conflict Resolution:**
- Row-level security (RLS) assumed to be configured in Supabase
- Optimistic updates not implemented (data refetched after mutations)

---

*Integration audit: 2026-03-11*
