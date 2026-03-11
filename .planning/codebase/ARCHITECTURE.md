# Architecture

**Analysis Date:** 2026-03-11

## Pattern Overview

**Overall:** Client-server SPA with role-based access control (RBAC), Supabase backend, and multi-step booking workflow.

**Key Characteristics:**
- Single-page application (React + React Router) with client-side routing
- Zustand for client-side state management (authentication, user profiles)
- Supabase as backend-as-a-service (auth, database, real-time subscriptions)
- Two primary user roles with separate dashboards: `trainer` and `client`
- Stripe integration for payment processing (optional/conditional)
- Real-time notifications via Supabase and notifications hook

## Layers

**Presentation (UI Components):**
- Purpose: Render UI and handle user interactions
- Location: `src/components/`, `src/pages/`
- Contains: Page components, layout wrappers, search/booking flows, dashboard cards
- Depends on: Hooks, stores, types, icons (lucide-react), animations (framer-motion)
- Used by: React Router in `src/App.tsx`

**State Management:**
- Purpose: Manage authentication state, user profiles, and real-time notifications
- Location: `src/stores/auth.ts`, `src/hooks/useNotifications.ts`
- Contains: Zustand store for auth/profiles, custom hooks for data fetching
- Depends on: Supabase client, React hooks
- Used by: All authenticated pages and protected routes

**Data Access & API Integration:**
- Purpose: Query/mutate Supabase database and call Edge Functions
- Location: `src/hooks/` (useTrainers, useAvailability), `src/lib/supabase.ts`
- Contains: Supabase client initialization, custom hooks for CRUD operations
- Depends on: Supabase JS SDK, React hooks
- Used by: Pages and components that need dynamic data

**Routing & Security:**
- Purpose: Client-side navigation and role-based access control
- Location: `src/App.tsx`, `src/components/shared/ProtectedRoute.tsx`
- Contains: React Router route definitions, protected route wrapper
- Depends on: React Router, auth store
- Used by: App initialization

**UI Constants & Type Definitions:**
- Purpose: Centralized definitions for specialties, mock data, interfaces
- Location: `src/types/index.ts`, `src/lib/constants.ts`
- Contains: Type interfaces, enums, mock trainer data, specialty labels
- Depends on: None (dependency only)
- Used by: Components, hooks, stores

## Data Flow

**Authentication Flow:**

1. User visits `/` (Landing page)
2. `src/App.tsx` initializes auth store → `useAuthStore.initialize()` checks Supabase session
3. If user exists, `fetchProfile()` loads profile and optional trainer profile from DB
4. Real-time listener established via `supabase.auth.onAuthStateChange()`
5. On OAuth redirect (`/auth/callback`), session is extracted and auth state updated
6. Protected routes check `user`, `profile.role`, and required role → redirect if not authorized

**Trainer Discovery & Booking Flow:**

1. Client browses `/trainers` → `SearchSection` component
2. `useTrainers()` hook queries `trainer_profiles` table with optional filters (specialty, rate, location)
3. Results displayed via `TrainerCard` components
4. Client clicks trainer → `/trainers/:id` loads `TrainerProfile` page
5. Client selects available time slot (from `availability_slots` table)
6. Navigates to `/book/:slotId` → `BookSession` page
7. Steps: Review → Confirm → Payment (if Stripe configured)
8. On confirm, booking created in `bookings` table with `pending` status
9. If Stripe enabled, calls Edge Function `/functions/v1/create-payment-intent`
10. After payment succeeds (or skipped), booking transitions to final state
11. Trainer notified via `notifications` table update

**Trainer Management Flow:**

1. Trainer accesses `/trainer/dashboard`
2. Stats loaded: upcoming bookings count, available/booked slots from `availability_slots`
3. Stripe Connect optional: `handleStripeConnect()` calls Edge Function to generate onboarding link
4. Trainer can manage availability via `AvailabilityManager` component
5. `useAvailability()` hook provides CRUD for `availability_slots` table
6. Single slot or bulk weekly slots can be added/removed

**Client Booking History Flow:**

1. Client visits `/client/bookings`
2. `MyBookings` queries `bookings` table with nested relations to `availability_slots` and `trainer_profiles`
3. Bookings filtered into "upcoming" (future, status pending/confirmed) and "past" (completed/cancelled/no_show)
4. Actions available: Cancel (if >24h before), Leave Review (if completed and not yet reviewed)
5. Review creates record in `reviews` table with trainer_id, client_id, rating, comment

**Real-Time Notifications:**

- `useNotifications()` hook subscribes to user's `notifications` table via Supabase realtime
- Notifications include: `title`, `message`, `link`, `created_at`, `read` status
- Bell icon in navbar shows unread count
- Clicking notification marks as read and optionally navigates to linked page

## Key Abstractions

**ProtectedRoute:**
- Purpose: Enforce authentication and role-based access
- Examples: `src/components/shared/ProtectedRoute.tsx`
- Pattern: Higher-order component wrapper that checks `user`, `profile.role`, and optional `requiredRole` prop; redirects to `/login` or `/onboarding/role` if conditions unmet

**Auth Store (Zustand):**
- Purpose: Single source of truth for authenticated user state
- Examples: `src/stores/auth.ts`
- Pattern: Zustand store with actions for `initialize()`, `fetchProfile()`, `signInWithProvider()`, `signOut()`, `setRole()`, `updateProfile()`. Lazy initialization (only once per app lifetime).

**Custom Hooks for Data Fetching:**
- Purpose: Encapsulate Supabase queries and state management
- Examples: `src/hooks/useTrainers.ts`, `src/hooks/useAvailability.ts`, `src/hooks/useNotifications.ts`
- Pattern: React hooks returning `{ data, loading, error, refetch/mutation functions }`. Use `useCallback` for stable mutation functions.

**Trainer-to-Card Adapter:**
- Purpose: Transform Supabase trainer_profiles query result into UI component props
- Examples: `dbTrainerToCardData()` in `src/components/search/SearchSection.tsx`
- Pattern: Pure function mapping database schema to application type; handles null/undefined fields with sensible defaults

## Entry Points

**App Root:**
- Location: `src/main.tsx`
- Triggers: Application startup
- Responsibilities: Mount React app to DOM root element

**App Component:**
- Location: `src/App.tsx`
- Triggers: After React mounts
- Responsibilities: Initialize auth store, define route structure, render Navbar/Footer, apply global styles

**Landing Page:**
- Location: `src/pages/Landing.tsx`
- Triggers: User navigates to `/`
- Responsibilities: Render hero, search section, how-it-works, trust/safety sections

**Login Page:**
- Location: `src/pages/Login.tsx`
- Triggers: Unauthenticated user navigates to `/login` or ProtectedRoute redirects
- Responsibilities: Offer OAuth buttons (Google, Facebook, Apple); redirect existing users to appropriate dashboard/role selector

**Role Selection:**
- Location: `src/pages/RoleSelect.tsx`
- Triggers: User has session but no role set; first-time onboarding
- Responsibilities: Present trainer vs. client choice; call `setRole()` to update profile and create trainer_profiles record if trainer selected

**Auth Callback:**
- Location: `src/pages/AuthCallback.tsx`
- Triggers: OAuth provider redirects to `/auth/callback`
- Responsibilities: Wait for Supabase to extract session from URL, initialize auth state, redirect to appropriate next step

## Error Handling

**Strategy:** Try-catch blocks in async handlers; error state in hooks; conditional error UI in components; silent failures logged to console

**Patterns:**

- **Network errors in hooks:** Set `error` state, display in parent component, provide refetch button
- **Auth errors:** Catch in `signInWithProvider()`, `setRole()`, `signOut()` → log to console
- **Payment errors:** Catch in `BookSession` payment form, display error banner, allow retry
- **Booking errors:** Catch in `handleBooking()`, set `paymentError` state, display alert
- **Stripe setup errors:** Catch in `handleStripeConnect()`, set `stripeError` state, show message

## Cross-Cutting Concerns

**Logging:** Console-based (development); no external service configured

**Validation:**
- Type checking via TypeScript strict mode
- Null/undefined checks before DB updates
- Form input validation at component level (e.g., required fields in BookSession notes textarea)

**Authentication:**
- Supabase Auth (OAuth + JWT session management)
- `ProtectedRoute` enforces auth requirements
- Session persisted in browser localStorage by Supabase SDK
- Auto-refresh via Supabase `autoRefreshToken` config

**Payment Processing:**
- Stripe Elements for PCI-compliant card entry
- Conditional: only if `STRIPE_CONFIGURED` env var present
- Payment intent created server-side via Edge Function
- Client-side confirmPayment() handles 3D Secure and other payment methods

**Rate Limiting:** Not explicitly implemented; relies on Supabase RLS and implicit API limits

**Database Access Control:** Supabase Row-Level Security (RLS) policies on tables (profiles, trainer_profiles, bookings, availability_slots, notifications, reviews)

---

*Architecture analysis: 2026-03-11*
