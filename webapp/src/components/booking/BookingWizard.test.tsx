import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookingWizard } from './BookingWizard';

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// BookingWizard fires a best-effort GCal sync via supabase.functions.invoke on booking.
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) } },
}));

// StepPayment renders through Stripe's <Elements>, which needs a real publishable
// key to mount in tests. Stand in a minimal fake so we can drive the Back button.
vi.mock('./StepPayment', () => ({
  StepPayment: ({ amount, onBack }: { amount: number; onBack: () => void }) => (
    <div>
      <span>Payment Amount: {amount}</span>
      <button onClick={onBack}>Payment Back</button>
    </div>
  ),
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

const mockServerQuote = { rate_charged: 54, platform_fee: 7.02, total: 61.02, trainer_payout: 54 };

const defaultProps = {
  slot: mockSlot,
  onComplete: vi.fn(),
  stripeConfigured: true,
  handleBooking: vi.fn().mockResolvedValue({ bookingId: 'booking-1', quote: mockServerQuote }),
  createPaymentIntent: vi.fn().mockResolvedValue('pi_secret_123'),
  platformFeePct: 0.13,
  referralDiscountPending: false,
  PaymentFormComponent: () => null,
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

  it('Confirm step Total shows the session price plus platform fee, not the bare rate', () => {
    renderWizard();
    fireEvent.click(screen.getByText('Continue to Confirm'));
    // $60 rate, 10% trainer discount -> $54 session price, 13% fee -> $7.02, total $61.02
    expect(screen.getByText('$54')).toBeTruthy();
    expect(screen.getByText('$61.02')).toBeTruthy();
  });

  it('Back from Payment returns to Confirm and reuses the booking instead of calling handleBooking again', async () => {
    const handleBooking = vi.fn().mockResolvedValue({ bookingId: 'booking-1', quote: mockServerQuote });
    const createPaymentIntent = vi.fn().mockResolvedValue('pi_secret_123');
    renderWizard({ handleBooking, createPaymentIntent });

    fireEvent.click(screen.getByText('Continue to Confirm'));
    fireEvent.click(screen.getByText('Continue to Payment'));

    await waitFor(() => expect(screen.getByText('Payment Back')).toBeTruthy());
    expect(handleBooking).toHaveBeenCalledTimes(1);
    expect(createPaymentIntent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Payment Back'));
    await waitFor(() => expect(screen.getByText('Continue to Payment')).toBeTruthy());

    fireEvent.click(screen.getByText('Continue to Payment'));
    await waitFor(() => expect(createPaymentIntent).toHaveBeenCalledTimes(2));

    // handleBooking is NOT called a second time -- the existing booking is reused.
    expect(handleBooking).toHaveBeenCalledTimes(1);
  });
});
