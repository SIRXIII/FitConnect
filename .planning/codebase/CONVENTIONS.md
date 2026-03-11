# Coding Conventions

**Analysis Date:** 2026-03-11

## Naming Patterns

### Files

- **React Components**: PascalCase (e.g., `Navbar.tsx`, `ProtectedRoute.tsx`, `BookSession.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useTrainers.ts`, `useAvailability.ts`, `useNotifications.ts`)
- **Stores/Context**: camelCase (e.g., `auth.ts` for Zustand stores)
- **Utilities/Libraries**: camelCase (e.g., `supabase.ts`, `stripe.ts`)
- **Type definitions**: Named as `index.ts` in dedicated `types/` directories

### Functions

- **React Component Functions**: PascalCase (e.g., `const Navbar: React.FC = () => {...}`)
- **Regular functions**: camelCase (e.g., `fetchTrainers()`, `handleBooking()`, `formatSpecialty()`)
- **Event handlers**: `handle` prefix + PascalCase (e.g., `handleSignOut`, `handleClick`, `handleSubmit`)
- **State setters**: `set` prefix + PascalCase (e.g., `setLoading`, `setShowMenu`, `setNotes`)
- **Async functions**: camelCase with clear intent (e.g., `fetchProfile()`, `createPaymentIntent()`)

### Variables

- **State variables**: camelCase (e.g., `user`, `profile`, `notifications`, `isOpen`)
- **Boolean flags**: Prefix with `is`, `has`, `show`, or `should` (e.g., `isOpen`, `isBooked`, `showUserMenu`, `hasErrors`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `STRIPE_CONFIGURED`, `SUPABASE_URL`, `DB_SPECIALTIES`)
- **Enums**: PascalCase for enum name, UPPER_SNAKE_CASE for values (e.g., `enum PriceRange { BUDGET = 'budget', STANDARD = 'standard' }`)

### Types & Interfaces

- **Interfaces**: PascalCase with descriptive names (e.g., `Profile`, `TrainerProfile`, `BookingWithDetails`, `ProtectedRouteProps`)
- **Type unions**: PascalCase (e.g., `type UserRole = 'trainer' | 'client'`, `type BookingStep = 'review' | 'confirm' | 'payment' | 'success'`)
- **Props interfaces**: Suffix with `Props` (e.g., `ProtectedRouteProps`)

### Database/API

- **Table names**: snake_case (e.g., `trainer_profiles`, `availability_slots`, `bookings`)
- **Column names**: snake_case (e.g., `full_name`, `hourly_rate`, `is_booked`, `created_at`)
- **Database enums**: snake_case (e.g., `strength_training`, `cardio_hiit`, `yoga_pilates`)

## Code Style

### Formatting

- **Framework**: Vite with TypeScript (no explicit Prettier or ESLint config found)
- **Indentation**: 2 spaces (inferred from codebase)
- **Line length**: No strict limit observed, but files average 400-550 lines
- **Quotes**: Double quotes in JSX, single quotes can be used for strings
- **Semicolons**: Always used (TypeScript convention)

### TypeScript Strictness

- **tsconfig.json settings**:
  - `strict: true` - Full strict type checking enabled
  - `noEmit: true` - Type checking only (Vite handles compilation)
  - `noUnusedLocals: false` - Allow unused local variables
  - `noUnusedParameters: false` - Allow unused parameters
  - `skipLibCheck: true` - Skip type checking of declaration files
  - `jsx: "react-jsx"` - React 17+ JSX transform
  - `isolatedModules: true` - Ensure single-file transpilation safety
  - `moduleDetection: "force"` - Treat each file as a module

### Import Organization

**Order:**
1. React/built-in libraries (e.g., `import React from 'react'`)
2. Third-party packages (e.g., `import { useState } from 'react'`, `import { useParams } from 'react-router-dom'`)
3. Icon libraries (e.g., `import { Menu, X, LogOut } from 'lucide-react'`)
4. Internal utilities (e.g., `import { supabase } from '@/lib/supabase'`)
5. Store/state management (e.g., `import { useAuthStore } from '@/stores/auth'`)
6. Components (e.g., `import Navbar from '@/components/layout/Navbar'`)
7. Type imports (e.g., `import type { UserRole } from '@/stores/auth'`)

**Path Aliases:**
- `@/*` resolves to `./src/*` (configured in tsconfig.json)
- Always use `@/` for absolute imports within the src directory

### Styling Approach

**Framework**: Tailwind CSS v4 with CSS-first theme

**Design System** (defined in `src/index.css`):
```css
--color-primary: #000000
--color-accent: #C5A059 (gold/warm tone)
--color-paper: #FDFCFB (off-white background)
--color-ink: #1A1A1A (dark text)
--font-serif: "Cormorant Garamond"
--font-sans: "Inter"
```

**Styling Patterns**:

1. **Utility Classes**: All styling through Tailwind classes, no custom CSS classes in components
   ```tsx
   <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
   <h1 className="text-3xl serif font-light italic text-ink">
   <button className="border border-ink/20 px-8 py-2.5 text-[10px] uppercase tracking-[0.2em]">
   ```

2. **Opacity/Alpha Variants**: Use Tailwind opacity syntax with `/` (e.g., `text-ink/40`, `border-ink/10`, `bg-ink/3`)

3. **Serif Font**: Apply `.serif` class to access Cormorant Garamond font
   ```tsx
   <span className="text-2xl font-light tracking-[0.2em] uppercase serif">
   ```

4. **Spacing System**: Use consistent Tailwind scales (px-6, py-4, gap-3, space-y-6, mt-12, etc.)

5. **Colors**:
   - Primary ink colors: `text-ink`, `bg-ink`, `border-ink/[opacity]`
   - Accent/brand: `text-accent`, `bg-accent` (gold #C5A059)
   - Background: `bg-paper` (off-white #FDFCFB)
   - Interactive states: `:hover:` and `:focus:` with transitions

6. **Typography**:
   - Headlines: serif font, font-light, often italic
   - Body text: sans-serif (Inter), various weights
   - UI labels: uppercase with tracking-[0.2em] or tracking-widest (10-11px sizes)

7. **Transitions**: Consistent use of `transition-all duration-300` or `transition-colors` for interactive elements

8. **Responsive Design**: Mobile-first approach with `md:` breakpoint (hidden on mobile, shown on desktop)
   ```tsx
   <div className="hidden md:flex items-center space-x-12">
   ```

## Component Patterns

### Functional Components

All components are **functional React components** using React Hooks. Standard pattern:

```typescript
const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // hooks
  const [state, setState] = useState<Type>(initial);
  const store = useStore();

  // effects
  useEffect(() => {
    // setup
    return () => {
      // cleanup
    };
  }, [dependencies]);

  // handlers
  const handleAction = async () => {
    // logic
  };

  return <JSX />;
};

export default ComponentName;
```

### Hooks Usage

**Standard patterns:**
- `useState<Type>(initialValue)` - Always typed
- `useEffect(() => {...}, [deps])` - Always include dependency array
- `useCallback(() => {...}, [deps])` - For memoized callbacks passed to child components
- Custom hooks: `useTrainers()`, `useAvailability()`, `useNotifications()` return object with `{ data, loading, error }`

**Common hook return patterns**:
```typescript
// Hook return structure
{
  trainers: TrainerWithProfile[],
  loading: boolean,
  error: string | null,
  refetch: () => Promise<void>
}
```

### Component Directory Structure

```
src/components/
├── layout/          # Navbar, Footer (persistent page elements)
├── landing/         # Hero, HowItWorks, TrustSafety (landing page sections)
├── search/          # SearchSection, TrainerCard (search/browse functionality)
├── trainer/         # AvailabilityManager (trainer-specific components)
├── client/          # (Client-specific components)
├── auth/            # (Auth-specific components)
└── shared/          # ProtectedRoute (reusable across routes)
```

### Props Pattern

Props typed with `interface NameProps`:
```typescript
interface PaymentFormProps {
  onSuccess: () => void;
  onBack: () => void;
  amount: number;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ onSuccess, onBack, amount }) => {
  // ...
};
```

Inline props for simple, single-use components:
```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}
```

## Error Handling

### Patterns

1. **Try-catch for async operations**:
   ```typescript
   try {
     const response = await fetch(url);
     if (!response.ok) throw new Error(result.error);
     const data = await response.json();
   } catch (err: any) {
     setError(err.message || 'Operation failed');
   }
   ```

2. **Supabase error handling**:
   ```typescript
   const { data, error } = await supabase.from('table').select();
   if (error) {
     setError(error.message);
     return;
   }
   ```

3. **Conditional validation**:
   ```typescript
   if (!user) return;
   if (!trainerId) return;
   if (error) throw error;
   ```

4. **User-facing error messages** in state (e.g., `paymentError`, `stripeError`)

## Logging

**Framework**: `console` methods (no dedicated logging library detected)

**Patterns**:
- `console.error('context:', err)` for error tracking (e.g., in BookSession)
- Direct console logging for debugging (minimal in production code)
- No structured logging observed (opportunity for improvement)

## Comments

### When to Comment

- **Complex logic**: State machine transitions (e.g., booking steps: review → confirm → payment → success)
- **Non-obvious intent**: Why a workaround exists, why a specific approach was chosen
- **Inline comments for clarity**: Breaking down multi-step operations

### Examples from codebase

```typescript
// Step 1 → 2: Create booking in DB
const handleBooking = async () => {

// Close dropdowns on outside click
useEffect(() => {

// Stripe is configured, create a payment intent
if (STRIPE_CONFIGURED) {

// Step 1 → 2: Create booking in DB
```

**JSDoc/TSDoc**: No widespread JSDoc usage observed. Used minimally for function signatures where types are insufficient.

## Module Design

### Exports

**Named exports** for utilities and hooks:
```typescript
export function useTrainers(options: UseTrainersOptions = {}) {
  // ...
}

export function useTrainerById(trainerId: string | undefined) {
  // ...
}
```

**Default exports** for React components:
```typescript
const Navbar: React.FC = () => { /* ... */ };
export default Navbar;
```

**Mixed exports** for stores and constants:
```typescript
export const useAuthStore = create<AuthState>(...)
export type UserRole = 'trainer' | 'client';
export interface Profile { ... }
```

### Barrel Files

No barrel files (index.ts re-exports) found in the codebase. Imports use direct file paths:
```typescript
// No barrel file pattern
import { useAuthStore } from '@/stores/auth';    // Direct import
import Navbar from '@/components/layout/Navbar';  // Direct import
```

## Data/State Management

### Zustand Stores

Zustand used for global state (`@/stores/auth.ts`):

```typescript
export const useAuthStore = create<AuthState>((set, get) => ({
  // state
  user: null,
  loading: true,

  // methods
  initialize: async () => {
    if (get().initialized) return;
    // logic
    set({ user, session });
  },
}));
```

**Patterns**:
- State interface defines all properties and methods
- Methods use `set()` to update state and `get()` to read current state
- Subscribers use hooks: `const { user, profile } = useAuthStore();`

### Local Component State

Components use `useState` for UI state that doesn't need global sharing:
```typescript
const [isOpen, setIsOpen] = useState(false);
const [showUserMenu, setShowUserMenu] = useState(false);
const [notes, setNotes] = useState('');
```

## Environment Variables

**Vite env vars** (accessed via `import.meta.env`):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase public anon key
- `GEMINI_API_KEY` - Optional, for AI features
- Stripe configuration detected but not explicitly typed

Accessed as: `import.meta.env.VITE_VARIABLE_NAME`

## Testing Conventions (observed in code)

- **No test framework configured** (see TESTING.md for details)
- No test files found in codebase
- Type checking enforced via TypeScript with `npm run lint` (tsc --noEmit)

---

*Convention analysis: 2026-03-11*
