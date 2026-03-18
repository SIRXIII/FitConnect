import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { StepReview } from './StepReview';
import { StepConfirm } from './StepConfirm';
import { StepPayment } from './StepPayment';
import { StepSuccess } from './StepSuccess';
import type { AvailabilitySlot } from '@/hooks/useAvailability';
import type { TrainerProfile } from '@/stores/auth';

export interface SlotWithTrainer extends AvailabilitySlot {
  trainer_profiles: TrainerProfile & {
    profiles: {
      full_name: string;
      avatar_url: string | null;
    };
  };
}

interface BookingWizardProps {
  slot: SlotWithTrainer;
  onComplete: () => void;
  stripeConfigured: boolean;
  handleBooking: (notes: string) => Promise<string | null>;
  createPaymentIntent: (bookingId: string) => Promise<string | null>;
  platformFeePct: number;
  referralDiscountPending: boolean;
}

const stepVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

interface ProgressIndicatorProps {
  steps: string[];
  currentIndex: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ steps, currentIndex }) => (
  <div className="flex items-center justify-between mb-12">
    {steps.map((label, i) => (
      <div key={label} className="flex items-center">
        <div className="flex flex-col items-center">
          <div
            data-testid="step-circle"
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

export const BookingWizard: React.FC<BookingWizardProps> = ({
  slot,
  onComplete,
  stripeConfigured,
  handleBooking,
  createPaymentIntent,
  platformFeePct,
  referralDiscountPending,
}) => {
  const steps = useMemo(
    () => ['Review', 'Confirm', ...(stripeConfigured ? ['Payment'] : []), 'Complete'],
    [stripeConfigured]
  );

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const goNext = () => setCurrentStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setCurrentStepIndex((i) => Math.max(i - 1, 0));

  const trainerData = slot.trainer_profiles;
  const trainerName = trainerData.profiles?.full_name || 'Trainer';
  const baseRate = Number(trainerData.optimized_rate);
  const discountPct = trainerData.discount_percentage ?? 0;
  const rate =
    discountPct > 0
      ? Math.round(baseRate * (1 - discountPct / 100) * 100) / 100
      : baseRate;
  const displayRate = referralDiscountPending ? Math.max(0, rate - 5) : rate;

  const handleConfirm = async () => {
    setLoading(true);
    setPaymentError(null);

    const newBookingId = await handleBooking(notes);
    if (!newBookingId) {
      setLoading(false);
      setPaymentError('Booking failed. The session may no longer be available.');
      return;
    }

    setBookingId(newBookingId);

    if (stripeConfigured) {
      const secret = await createPaymentIntent(newBookingId);
      if (!secret) {
        setLoading(false);
        setPaymentError('Payment setup failed. The session is still available -- please try again.');
        return;
      }
      setClientSecret(secret);
      goNext(); // -> Payment step
    } else {
      goNext(); // -> Complete step (skipping Payment)
    }

    setLoading(false);
  };

  const handlePaymentSuccess = () => {
    goNext(); // -> Complete step
  };

  const handlePaymentBack = () => {
    // Go back to confirm step
    setCurrentStepIndex(steps.indexOf('Confirm'));
  };

  const currentStepName = steps[currentStepIndex];

  const renderStep = () => {
    switch (currentStepName) {
      case 'Review':
        return (
          <StepReview
            slot={slot}
            notes={notes}
            onNotesChange={setNotes}
            onNext={goNext}
          />
        );
      case 'Confirm':
        return (
          <StepConfirm
            slot={slot}
            notes={notes}
            onConfirm={handleConfirm}
            onBack={goBack}
            loading={loading}
            baseRate={baseRate}
            discountPct={discountPct}
            rate={rate}
            displayRate={displayRate}
            referralDiscountPending={referralDiscountPending}
            platformFeePct={platformFeePct}
            paymentError={paymentError}
            stripeConfigured={stripeConfigured}
          />
        );
      case 'Payment':
        return clientSecret ? (
          <StepPayment
            clientSecret={clientSecret}
            amount={displayRate}
            onSuccess={handlePaymentSuccess}
            onBack={handlePaymentBack}
          />
        ) : null;
      case 'Complete':
        return (
          <StepSuccess
            trainerName={trainerName}
            sessionDate={slot.start_time}
            sessionEndDate={slot.end_time}
            rate={rate}
            stripeConfigured={stripeConfigured}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl serif font-light italic text-ink">Book Session</h1>
        <p className="text-xs uppercase tracking-[0.3em] text-ink/40">
          {currentStepName === 'Review'
            ? 'Review Details'
            : currentStepName === 'Confirm'
              ? 'Confirm Booking'
              : currentStepName === 'Payment'
                ? 'Payment'
                : 'Confirmed'}
        </p>
      </div>

      <ProgressIndicator steps={steps} currentIndex={currentStepIndex} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
