# Testing Patterns

**Analysis Date:** 2026-03-11

## Test Framework

### Status

**NO TEST FRAMEWORK INSTALLED OR CONFIGURED**

The codebase has no testing infrastructure. There are:
- No test files (*.test.ts, *.spec.ts, or __tests__/ directories)
- No test runner configured (vitest, jest, etc.)
- No testing libraries installed (@testing-library/react, etc.)
- No test configuration files (vitest.config.ts, jest.config.js, etc.)

### Code Quality Checks

**Type Checking Only:**
- Framework: TypeScript
- Command: `npm run lint` (runs `tsc --noEmit`)
- Location: `package.json` scripts
- tsconfig.json enforces strict mode

```bash
npm run lint    # Type check all src files
npm run dev     # Start development server
npm run build   # Production build
npm run preview # Preview built app
```

## Test File Organization

### Recommendation (Not Currently Implemented)

If testing is added, use this structure:

**Co-located pattern** (recommended for this project):
```
src/
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── Navbar.test.tsx        # Test adjacent to component
│   └── shared/
│       ├── ProtectedRoute.tsx
│       └── ProtectedRoute.test.tsx
├── hooks/
│   ├── useTrainers.ts
│   └── useTrainers.test.ts
├── pages/
│   ├── BookSession.tsx
│   └── BookSession.test.tsx
└── stores/
    ├── auth.ts
    └── auth.test.ts
```

**Alternative: Separate test directory** (if preferred):
```
src/
__tests__/
├── components/
├── hooks/
├── pages/
└── stores/
```

## Test Structure

### Recommended Testing Patterns (not yet implemented)

If vitest or jest is added, use this structure:

**React Component Test Example:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import { useAuthStore } from '@/stores/auth';

// Mock the auth store
vi.mock('@/stores/auth');

describe('Navbar Component', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  it('should render logo', () => {
    // Mock auth state
    (useAuthStore as any).mockReturnValue({
      user: null,
      profile: null,
      signOut: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    expect(screen.getByText('FitConnect')).toBeInTheDocument();
  });

  it('should show sign in button when not authenticated', () => {
    (useAuthStore as any).mockReturnValue({
      user: null,
      profile: null,
    });

    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show user menu when authenticated', () => {
    (useAuthStore as any).mockReturnValue({
      user: { id: '123' },
      profile: { full_name: 'John Doe', role: 'trainer' },
      signOut: vi.fn(),
    });

    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    const userButton = screen.getByRole('button');
    userEvent.click(userButton);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
```

**Hook Test Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTrainers } from '@/hooks/useTrainers';

vi.mock('@/lib/supabase');

describe('useTrainers Hook', () => {
  it('should fetch trainers on mount', async () => {
    const { result } = renderHook(() => useTrainers());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trainers).toBeDefined();
  });

  it('should apply filters', async () => {
    const { result } = renderHook(() =>
      useTrainers({ specialty: 'strength_training', maxRate: 100 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Assert filtered results
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useTrainers());

    await waitFor(() => {
      expect(result.current.error).toBe(null);
    });
  });
});
```

## Mocking

### Current Status

No mocking infrastructure exists. When testing is added, mock these critical dependencies:

**External Libraries to Mock:**
- `@supabase/supabase-js` - Database/auth client
- `react-router-dom` - Navigation (use BrowserRouter for tests)
- `lucide-react` - Icons (mock as simple components)
- `framer-motion` - Animations (disable in tests)
- `@stripe/react-stripe-js` - Payment (mock payment responses)

**Store to Mock:**
- `@/stores/auth` - Zustand store (mock useAuthStore hook)

### What to Mock

- **External API calls** (Supabase queries)
- **Authentication state** (auth store)
- **Browser APIs** (window.location, localStorage if used)
- **Third-party SDKs** (Stripe, analytics)

### What NOT to Mock

- **React Router** DOM (use BrowserRouter in tests)
- **Tailwind CSS** classes (they're applied, just not visible in tests)
- **Core React hooks** (useState, useEffect, etc.)
- **Custom hooks** that don't call external APIs (unless they depend on mocked services)

## Fixtures and Factories

### Recommended Pattern (not yet implemented)

Create `src/__tests__/fixtures/` directory for test data:

```typescript
// src/__tests__/fixtures/auth.ts
export const mockUser = {
  id: '123',
  email: 'test@example.com',
  created_at: '2026-01-01',
};

export const mockProfile = {
  id: '123',
  role: 'client' as const,
  full_name: 'Test User',
  avatar_url: null,
  phone: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

export const mockTrainerProfile = {
  id: 'trainer-1',
  user_id: '456',
  specialty: 'strength_training',
  bio: 'Experienced trainer',
  hourly_rate: 100,
  optimized_rate: 60,
  location: 'San Francisco',
  latitude: 37.7749,
  longitude: -122.4194,
  certifications: ['NASM'],
  verified: true,
  rating: 4.8,
  review_count: 42,
  stripe_account_id: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};
```

## Coverage

### Current Status

**No coverage enforcement.** TypeScript provides type safety but not runtime coverage.

### Recommended Setup (when testing is added)

**Configuration** (in vitest.config.ts or package.json):
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
});
```

**Targets to aim for:**
- Line coverage: 70%+ (critical paths)
- Branch coverage: 60%+ (main conditionals)
- Function coverage: 75%+
- Statement coverage: 70%+

Focus on testing:
- All hook logic
- All state transitions (especially booking flow)
- All authentication guards
- Payment flow (critical)
- Error states

**View Coverage:**
```bash
npm run test:coverage
# Generates html report in coverage/index.html
```

## Test Types

### Unit Tests (Recommended approach)

**Scope**: Individual functions, hooks, stores

**Example areas to test:**
- `useTrainers()` hook with/without filters
- `useAvailability()` hook slot fetching
- `useAuthStore` auth state transitions
- `formatSpecialty()` utility function
- Type guards and data validation

```typescript
// Example: Unit test for utility function
describe('formatSpecialty', () => {
  it('should convert snake_case to Title Case', () => {
    expect(formatSpecialty('strength_training')).toBe('Strength Training');
    expect(formatSpecialty('cardio_hiit')).toBe('Cardio & HIIT');
  });

  it('should handle unknown specialties gracefully', () => {
    expect(formatSpecialty('unknown_specialty')).toBe('Unknown Specialty');
  });
});
```

### Integration Tests (Recommended for critical flows)

**Scope**: Multiple components + services working together

**Example areas to test:**
- Complete booking flow: View trainer → Select slot → Confirm → Pay
- Authentication flow: Login → Onboard role → Access dashboard
- Trainer availability: Create availability → Client books → Update status

```typescript
// Example: Integration test for booking flow
describe('Booking Flow Integration', () => {
  it('should complete full booking from slot selection to confirmation', async () => {
    // 1. Render trainer profile
    // 2. Select time slot
    // 3. Fill in booking details
    // 4. Confirm booking
    // 5. Verify booking created in store
  });
});
```

### E2E Tests

**Status**: Not recommended for current stage

**Consideration**: As app grows, use Playwright or Cypress for critical user journeys:
- User signup flow
- Booking and payment flow
- Trainer dashboard management

## Async Testing

### Recommended Pattern (when testing is added)

```typescript
import { waitFor } from '@testing-library/react';

describe('Async Operations', () => {
  it('should handle async hook updates', async () => {
    const { result } = renderHook(() => useTrainers());

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for completion
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trainers).toHaveLength(5);
  });

  it('should handle async component side effects', async () => {
    render(<BookSession />);

    // Wait for slot data to load
    const slotInfo = await screen.findByText(/session details/i);
    expect(slotInfo).toBeInTheDocument();
  });

  it('should handle async form submission', async () => {
    const user = userEvent.setup();
    render(<BookingForm />);

    const submitButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(submitButton);

    // Wait for submission to complete
    await waitFor(() => {
      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument();
    });
  });
});
```

## Error Testing

### Recommended Pattern (when testing is added)

```typescript
describe('Error Handling', () => {
  it('should display error when trainer fetch fails', async () => {
    // Mock fetch to fail
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Database connection failed'),
      }),
    } as any);

    const { result } = renderHook(() => useTrainers());

    await waitFor(() => {
      expect(result.current.error).toBe('Database connection failed');
      expect(result.current.trainers).toEqual([]);
    });
  });

  it('should show error UI when payment fails', async () => {
    const { getByText, queryByText } = render(
      <PaymentForm amount={100} onSuccess={vi.fn()} onBack={vi.fn()} />
    );

    // Simulate payment failure
    const submitButton = getByText('Pay');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(queryByText(/payment failed/i)).toBeInTheDocument();
    });
  });

  it('should handle network timeouts gracefully', async () => {
    // Mock timeout scenario
    const { result } = renderHook(() => useTrainers());

    await waitFor(() => {
      expect(result.current.error).toContain('timeout');
    });
  });
});
```

## Testing Gaps

### Critical areas with no test coverage (currently untested)

| Area | Risk | Priority |
|------|------|----------|
| **Booking flow** (BookSession.tsx) | High - Complex multi-step flow, payment integration, database writes | Critical |
| **Authentication** (useAuthStore) | High - State management, role-based access control | Critical |
| **Trainer availability** (useAvailability hook) | High - Slot management, booking conflicts | High |
| **Payment processing** (Stripe integration) | Critical - Financial transactions | Critical |
| **Protected routes** (ProtectedRoute component) | High - Access control, redirects | High |
| **Trainer search/filtering** (useTrainers hook) | Medium - Filter logic, database queries | Medium |
| **Notifications system** (useNotifications hook) | Medium - State updates, UI updates | Medium |
| **Data validation** | Medium - Type safety via TypeScript only | Medium |
| **Error handling** | Medium - Error states, user feedback | Medium |
| **Responsive UI** | Low - Visual regression, browser compatibility | Low |

## Recommended Next Steps

### Phase 1: Foundation (Week 1-2)
1. Install vitest + @testing-library/react
2. Set up test configuration (vitest.config.ts)
3. Create mocking utilities for Supabase and auth store
4. Write 5-10 unit tests for utility functions

**Sample setup:**
```bash
npm install -D vitest @testing-library/react @testing-library/user-event @vitest/ui
npm install -D vi-mock-lib  # For vitest mocking
```

### Phase 2: Critical Path (Week 3-4)
1. Test authentication flow (useAuthStore)
2. Test booking flow (BookSession component)
3. Test protected routes
4. Test payment integration mocks

**Target**: 10-15 integration tests

### Phase 3: Comprehensive (Week 5+)
1. Test all hooks (useTrainers, useAvailability, useNotifications)
2. Test all page components
3. Test error scenarios
4. Achieve 60%+ line coverage

---

*Testing analysis: 2026-03-11*

**Critical note**: The FitConnect codebase currently relies entirely on TypeScript for code quality and has ZERO runtime test coverage. This is a significant technical debt, especially for complex features like payments and user authentication. Implementing tests should be prioritized for production readiness.
