# Technology Stack

**Analysis Date:** 2026-03-11

## Languages

**Primary:**
- TypeScript 5.8.2 - All source code in `src/` directory
- JSX/TSX - React components throughout

**Secondary:**
- CSS (Tailwind CSS v4) - Styling via utility classes and design tokens

## Runtime

**Environment:**
- Node.js (targets ES2022)
- Browser (modern browsers with ES2022 support)

**Package Manager:**
- npm
- Lockfile: `Cenlar demand gt 1-17/package-lock.json` (present)

## Frameworks

**Core:**
- React 19.2.1 - UI library
- React Router DOM 7.13.1 - Client-side routing
- Vite 6.2.0 - Build tool and dev server

**State Management:**
- Zustand 5.0.11 - Global state management for auth
  - Implementation: `src/stores/auth.ts`

**Build/Dev:**
- Vite React plugin 5.0.0 - React HMR support
- Tailwind CSS Vite plugin 4.2.1 - CSS-first design system with v4
- TypeScript 5.8.2 - Type checking via `tsc --noEmit`

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.99.0 - Backend API client and database ORM
  - Configuration: `src/lib/supabase.ts`
  - Auth: Handles OAuth (Google, Facebook, Apple)
  - Realtime subscriptions for notifications

- @stripe/stripe-js 8.9.0 - Stripe payment library (client)
- @stripe/react-stripe-js 5.6.1 - Stripe React components
  - Configuration: `src/lib/stripe.ts`
  - Used in: `src/pages/BookSession.tsx`

**UI & Animation:**
- framer-motion 12.35.2 - Animations and motion components
- lucide-react 0.555.0 - SVG icon library

**Data Visualization:**
- recharts 3.5.1 - Chart and graph library
  - Used for trainer analytics and market insights

**Styling:**
- Tailwind CSS 4.2.1 - Utility-first CSS framework
  - Custom theme: `src/index.css`
  - Design tokens: `--color-accent: #C5A059`, `--color-paper: #FDFCFB`, `--color-ink: #1A1A1A`
  - Custom fonts: Cormorant Garamond (serif), Inter (sans)

**Type Definitions:**
- @types/react 19.2.14
- @types/react-dom 19.2.3
- @types/node 22.14.0

## Configuration

**Environment:**
- Vite loads environment variables from `.env.local`
- Key environment variables required:
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
  - `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (optional)
  - `GEMINI_API_KEY` - Google Gemini API (exposed via Vite define)

**Build Configuration:**
- `vite.config.ts` - Vite configuration
  - Dev server: Port 3000, host 0.0.0.0
  - Alias: `@/` maps to `./src/`
  - React and Tailwind CSS plugins enabled

**TypeScript Configuration:**
- `tsconfig.json` - Strict mode enabled
  - Target: ES2022
  - Module: ESNext
  - Path alias: `@/*` → `./src/*`
  - skipLibCheck: true
  - strict: true

## Platform Requirements

**Development:**
- Node.js with npm
- Modern text editor or IDE (TypeScript support recommended)
- Supabase account for database and authentication
- Stripe account for payment processing (optional)

**Production:**
- Node.js runtime for build/development
- Supabase hosted backend
- Stripe hosted payment processing
- Static hosting compatible with SPA (Vercel, Netlify, etc.)

## Build & Deployment

**Scripts:**
```bash
npm run dev       # Start Vite dev server (http://localhost:3000)
npm run build     # Production build to dist/
npm run preview   # Preview production build locally
npm run lint      # Type check with TypeScript
```

**Output:**
- Built files: `dist/` directory
- Includes minified JavaScript, CSS, and assets
- Source maps available for debugging

---

*Stack analysis: 2026-03-11*
