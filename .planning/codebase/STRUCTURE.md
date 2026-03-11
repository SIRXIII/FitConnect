# Codebase Structure

**Analysis Date:** 2026-03-11

## Directory Layout

```
src/
├── components/               # Reusable UI components organized by domain
│   ├── auth/                # Authentication-specific components (not actively used)
│   ├── client/              # Client-specific features (reserved for future)
│   ├── landing/             # Landing page sections (Hero, HowItWorks, TrustSafety)
│   ├── layout/              # App-wide layout (Navbar, Footer)
│   ├── search/              # Trainer search & discovery (SearchSection, TrainerCard)
│   ├── shared/              # Shared/utility components (ProtectedRoute)
│   └── trainer/             # Trainer-specific UI (AvailabilityManager)
├── hooks/                   # Custom React hooks for data fetching & state
│   ├── useAvailability.ts   # Trainer availability CRUD
│   ├── useTrainers.ts       # Trainer discovery & filtering
│   └── useNotifications.ts  # Real-time notifications
├── lib/                     # Utility libraries & client initialization
│   ├── constants.ts         # Mock data & specialty definitions
│   ├── supabase.ts          # Supabase client configuration
│   └── stripe.ts            # Stripe promise & configuration (untracked)
├── pages/                   # Route page components
│   ├── Landing.tsx          # Public homepage (/)
│   ├── Login.tsx            # OAuth login (/login)
│   ├── AuthCallback.tsx     # OAuth redirect handler (/auth/callback)
│   ├── RoleSelect.tsx       # Role selection onboarding (/onboarding/role)
│   ├── TrainerDashboard.tsx # Trainer home (/trainer/dashboard)
│   ├── ClientDashboard.tsx  # Client home (/client/dashboard)
│   ├── TrainerProfile.tsx   # Public trainer profile (/trainers/:id)
│   ├── BookSession.tsx      # Booking flow (/book/:slotId)
│   └── MyBookings.tsx       # Client booking history (/client/bookings)
├── stores/                  # Global state management (Zustand)
│   └── auth.ts              # Auth store with user/profile/trainer profile
├── types/                   # TypeScript type definitions & enums
│   └── index.ts             # Trainer interface, PriceRange enum, specialty maps
├── App.tsx                  # Main app component with route definitions
├── main.tsx                 # React app entry point
├── index.css                # Global Tailwind CSS imports
└── vite-env.d.ts           # Vite environment type definitions
```

## Directory Purposes

**src/components/:**
- Purpose: Reusable React components organized by feature domain
- Contains: Functional components, styled with Tailwind, using lucide-react icons and framer-motion animations
- Key files: `Navbar.tsx` (global header), `ProtectedRoute.tsx` (auth guard), `SearchSection.tsx` (trainer filtering)

**src/components/landing/:**
- Purpose: Sections composing the public landing page
- Contains: `Hero.tsx`, `HowItWorks.tsx`, `TrustSafety.tsx`
- Pattern: Each component is a self-contained section with animations

**src/components/layout/:**
- Purpose: App-wide chrome and container components
- Contains: `Navbar.tsx` (fixed header with auth menu, notifications), `Footer.tsx` (app-wide footer)

**src/components/search/:**
- Purpose: Trainer discovery and results display
- Contains: `SearchSection.tsx` (filter form + results grid), `TrainerCard.tsx` (individual trainer card)
- Data flow: SearchSection queries useTrainers() → filters applied → TrainerCard renders result

**src/components/shared/:**
- Purpose: Utility components used across multiple domains
- Contains: `ProtectedRoute.tsx` (auth enforcement wrapper)

**src/components/trainer/:**
- Purpose: Trainer-specific UI components
- Contains: `AvailabilityManager.tsx` (manage time slots, add weekly slots)

**src/hooks/:**
- Purpose: Encapsulate data fetching, mutations, and real-time subscriptions
- Contains: Custom hooks following React conventions with loading/error/data states
- Key pattern: Each hook manages its own state and provides mutation functions

**src/lib/:**
- Purpose: Initialization, configuration, constants
- Contains: Supabase client setup, Stripe promise configuration, mock data for fallback display

**src/lib/constants.ts:**
- Exports: `MOCK_TRAINERS` (6 seed trainers), `SPECIALTIES` (5 training categories)
- Usage: SearchSection falls back to mock data when DB is empty and no filters set

**src/pages/:**
- Purpose: Route-level page components (one per major route)
- Pattern: Each page manages its own data fetching via hooks, handles complex workflows (e.g., BookSession 4-step flow)

**src/stores/:**
- Purpose: Zustand store for global client state
- Contains: `auth.ts` – user session, profiles, authentication actions
- Initialization: Called once in App.tsx via `useAuthStore.initialize()`

**src/types/:**
- Purpose: Shared TypeScript interfaces and enums
- Contains: `Trainer` (legacy mock type), `Profile`, `TrainerProfile`, `PriceRange` enum, specialty mappings
- Usage: Imported by components, hooks, stores for type safety

## Key File Locations

**Entry Points:**
- `src/main.tsx`: ReactDOM.createRoot() mounts App to #root
- `src/App.tsx`: Route definitions, BrowserRouter wrapper, auth initialization

**Configuration:**
- `tsconfig.json`: Compiler options, path aliases (`@/` → `./src/`), strict mode enabled
- `vite.config.ts`: Vite server setup (port 3000), React plugin, Tailwind vite plugin, @ alias definition
- `.env.local`: Supabase URL/key, Stripe config (not committed)

**Core Logic:**
- `src/stores/auth.ts`: Auth store with OAuth, profile fetching, role management
- `src/lib/supabase.ts`: Supabase client singleton
- `src/hooks/useTrainers.ts`: Query trainer_profiles with filters
- `src/hooks/useAvailability.ts`: Manage availability_slots CRUD
- `src/hooks/useNotifications.ts`: Real-time notification subscription

**Testing:**
- No test files present (no test framework configured)

## Naming Conventions

**Files:**
- Page components: `PascalCase.tsx` in `src/pages/` (e.g., `TrainerDashboard.tsx`, `BookSession.tsx`)
- Component files: `PascalCase.tsx` in `src/components/` (e.g., `Navbar.tsx`, `TrainerCard.tsx`)
- Hook files: `camelCase.ts` starting with `use` in `src/hooks/` (e.g., `useTrainers.ts`)
- Store files: `camelCase.ts` in `src/stores/` (e.g., `auth.ts`)
- Type files: `camelCase.ts` in `src/types/` (e.g., `index.ts`)
- Constants files: `camelCase.ts` in `src/lib/` (e.g., `constants.ts`, `supabase.ts`)

**Directories:**
- Kebab-case for feature groupings within components: `landing/`, `layout/`, `search/`, `shared/`, `trainer/`
- Lowercase for top-level directories: `components/`, `hooks/`, `lib/`, `pages/`, `stores/`, `types/`

**Variables & Functions:**
- React components: `PascalCase` (e.g., `Navbar`, `BookSession`)
- Functions, hooks, variables: `camelCase` (e.g., `useTrainers`, `handleStripeConnect`, `setRole`)
- Constants: `UPPER_SNAKE_CASE` for mock data (e.g., `MOCK_TRAINERS`, `SPECIALTIES`)
- Environment variables: `VITE_*` prefix for Vite exposure (e.g., `VITE_SUPABASE_URL`)

**Types & Interfaces:**
- Interfaces: `PascalCase` (e.g., `Profile`, `TrainerProfile`, `AvailabilitySlot`)
- Enums: `PascalCase` (e.g., `PriceRange`)
- Generic type variables: Single uppercase letter (e.g., `React.FC<T>`)

## Where to Add New Code

**New Feature (e.g., messaging system):**
- Primary code: `src/pages/Messages.tsx` (if route) or `src/components/messages/` (if shared component group)
- Hooks: `src/hooks/useMessages.ts` for data fetching/mutations
- Types: Add interface to `src/types/index.ts`
- Store: Add to `src/stores/auth.ts` if auth-related, or create new store `src/stores/messages.ts`
- Routes: Add to `src/App.tsx` BrowserRouter Routes section

**New Component/Module (e.g., rating display):**
- Implementation: `src/components/shared/RatingDisplay.tsx` or domain-specific folder like `src/components/search/RatingDisplay.tsx`
- If reused across multiple domains: Place in `src/components/shared/`
- Export from component file; import via `@/components/shared/RatingDisplay`

**Utilities/Helpers:**
- Small helper functions: Add to existing `src/lib/constants.ts` or `src/types/index.ts`
- New utility module (e.g., date formatting): Create `src/lib/dateUtils.ts`
- No separate `utils/` folder; keep helpers close to their usage location

**New Custom Hook:**
- Location: `src/hooks/useNewFeature.ts`
- Pattern: Export function starting with `use`, returning object with `{ data, loading, error, refetch }` or similar
- Use `useCallback` for stable function references in dependency arrays
- Call hooks in component render phase; mutations in event handlers

**Database/API Integration:**
- For simple CRUD: Add to existing hook (e.g., add method to `useTrainers`)
- For complex queries/transactions: Create new hook `src/hooks/useNewResource.ts`
- Call Supabase methods via `src/lib/supabase.ts` client singleton
- Handle errors in hook; component calls `refetch()` on error for retry

**Types/Interfaces:**
- Small types: Add to `src/types/index.ts`
- Large domain model: Create `src/types/domain.ts` (e.g., `src/types/notifications.ts`)
- Import as `import type { MyType } from '@/types'` or `from '@/types/domain'`

## Special Directories

**src/components/auth/:**
- Purpose: Future auth UI components (not currently used; OAuth handled in Login.tsx)
- Generated: No
- Committed: Yes, but empty/unused

**src/components/client/:**
- Purpose: Reserved for client-specific features (not currently used; client pages in src/pages/)
- Generated: No
- Committed: Yes, but empty/unused

**dist/:**
- Purpose: Build output directory (Vite production build)
- Generated: Yes (run `npm run build`)
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: Package dependencies
- Generated: Yes (run `npm install`)
- Committed: No (in .gitignore)

## Route Structure

| Path | Component | Auth | Role | Purpose |
|------|-----------|------|------|---------|
| `/` | `Landing` | No | Any | Public homepage |
| `/login` | `Login` | No | Any | OAuth sign-in |
| `/auth/callback` | `AuthCallback` | Yes | Any | OAuth redirect handler |
| `/onboarding/role` | `RoleSelect` | Yes | Any | First-time role selection |
| `/trainer/dashboard` | `TrainerDashboard` | Yes | trainer | Trainer home, stats, availability |
| `/client/dashboard` | `ClientDashboard` | Yes | client | Client home, quick actions |
| `/trainers` | `Landing` | No | Any | Browse trainers (search on Landing) |
| `/trainers/:id` | `TrainerProfile` | No | Any | Public trainer profile details |
| `/book/:slotId` | `BookSession` | Yes | client | Multi-step booking flow |
| `/client/bookings` | `MyBookings` | Yes | client | Booking history, reviews, cancel |

---

*Structure analysis: 2026-03-11*
