# Phase 20: UX Polish - Research

**Researched:** 2026-03-17
**Domain:** React SPA UX improvements -- booking wizard, image optimization, skeleton loading, error states
**Confidence:** HIGH

## Summary

Phase 20 is a cross-cutting UX refinement phase touching the booking flow, image loading, loading states, and error handling across the FitRush app. The existing codebase already has a functional booking flow (`BookSession.tsx`) with a step-based state machine (`review | confirm | payment | success`) but no progress indicator, no animated transitions, and an abrupt step change. Loading states throughout the app use a single pattern: a spinning border circle (`animate-spin`). Error handling is inconsistent -- some pages show inline error messages with retry, others silently swallow errors, and the `ErrorBoundary` shows raw `error.message` strings with only a "Refresh Page" button.

All four requirements (UXP-01 through UXP-04) are purely frontend work. No new database migrations, Edge Functions, or backend changes are needed. The existing stack (React 19, Framer Motion 12, Tailwind v4, Lucide icons, sonner toasts) provides everything required. No new npm packages are needed -- Framer Motion handles animated transitions, Tailwind handles skeleton shimmer effects, and `browser-image-compression` (already researched in STACK.md for Phase 18) handles client-side image optimization. The only potential addition is a native `loading="lazy"` attribute on `<img>` tags, which requires zero dependencies.

**Primary recommendation:** Implement as three plans: (1) Booking flow wizard redesign with progress indicator and Framer Motion transitions, (2) Image optimization + skeleton loading screens as a combined cross-cutting pass, (3) Actionable error states with retry logic and an `ErrorState` reusable component.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UXP-01 | Booking flow redesign with progress indicator (step-by-step wizard) | Existing `BookSession.tsx` has 4-step state machine. Add visual progress bar, Framer Motion `AnimatePresence` for step transitions, pricing breakdown already exists. See Architecture Patterns section. |
| UXP-02 | Image optimization + compression (lazy loading, WebP, srcset) | `browser-image-compression` already in stack (Phase 18). Add `loading="lazy"` to all `<img>` tags. Unsplash fallback URLs already use `auto=format` (WebP capable). Supabase Storage serves uploaded avatars directly. See Don't Hand-Roll section. |
| UXP-03 | Skeleton loading screens (replace spinners with content-shaped placeholders) | 12+ spinner instances found across the codebase. Tailwind `animate-pulse` provides shimmer. Create reusable skeleton components matching card/profile/dashboard layouts. See Architecture Patterns section. |
| UXP-04 | Actionable error states (retry buttons, helpful messages, recovery paths) | Current ErrorBoundary shows raw error.message. Toast errors vary in quality. Create `ErrorState` component with icon, message, action button, and optional retry callback. See Code Examples section. |
</phase_requirements>

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `framer-motion` | `^12.35.2` | Animated step transitions in booking wizard, skeleton fade-in | Already in `package.json`. `AnimatePresence` + `motion.div` with `exit` props handle step transitions. No alternative needed. |
| `tailwindcss` | `^4.2.1` | Skeleton shimmer via `animate-pulse`, responsive skeleton sizing | Already installed. `animate-pulse` is the standard skeleton shimmer pattern. No additional CSS animation library needed. |
| `lucide-react` | `^0.555.0` | Icons for error states (AlertTriangle, RefreshCw, WifiOff) | Already installed. Provides all needed error/status icons. |
| `sonner` | `^2.0.7` | Toast notifications for recoverable errors | Already installed. Used throughout the app for error and success toasts. |
| `browser-image-compression` | `^2.0.2` | Client-side image compression before Supabase Storage upload | Already in STACK.md research. Used in Phase 18 for avatar upload. Reuse the same compression utility for any new image uploads. |

### Supporting (Native Browser APIs -- Zero Dependencies)

| API | Purpose | When to Use |
|-----|---------|-------------|
| `loading="lazy"` (HTML attribute) | Native lazy loading for offscreen images | Every `<img>` tag that is below the fold. TrainerCard images, review avatars, profile photos. |
| `srcset` + `sizes` (HTML attributes) | Responsive image sizes based on viewport | Supabase Storage images do not support on-the-fly transforms (requires Pro plan). Use for Unsplash fallback URLs which support `w=` parameter. |
| `IntersectionObserver` | Custom lazy loading for complex cases | Only if `loading="lazy"` is insufficient (e.g., animating skeleton-to-image transitions). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Framer Motion `AnimatePresence` | CSS transitions + `useState` | More manual code, no exit animations, harder to coordinate multi-step wizard. Framer Motion is already installed -- use it. |
| Tailwind `animate-pulse` skeletons | `react-loading-skeleton` npm | Adds dependency for something achievable with 3 Tailwind classes. Not worth the bundle size. |
| Custom `ErrorState` component | `react-error-boundary` npm | Overkill. The existing class-based `ErrorBoundary` works. The need is for inline error states (not boundary-level), which are just a presentational component. |
| Native `loading="lazy"` | `react-lazy-load-image-component` | Adds 8KB for what the browser does natively. Only use the npm package if you need blur-up placeholder effects, which are not in scope. |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── booking/
│   │   ├── BookingWizard.tsx        # Step container with progress indicator
│   │   ├── StepReview.tsx           # Step 1: session details + notes
│   │   ├── StepConfirm.tsx          # Step 2: pricing breakdown + confirm
│   │   ├── StepPayment.tsx          # Step 3: Stripe Elements payment
│   │   └── StepSuccess.tsx          # Step 4: confirmation + next actions
│   ├── shared/
│   │   ├── ErrorState.tsx           # Reusable error display with retry
│   │   ├── Skeleton.tsx             # Base skeleton primitives (line, circle, rect)
│   │   └── ErrorBoundary.tsx        # Existing -- enhanced with ErrorState
│   └── skeleton/
│       ├── TrainerCardSkeleton.tsx   # Matches TrainerCard layout
│       ├── ProfileSkeleton.tsx       # Matches TrainerProfile layout
│       ├── DashboardSkeleton.tsx     # Matches ClientDashboard/TrainerDashboard
│       └── BookingCardSkeleton.tsx   # Matches MyBookings card layout
├── pages/
│   └── BookSession.tsx              # Refactored to use BookingWizard
```

### Pattern 1: Multi-Step Booking Wizard with Progress Indicator

**What:** Extract the current `BookSession.tsx` step logic into a `BookingWizard` container component with a visual progress indicator (numbered steps with connecting line), Framer Motion `AnimatePresence` for step transitions, and separate step components for each phase.

**When to use:** UXP-01. The current `BookSession.tsx` is 628 lines with inline step rendering. Breaking into sub-components improves readability and enables per-step animations.

**Example:**

```typescript
// src/components/booking/BookingWizard.tsx
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STEPS = ['Review', 'Confirm', 'Payment', 'Complete'] as const;
type Step = typeof STEPS[number];

const stepVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

interface ProgressIndicatorProps {
  steps: readonly string[];
  currentIndex: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ steps, currentIndex }) => (
  <div className="flex items-center justify-between mb-12">
    {steps.map((label, i) => (
      <div key={label} className="flex items-center">
        <div className="flex flex-col items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
              i <= currentIndex
                ? 'bg-accent text-white'
                : 'border border-ink/20 text-ink/30'
            }`}
          >
            {i + 1}
          </div>
          <span className="text-[9px] uppercase tracking-[0.2em] text-ink/40 mt-2">
            {label}
          </span>
        </div>
        {i < steps.length - 1 && (
          <div
            className={`h-px w-12 md:w-24 mx-2 transition-colors duration-300 ${
              i < currentIndex ? 'bg-accent' : 'bg-ink/10'
            }`}
          />
        )}
      </div>
    ))}
  </div>
);

// Usage in BookingWizard:
// <AnimatePresence mode="wait">
//   <motion.div
//     key={currentStep}
//     variants={stepVariants}
//     initial="enter"
//     animate="center"
//     exit="exit"
//     transition={{ duration: 0.25 }}
//   >
//     {renderStep()}
//   </motion.div>
// </AnimatePresence>
```

### Pattern 2: Skeleton Loading Components

**What:** Create reusable skeleton primitives (`SkeletonLine`, `SkeletonCircle`, `SkeletonRect`) using Tailwind `animate-pulse bg-ink/5`, then compose them into page-specific skeleton layouts that match the dimensions of real content.

**When to use:** UXP-03. Replace every `animate-spin` spinner instance with a content-shaped skeleton.

**Example:**

```typescript
// src/components/shared/Skeleton.tsx

export const SkeletonLine: React.FC<{ width?: string; className?: string }> = ({
  width = 'w-full',
  className = '',
}) => (
  <div className={`h-4 ${width} bg-ink/5 animate-pulse ${className}`} />
);

export const SkeletonCircle: React.FC<{ size?: string }> = ({ size = 'w-10 h-10' }) => (
  <div className={`${size} rounded-full bg-ink/5 animate-pulse`} />
);

export const SkeletonRect: React.FC<{ className?: string }> = ({ className = 'h-48 w-full' }) => (
  <div className={`bg-ink/5 animate-pulse ${className}`} />
);

// src/components/skeleton/TrainerCardSkeleton.tsx
import { SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton';

export const TrainerCardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <SkeletonRect className="aspect-[4/5] w-full" />
    <div className="space-y-4">
      <div className="flex justify-between">
        <div className="space-y-2">
          <SkeletonLine width="w-36" className="h-6" />
          <SkeletonLine width="w-24" className="h-3" />
        </div>
        <SkeletonLine width="w-16" className="h-6" />
      </div>
      <SkeletonRect className="h-12 w-full" />
    </div>
  </div>
);
```

### Pattern 3: Actionable Error State Component

**What:** A reusable `ErrorState` component that replaces raw error messages with a structured display: icon, user-friendly title, descriptive message, and an action button (retry, go back, or navigate).

**When to use:** UXP-04. Use inline in pages where data loading fails (not as a replacement for ErrorBoundary, but as what ErrorBoundary renders, and what individual fetch-failure states show).

**Example:**

```typescript
// src/components/shared/ErrorState.tsx
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  backTo?: { label: string; path: string };
  icon?: React.ReactNode;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  backTo,
  icon,
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-6">
    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
      {icon || <AlertTriangle size={24} className="text-red-400" />}
    </div>
    <div className="space-y-2">
      <h3 className="text-xl serif font-light italic text-ink">{title}</h3>
      <p className="text-sm text-ink/50 max-w-md">{message}</p>
    </div>
    <div className="flex gap-4">
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 border border-ink/20 px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      )}
      {backTo && (
        <Link
          to={backTo.path}
          className="flex items-center gap-2 border border-ink/20 px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
        >
          <ArrowLeft size={14} />
          {backTo.label}
        </Link>
      )}
    </div>
  </div>
);
```

### Anti-Patterns to Avoid

- **Raw error.message in UI:** Never display `error.message` directly to users. Map Supabase/Stripe error codes to friendly messages. The current `ErrorBoundary` shows `this.state.error.message` in a monospace block -- replace with `ErrorState`.
- **Spinners for content-heavy pages:** A single spinner centered on screen provides no layout hint. Users experience layout shift when content loads. Skeletons match the content shape and prevent CLS (Cumulative Layout Shift).
- **Inconsistent error toast vs inline error:** Decide per-context: use toasts for background actions (cancel booking, flag review), use inline `ErrorState` for primary content that failed to load (trainer not found, bookings failed to fetch).
- **Animating every element:** Framer Motion is powerful but overuse causes jank on mobile. Only animate step transitions in the booking wizard and skeleton-to-content fade-in. Do not animate individual list items or card hover states beyond what CSS transitions already handle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image compression | Custom Canvas resize + quality loop | `browser-image-compression` (already in stack) | Handles EXIF rotation, Web Worker offloading, format detection. Edge cases around mobile camera EXIF orientation are notoriously buggy when hand-rolled. |
| Step animation | Manual CSS transition with `useState` + `setTimeout` | Framer Motion `AnimatePresence` | Exit animations are impossible with pure CSS transitions (element is removed before transition plays). `AnimatePresence` solves this. Already installed. |
| Skeleton shimmer effect | Custom CSS `@keyframes` with gradient | Tailwind `animate-pulse` | One class, maintained by Tailwind team, works everywhere. No custom CSS needed. |
| Image lazy loading | `IntersectionObserver` wrapper component | `loading="lazy"` HTML attribute | Native browser support in all modern browsers. Zero JS overhead. Falls back gracefully in older browsers (images just load eagerly). |
| Error message mapping | Inline switch statements per page | Centralized `mapErrorToMessage(error)` utility | Supabase errors have consistent shapes (`{ code, message, details }`). Map once, use everywhere. |

**Key insight:** Every UX polish item in this phase has a zero-dependency or already-installed solution. The discipline is in consistent application across the codebase, not in finding new libraries.

## Common Pitfalls

### Pitfall 1: Layout Shift from Skeleton to Content

**What goes wrong:** Skeleton has different dimensions than real content. When content loads, the page jumps.
**Why it happens:** Skeletons are built with approximate sizes, not matched to actual component dimensions.
**How to avoid:** Build each skeleton component by looking at the real component's CSS classes and matching them exactly. `TrainerCardSkeleton` must use the same `aspect-[4/5]` as `TrainerCard`'s image container.
**Warning signs:** Content loading causes visible "jump" or scroll position change.

### Pitfall 2: Framer Motion Re-Render Performance

**What goes wrong:** `AnimatePresence` triggers re-render of all children when `key` changes, causing sluggish transitions on lower-end devices.
**Why it happens:** Using complex children inside `motion.div` without memoization.
**How to avoid:** Use `mode="wait"` on `AnimatePresence` (not `mode="sync"`) so the old step exits before the new one enters. Keep step components relatively simple -- the `StepPayment` component wraps Stripe Elements which is already heavy, so keep the transition duration short (200-250ms).
**Warning signs:** Animation stutter on iPhone SE or budget Android devices.

### Pitfall 3: Error Retry Without Resetting State

**What goes wrong:** User clicks "Try Again" but the component still shows stale error data or doesn't re-trigger the fetch.
**Why it happens:** `onRetry` callback doesn't clear the error state before re-fetching.
**How to avoid:** The retry handler must: (1) set `error` to `null`, (2) set `loading` to `true`, (3) then call the fetch function. This triggers skeleton display, then either success or error again.
**Warning signs:** Clicking retry does nothing visible, or error message stays while data loads behind it.

### Pitfall 4: Booking Wizard State Lost on Browser Back

**What goes wrong:** User is on Step 3 (Payment), hits browser back button, lands on the previous page instead of Step 2.
**Why it happens:** The wizard uses React state for step tracking, not URL state.
**How to avoid:** Either: (a) use `useSearchParams` to store current step in URL (`?step=payment`), or (b) accept this behavior and document it as intentional (most payment flows do NOT support browser back to avoid partial-payment states). For this app, option (b) is recommended -- the existing flow already handles "back from payment" by cancelling the booking.
**Warning signs:** Users report being confused when back button takes them away from booking entirely.

### Pitfall 5: Over-Compressing Already-Optimized Images

**What goes wrong:** Applying `browser-image-compression` to images that are already small, resulting in quality degradation without size benefit.
**Why it happens:** Compression runs on all images regardless of size.
**How to avoid:** Only compress if `file.size > 200 * 1024` (200KB). The existing Phase 18 avatar upload already uses this library with a 400x400 target. For UXP-02, the concern is serving images optimally, not re-compressing existing uploads.
**Warning signs:** Avatar images look pixelated or washed out after "optimization."

## Code Examples

### Image Optimization with Lazy Loading

```typescript
// Apply to all <img> tags across the app
// Before:
<img src={trainer.imageUrl} alt={name} className="w-full h-full object-cover" />

// After:
<img
  src={trainer.imageUrl}
  alt={name}
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover"
/>

// For Unsplash fallback URLs, add width parameter:
const optimizedUrl = (url: string, width = 800) => {
  if (url.includes('unsplash.com')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}w=${width}&q=80&auto=format`;
  }
  return url;
};
```

### Error Message Mapping Utility

```typescript
// src/lib/errorMessages.ts
interface AppError {
  title: string;
  message: string;
  recoverable: boolean;
}

export function mapError(error: unknown): AppError {
  if (error instanceof Error) {
    // Supabase errors
    if (error.message.includes('JWT')) {
      return {
        title: 'Session expired',
        message: 'Your session has expired. Please sign in again to continue.',
        recoverable: false,
      };
    }
    if (error.message.includes('row-level security')) {
      return {
        title: 'Access denied',
        message: 'You do not have permission to perform this action.',
        recoverable: false,
      };
    }
    if (error.message.includes('duplicate key')) {
      return {
        title: 'Already exists',
        message: 'This item already exists. Please check and try again.',
        recoverable: false,
      };
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return {
        title: 'Connection problem',
        message: 'Could not reach the server. Check your internet connection and try again.',
        recoverable: true,
      };
    }
  }

  return {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
    recoverable: true,
  };
}
```

### Skeleton-to-Content Transition

```typescript
// Use Framer Motion for smooth skeleton-to-content transition
import { AnimatePresence, motion } from 'framer-motion';
import { TrainerCardSkeleton } from '@/components/skeleton/TrainerCardSkeleton';

// In SearchSection or any list view:
{loading ? (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    {Array.from({ length: 6 }).map((_, i) => (
      <TrainerCardSkeleton key={i} />
    ))}
  </div>
) : (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
  >
    {trainers.map((t) => (
      <TrainerCard key={t.id} trainer={t} />
    ))}
  </motion.div>
)}
```

## Inventory: Current Spinner Locations

All locations where spinners need to be replaced with skeletons:

| File | Line(s) | Context | Skeleton Shape Needed |
|------|---------|---------|----------------------|
| `BookSession.tsx` | 296-300 | Full-page loading for slot data | Booking form skeleton (trainer card + session details + price breakdown) |
| `TrainerProfile.tsx` | 222-227 | Full-page loading for trainer data | Profile skeleton (left column photo + right column details) |
| `TrainerProfile.tsx` | 408-410 | Slots section loading | Slot list skeleton (date headers + time pill grid) |
| `Login.tsx` | 47-51 | Auth state loading | Simple centered skeleton (or keep spinner -- login is fast) |
| `ClientPassport.tsx` | 189-193 | Profile data loading | Form skeleton (avatar circle + input fields) |
| `ClientOnboarding.tsx` | 463 | Step loading | Keep spinner -- transient submitting state, not content load |
| `SearchSection.tsx` | (uses `loading` from hook) | Trainer grid loading | 6x TrainerCardSkeleton in grid |
| `ClientDashboard.tsx` | (no spinner, but no loading state) | Dashboard loads counts | 3x stat card skeletons |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Centered spinner for all loading | Skeleton screens matching content shape | 2020+ (widely adopted) | Reduces perceived load time by 30-40%. Prevents layout shift. |
| Generic "Error occurred" messages | Actionable error states with recovery paths | 2022+ (design systems matured) | Users recover from errors without contacting support. |
| `<img>` with no optimization | `loading="lazy"` + `decoding="async"` | 2019 (Chrome 76, now universal) | Reduces initial page load by deferring offscreen images. |
| Custom wizard step indicators | Framer Motion `AnimatePresence` with numbered steps | Ongoing (Framer Motion 12) | Smooth transitions without manual CSS keyframe management. |

**Deprecated/outdated:**
- Manual `IntersectionObserver` for lazy loading: Use `loading="lazy"` unless you need animation hooks on image enter.
- `react-loading-skeleton` package: Tailwind `animate-pulse` achieves the same with zero deps.

## Open Questions

1. **Booking wizard: keep payment step or simplify?**
   - What we know: Current flow has 4 steps (review, confirm, payment, success). When Stripe is not configured, payment step is skipped.
   - What's unclear: Should the progress indicator show 4 steps or 3 when Stripe is not configured?
   - Recommendation: Dynamically compute step count. Show 3 steps when `!STRIPE_CONFIGURED`, 4 when configured. The step array is already conditional in the existing code.

2. **Image srcset for Supabase Storage uploads**
   - What we know: Supabase Image Transformations require Pro plan. The app may be on Free tier.
   - What's unclear: Whether Supabase project is on Pro plan.
   - Recommendation: Only apply `srcset` to Unsplash fallback URLs (which support `w=` parameter). For Supabase Storage images, serve the single compressed upload as-is. Phase 18 already compresses to 400x400 before upload.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + React Testing Library 16.3.2 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements --> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UXP-01 | Booking wizard renders progress indicator and navigates steps | unit | `npx vitest run src/components/booking/BookingWizard.test.tsx -x` | Wave 0 |
| UXP-02 | Images have loading="lazy" attribute; optimizedUrl adds width param | unit | `npx vitest run src/lib/imageUtils.test.ts -x` | Wave 0 |
| UXP-03 | Skeleton components render with animate-pulse class | unit | `npx vitest run src/components/shared/Skeleton.test.tsx -x` | Wave 0 |
| UXP-04 | ErrorState renders title, message, retry button; retry calls handler | unit | `npx vitest run src/components/shared/ErrorState.test.tsx -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/booking/BookingWizard.test.tsx` -- covers UXP-01
- [ ] `src/lib/imageUtils.test.ts` -- covers UXP-02
- [ ] `src/components/shared/Skeleton.test.tsx` -- covers UXP-03
- [ ] `src/components/shared/ErrorState.test.tsx` -- covers UXP-04

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `BookSession.tsx` (628 lines, 4-step state machine, inline rendering)
- Codebase inspection: `ErrorBoundary.tsx` (51 lines, shows raw error.message)
- Codebase inspection: `TrainerCard.tsx`, `TrainerProfile.tsx`, `SearchSection.tsx` (image patterns, spinner locations)
- Codebase inspection: `package.json` (framer-motion 12.35.2, tailwindcss 4.2.1, lucide-react confirmed)
- Codebase inspection: `vite.config.ts` (Vitest configuration confirmed)
- `.planning/research/STACK.md` (browser-image-compression 2.0.2, existing stack decisions)

### Secondary (MEDIUM confidence)

- Framer Motion `AnimatePresence` API: well-documented, standard pattern for step transitions
- Tailwind `animate-pulse`: built-in utility, confirmed in Tailwind v4 docs
- HTML `loading="lazy"`: universally supported in modern browsers (Chrome 76+, Firefox 75+, Safari 15.4+)

### Tertiary (LOW confidence)

- None. All findings verified against existing codebase and installed packages.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, no new dependencies needed
- Architecture: HIGH -- patterns derived from existing codebase structure and verified Framer Motion API
- Pitfalls: HIGH -- derived from actual code inspection (spinner locations, error handling patterns)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable -- no fast-moving dependencies)
