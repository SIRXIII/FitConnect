import { AlertCircle } from 'lucide-react';
import { computeBookingPricing } from '@/lib/pricing';
import type { SlotWithTrainer } from './BookingWizard';

interface StepConfirmProps {
  slot: SlotWithTrainer;
  notes: string;
  onConfirm: () => Promise<void>;
  onBack: () => void;
  loading: boolean;
  baseRate: number;
  discountPct: number;
  rate: number;
  displayRate: number;
  referralDiscountPending: boolean;
  platformFeePct: number;
  paymentError: string | null;
  stripeConfigured: boolean;
  bookingMode?: 'instant' | 'request';
}

export const StepConfirm: React.FC<StepConfirmProps> = ({
  slot,
  notes,
  onConfirm,
  onBack,
  loading,
  baseRate,
  discountPct,
  rate,
  displayRate,
  referralDiscountPending,
  platformFeePct,
  paymentError,
  stripeConfigured,
  bookingMode,
}) => {
  // Fee-on-top: the platform fee is added to the rate, so the client's total is rate + fee.
  const { platformFee, rateCharged } = computeBookingPricing(displayRate, platformFeePct);
  const trainerName = slot.trainer_profiles.profiles?.full_name || 'Trainer';
  const startTime = new Date(slot.start_time);
  const endTime = new Date(slot.end_time);

  return (
    <div className="space-y-8">
      {/* Session summary */}
      <div className="border border-ink/10 p-6 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
          Session Summary
        </p>
        <p className="text-sm font-medium text-ink">{trainerName}</p>
        <p className="text-[10px] text-ink/40">
          {startTime.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}{' '}
          {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} -{' '}
          {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
        {notes && (
          <p className="text-xs text-ink/40 italic mt-2">Notes: {notes}</p>
        )}
      </div>

      {/* Pricing breakdown */}
      <div className="border border-ink/10 p-6 space-y-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
          Pricing Breakdown
        </p>
        {discountPct > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink/50">Original Rate</span>
            <span className="text-sm text-ink/30 line-through">${baseRate}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink/50">
            {discountPct > 0 ? `Session Rate (${discountPct}% off)` : 'Optimized Rate'}
          </span>
          <span className="text-sm text-accent">${rate}</span>
        </div>
        {referralDiscountPending && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink/50">Referral Discount</span>
            <span className="text-sm text-green-600">-$5.00</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink/50">
            Platform Fee ({Math.round(platformFeePct * 100)}%)
          </span>
          <span className="text-sm">${platformFee.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-ink/10 pt-4">
          <span className="text-sm font-medium">Total</span>
          <span className="text-xl serif font-light text-accent">${rateCharged.toFixed(2)}</span>
        </div>
      </div>

      {paymentError && (
        <div className="flex items-center gap-2 text-red-500 text-sm border border-red-200 bg-red-50 p-4">
          <AlertCircle size={16} className="shrink-0" />
          {paymentError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          disabled={loading}
          className="border border-ink/20 px-8 py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink/5 transition-all duration-300 disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-accent text-white py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent/90 transition-all duration-300 disabled:opacity-50"
        >
          {loading
            ? 'Processing...'
            : bookingMode === 'request'
              ? 'Request to Book'
              : stripeConfigured
                ? 'Continue to Payment'
                : 'Confirm Booking'}
        </button>
      </div>

      <p className="text-[10px] text-ink/30 text-center">
        {stripeConfigured
          ? 'Your payment is secured by Stripe. You can cancel free of charge up to 24 hours before the session.'
          : 'Payment will be collected after the trainer confirms your booking. You can cancel free of charge up to 24 hours before the session.'}
      </p>
    </div>
  );
};
