import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookingWizard } from './BookingWizard';

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const mockSlot = {
  id: 'slot-1',
  trainer_id: 'trainer-1',
  start_time: '2026-03-20T10:00:00Z',
  end_time: '2026-03-20T11:00:00Z',
  is_booked: false,
  trainer_profiles: {
    id: 'trainer-1',
    user_id: 'user-1',
    specialty: 'strength_training',
    optimized_rate: '60',
    discount_percentage: 10,
    location: 'Brooklyn, NY',
    bio: 'Great trainer',
    profiles: {
      full_name: 'John Doe',
      avatar_url: 'https://example.com/avatar.jpg',
    },
  },
} as any;

const defaultProps = {
  slot: mockSlot,
  onComplete: vi.fn(),
  stripeConfigured: true,
  handleBooking: vi.fn().mockResolvedValue('booking-1'),
  createPaymentIntent: vi.fn().mockResolvedValue('pi_secret_123'),
  platformFeePct: 0.08,
  referralDiscountPending: false,
};

const renderWizard = (props = {}) =>
  render(
    <MemoryRouter>
      <BookingWizard {...defaultProps} {...props} />
    </MemoryRouter>
  );

describe('BookingWizard', () => {
  it('renders ProgressIndicator with step labels', () => {
    renderWizard();
    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Complete')).toBeTruthy();
  });

  it('first step (Review) is highlighted as current', () => {
    const { container } = renderWizard();
    const stepCircles = container.querySelectorAll('[data-testid="step-circle"]');
    expect(stepCircles[0]?.className).toContain('bg-accent');
    // Step 2 circle should NOT have bg-accent (future)
    expect(stepCircles[1]?.className).not.toContain('bg-accent');
  });

  it('shows "Review", "Confirm", "Payment", "Complete" when Stripe configured', () => {
    renderWizard({ stripeConfigured: true });
    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Payment')).toBeTruthy();
    expect(screen.getByText('Complete')).toBeTruthy();
  });

  it('shows "Review", "Confirm", "Complete" when Stripe NOT configured', () => {
    renderWizard({ stripeConfigured: false });
    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Complete')).toBeTruthy();
    expect(screen.queryByText('Payment')).toBeNull();
  });

  it('renders step content inside a motion.div container', () => {
    renderWizard();
    // StepReview shows trainer name
    expect(screen.getByText('John Doe')).toBeTruthy();
  });
});
