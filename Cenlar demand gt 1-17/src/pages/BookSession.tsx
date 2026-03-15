import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, ArrowLeft, Check, CreditCard, AlertCircle } from 'lucide-react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { stripePromise, STRIPE_CONFIGURED } from '@/lib/stripe';
import { useAuthStore } from '@/stores/auth';
import { formatSpecialty } from '@/types';
import type { AvailabilitySlot } from '@/hooks/useAvailability';
import type { TrainerProfile } from '@/stores/auth';

interface SlotWithTrainer extends AvailabilitySlot {
  trainer_profiles: TrainerProfile & {
    profiles: {
      full_name: string;
      avatar_url: string | null;
    };
  };
}

type BookingStep = 'review' | 'confirm' | 'payment' | 'success';

// --- Payment Form Component (used inside <Elements>) ---
const PaymentForm: React.FC<{
  onSuccess: () => void;
  onBack: () => void;
  amount: number;
}> = ({ onSuccess, onBack, amount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/client/bookings`,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Payment failed. Please try again.');
      setProcessing(false);
      return;
    }

    // Payment succeeded without redirect
    onSuccess();
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="border border-ink/10 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard size={14} className="text-accent" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
            Payment Details
          </p>
        </div>
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm border border-red-200 bg-red-50 p-4">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={processing}
          className="border border-ink/20 px-8 py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink/5 transition-all duration-300 disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 bg-accent text-white py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent/90 transition-all duration-300 disabled:opacity-50"
        >
          {processing ? 'Processing...' : `Pay $${amount}`}
        </button>
      </div>

      <p className="text-[10px] text-ink/30 text-center">
        Your payment is secured by Stripe. You can cancel free of charge up to 24 hours before the session.
      </p>
    </form>
  );
};

// --- Main BookSession Component ---
const BookSession: React.FC = () => {
  const { slotId } = useParams<{ slotId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [slot, setSlot] = useState<SlotWithTrainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<BookingStep>('review');
  const [notes, setNotes] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [platformFeePct, setPlatformFeePct] = useState(0.08);
  const [referralDiscountPending, setReferralDiscountPending] = useState(false);

  useEffect(() => {
    if (!slotId) return;

    const fetchSlot = async () => {
      const [{ data: slotData }, { data: feeSettings }] = await Promise.all([
        supabase
          .from('availability_slots')
          .select(`
            *,
            trainer_profiles!availability_slots_trainer_id_fkey (
              *,
              profiles!trainer_profiles_user_id_fkey (full_name, avatar_url)
            )
          `)
          .eq('id', slotId)
          .single(),
        supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'platform_fee_pct')
          .single(),
      ]);

      setSlot(slotData as unknown as SlotWithTrainer | null);
      if (feeSettings?.value) {
        const parsed = parseFloat(feeSettings.value);
        if (!isNaN(parsed)) setPlatformFeePct(parsed);
      }
      setLoading(false);
    };

    fetchSlot();
  }, [slotId]);

  useEffect(() => {
    if (!user) return;
    const checkDiscount = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('referral_discount_pending')
        .eq('id', user.id)
        .single();
      setReferralDiscountPending(data?.referral_discount_pending ?? false);
    };
    checkDiscount();
  }, [user?.id]);

  // Step 1 → 2: Create booking in DB
  const handleBooking = async () => {
    if (!slot || !user || !profile) return;

    setSubmitting(true);
    setPaymentError(null);

    const trainerProfile = slot.trainer_profiles;
    const baseRate = Number(trainerProfile.optimized_rate);
    const discountPct = trainerProfile.discount_percentage ?? 0;
    const rate = discountPct > 0
      ? Math.round(baseRate * (1 - discountPct / 100) * 100) / 100
      : baseRate;

    // Check for referral discount
    let finalRate = rate;
    let hadReferralDiscount = false;

    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('referral_discount_pending')
      .eq('id', user.id)
      .single();

    if (clientProfile?.referral_discount_pending) {
      finalRate = Math.max(0, rate - 5);
      hadReferralDiscount = true;
    }

    const platformFee = Math.round(finalRate * platformFeePct * 100) / 100;
    const trainerPayout = Math.round((finalRate - platformFee) * 100) / 100;

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        client_id: user.id,
        trainer_id: trainerProfile.id,
        slot_id: slot.id,
        status: 'pending',
        rate_charged: finalRate,
        platform_fee: platformFee,
        trainer_payout: trainerPayout,
        notes: notes || null,
      })
      .select('id')
      .single();

    if (error) {
      setSubmitting(false);
      setPaymentError('Booking failed. The session may no longer be available.');
      return;
    }

    setBookingId(data.id);

    // Clear referral discount flag immediately after booking insert
    if (hadReferralDiscount) {
      await supabase
        .from('profiles')
        .update({ referral_discount_pending: false, referral_discount_trainer_id: null })
        .eq('id', user.id);
    }

    // If Stripe is configured, create a payment intent
    if (STRIPE_CONFIGURED) {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ booking_id: data.id }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create payment');
        }

        setClientSecret(result.clientSecret);
        setStep('payment');
      } catch (err) {
        // Payment intent failed — delete the orphaned pending booking immediately
        await supabase.from('bookings').delete().eq('id', data.id);
        setBookingId(null);
        toast.error('Payment setup failed. The session is still available — please try again.');
        setPaymentError(
          'Payment setup failed. The session is still available — please try again.'
        );
      }
    } else {
      // No Stripe configured — skip payment, go to success
      setStep('success');
    }

    setSubmitting(false);
  };

  const handlePaymentSuccess = () => {
    setStep('success');
  };

  const handlePaymentBack = async () => {
    // Cancel the booking if going back from payment
    if (bookingId) {
      await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancellation_reason: 'Client cancelled during payment' })
        .eq('id', bookingId);
    }
    setBookingId(null);
    setClientSecret(null);
    setStep('confirm');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-6 h-6 border border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!slot || slot.is_booked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper pt-32">
        <div className="text-center space-y-6">
          <h2 className="text-3xl serif font-light italic text-ink">Session unavailable</h2>
          <p className="text-sm text-ink/40">This session has already been booked or is no longer available.</p>
          <Link
            to="/trainers"
            className="inline-block border border-ink/20 px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
          >
            Browse Trainers
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper pt-32">
        <div className="text-center space-y-6">
          <h2 className="text-3xl serif font-light italic text-ink">Sign in to book</h2>
          <p className="text-sm text-ink/40">Create an account to book sessions with trainers.</p>
          <Link
            to="/login"
            className="inline-block bg-ink text-white px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-all duration-300"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const trainerData = slot.trainer_profiles;
  const trainerName = trainerData.profiles?.full_name || 'Trainer';
  const startTime = new Date(slot.start_time);
  const endTime = new Date(slot.end_time);
  const baseRate = Number(trainerData.optimized_rate);
  const discountPct = trainerData.discount_percentage ?? 0;
  const rate = discountPct > 0
    ? Math.round(baseRate * (1 - discountPct / 100) * 100) / 100
    : baseRate;
  const displayRate = referralDiscountPending ? Math.max(0, rate - 5) : rate;
  const platformFee = Math.round(displayRate * platformFeePct * 100) / 100;
  const total = displayRate;

  // Success state
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
        <div className="max-w-lg mx-auto text-center space-y-8">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <Check size={28} className="text-accent" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl serif font-light italic text-ink">
              {STRIPE_CONFIGURED ? 'Booking Confirmed' : 'Session Requested'}
            </h1>
            <p className="text-sm text-ink/50">
              {STRIPE_CONFIGURED
                ? `Your session with ${trainerName} has been booked and payment processed.`
                : `Your booking request has been sent to ${trainerName}. You'll be notified once they confirm.`}
            </p>
          </div>

          {paymentError && (
            <div className="flex items-center gap-2 text-amber-600 text-sm border border-amber-200 bg-amber-50 p-4 text-left">
              <AlertCircle size={16} className="shrink-0" />
              {paymentError}
            </div>
          )}

          <div className="border border-ink/10 p-6 text-left space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">Booking Details</p>
            <div className="flex items-center gap-2 text-sm text-ink/70">
              <Calendar size={14} />
              {startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-2 text-sm text-ink/70">
              <Clock size={14} />
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} -{' '}
              {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
            <p className="text-lg serif font-light text-accent">${rate}</p>
          </div>
          <div className="flex gap-4 justify-center">
            <Link
              to="/client/dashboard"
              className="border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
            >
              My Dashboard
            </Link>
            <Link
              to="/trainers"
              className="border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
            >
              Browse More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Payment step (Stripe Elements)
  if (step === 'payment' && clientSecret && stripePromise) {
    return (
      <div className="min-h-screen bg-paper pt-28 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="space-y-10">
            <div className="space-y-2">
              <h1 className="text-3xl serif font-light italic text-ink">Book Session</h1>
              <p className="text-xs uppercase tracking-[0.3em] text-ink/40">Payment</p>
            </div>

            {/* Compact session summary */}
            <div className="border border-ink/10 p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-ink">{trainerName}</p>
                <p className="text-[10px] text-ink/40">
                  {startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' '}
                  {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
              <p className="text-xl serif font-light text-accent">${total}</p>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'flat',
                  variables: {
                    colorPrimary: '#C5A059',
                    colorBackground: '#FDFCFB',
                    colorText: '#1A1A1A',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    borderRadius: '0px',
                  },
                },
              }}
            >
              <PaymentForm
                onSuccess={handlePaymentSuccess}
                onBack={handlePaymentBack}
                amount={total}
              />
            </Elements>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pt-28 pb-20 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ink/40 hover:text-ink transition-colors mb-12"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <div className="space-y-10">
          <div className="space-y-2">
            <h1 className="text-3xl serif font-light italic text-ink">Book Session</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/40">
              {step === 'review' ? 'Review Details' : 'Confirm Booking'}
            </p>
          </div>

          {/* Trainer info */}
          <div className="flex items-center gap-6 border border-ink/10 p-6">
            {trainerData.profiles?.avatar_url ? (
              <img
                src={trainerData.profiles.avatar_url}
                alt={trainerName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-ink/5 flex items-center justify-center text-2xl serif text-ink/20">
                {trainerName.charAt(0)}
              </div>
            )}
            <div className="space-y-1">
              <h2 className="text-xl serif font-light text-ink">{trainerName}</h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                {formatSpecialty(trainerData.specialty)}
              </p>
              {trainerData.location && (
                <div className="flex items-center gap-1 text-[10px] text-ink/30">
                  <MapPin size={10} />
                  {trainerData.location}
                </div>
              )}
            </div>
          </div>

          {/* Session details */}
          <div className="border border-ink/10 divide-y divide-ink/5">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-accent" />
                <span className="text-sm">
                  {startTime.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-accent" />
                <span className="text-sm">
                  {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} -{' '}
                  {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <div className="p-6 space-y-4">
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
                <span className="text-sm text-ink/50">Platform Fee ({Math.round(platformFeePct * 100)}%)</span>
                <span className="text-sm">${platformFee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-ink/10 pt-4">
                <span className="text-sm font-medium">Total</span>
                <span className="text-xl serif font-light text-accent">${total}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {step === 'review' && (
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
                Notes for trainer (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific goals, injuries, or preferences..."
                rows={3}
                className="w-full border border-ink/10 p-4 text-sm bg-transparent focus:outline-none focus:border-accent transition-colors resize-none placeholder:text-ink/20"
              />
            </div>
          )}

          {paymentError && (
            <div className="flex items-center gap-2 text-red-500 text-sm border border-red-200 bg-red-50 p-4">
              <AlertCircle size={16} className="shrink-0" />
              {paymentError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            {step === 'review' ? (
              <button
                onClick={() => setStep('confirm')}
                className="flex-1 bg-ink text-white py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-all duration-300"
              >
                Continue to Confirm
              </button>
            ) : (
              <>
                <button
                  onClick={() => setStep('review')}
                  className="border border-ink/20 px-8 py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink/5 transition-all duration-300"
                >
                  Back
                </button>
                <button
                  onClick={handleBooking}
                  disabled={submitting}
                  className="flex-1 bg-accent text-white py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent/90 transition-all duration-300 disabled:opacity-50"
                >
                  {submitting
                    ? 'Processing...'
                    : STRIPE_CONFIGURED
                      ? 'Continue to Payment'
                      : 'Confirm Booking'}
                </button>
              </>
            )}
          </div>

          <p className="text-[10px] text-ink/30 text-center">
            {STRIPE_CONFIGURED
              ? 'Your payment is secured by Stripe. You can cancel free of charge up to 24 hours before the session.'
              : 'Payment will be collected after the trainer confirms your booking. You can cancel free of charge up to 24 hours before the session.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BookSession;
