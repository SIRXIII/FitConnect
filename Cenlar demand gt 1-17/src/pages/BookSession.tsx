import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, AlertCircle } from 'lucide-react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { STRIPE_CONFIGURED } from '@/lib/stripe';
import { useAuthStore } from '@/stores/auth';
import { SkeletonLine, SkeletonRect } from '@/components/shared/Skeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { BookingWizard } from '@/components/booking/BookingWizard';
import type { SlotWithTrainer } from '@/components/booking/BookingWizard';

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
  const { user } = useAuthStore();
  const [slot, setSlot] = useState<SlotWithTrainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFeePct, setPlatformFeePct] = useState(0.08);
  const [referralDiscountPending, setReferralDiscountPending] = useState(false);
  const [bookedSlotIds, setBookedSlotIds] = useState<string[]>([]);

  const fetchSlot = useCallback(async () => {
    if (!slotId) return;
    setLoading(true);
    setError(null);

    try {
      const [{ data: slotData, error: slotError }, { data: feeSettings }] = await Promise.all([
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

      if (slotError) throw slotError;

      setSlot(slotData as unknown as SlotWithTrainer | null);
      if (feeSettings?.value) {
        const parsed = parseFloat(feeSettings.value);
        if (!isNaN(parsed)) setPlatformFeePct(parsed);
      }
    } catch {
      setError('Failed to load session details.');
    } finally {
      setLoading(false);
    }
  }, [slotId]);

  useEffect(() => {
    fetchSlot();
  }, [fetchSlot]);

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

  // Realtime slot greying — subscribe to availability_slots updates for this trainer
  useEffect(() => {
    const trainerProfile = slot?.trainer_profiles;
    if (!trainerProfile?.id) return;

    const slotChannel = supabase
      .channel(`slot-realtime-${trainerProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'availability_slots',
          filter: `trainer_id=eq.${trainerProfile.id}`,
        },
        (payload) => {
          if (payload.new.is_booked) {
            setBookedSlotIds((prev) => [...new Set([...prev, payload.new.id as string])]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(slotChannel);
    };
  }, [slot?.trainer_profiles?.id]);

  // Create booking in DB -- returns booking ID or null on failure
  const handleBooking = useCallback(async (notes: string): Promise<string | null> => {
    if (!slot || !user) return null;

    const trainerProfile = slot.trainer_profiles;
    const baseRate = Number(trainerProfile.optimized_rate);
    const discountPct = trainerProfile.discount_percentage ?? 0;
    const rate = discountPct > 0
      ? Math.round(baseRate * (1 - discountPct / 100) * 100) / 100
      : baseRate;

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

    // Request to Book mode — insert into booking_requests instead of direct booking
    const isRequestMode = trainerProfile.booking_mode === 'request';
    if (isRequestMode) {
      const { error: requestError } = await supabase.from('booking_requests').insert({
        trainer_id: trainerProfile.id,
        client_id: user.id,
        slot_id: slot.id,
      });
      if (requestError) {
        toast.error('Failed to send request. Please try again.');
        return null;
      }
      toast.success('Request sent! The trainer will review it shortly.');
      navigate('/client/bookings');
      return null;
    }

    // Instant Book mode — atomic RPC to prevent double-booking
    const { data, error } = await supabase.rpc('create_booking_atomic', {
      p_slot_id: slot.id,
      p_client_id: user.id,
      p_trainer_id: trainerProfile.id,
      p_rate_charged: finalRate,
      p_platform_fee: platformFee,
      p_trainer_payout: trainerPayout,
      p_notes: notes || null,
    });

    if (error) {
      toast.error('Connection lost. Check your signal and try again.');
      return null;
    }

    if (data?.error === 'slot_taken') {
      toast.error('This slot was just booked. Pick another time.');
      fetchSlot();
      return null;
    }

    if (data?.error === 'slot_deleted' || data?.error === 'slot_not_found') {
      toast.error('This slot is no longer available.');
      fetchSlot();
      return null;
    }

    if (!data?.booking_id) return null;

    if (hadReferralDiscount) {
      await supabase
        .from('profiles')
        .update({ referral_discount_pending: false, referral_discount_trainer_id: null })
        .eq('id', user.id);
    }

    return data.booking_id;
  }, [slot, user, platformFeePct, fetchSlot]);

  // Create Stripe payment intent -- returns client_secret or null on failure
  const createPaymentIntent = useCallback(async (bookingId: string): Promise<string | null> => {
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
          body: JSON.stringify({ booking_id: bookingId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create payment');
      }

      return result.clientSecret;
    } catch {
      // Payment intent failed -- delete the orphaned pending booking
      await supabase.from('bookings').delete().eq('id', bookingId);
      toast.error('Payment setup failed. The session is still available -- please try again.');
      return null;
    }
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-paper pt-28 pb-20 px-6">
        <div className="max-w-2xl mx-auto space-y-10">
          <div className="space-y-2">
            <SkeletonLine width="w-48" className="h-8" />
            <SkeletonLine width="w-32" className="h-3" />
          </div>
          <div className="flex items-center gap-6 border border-ink/10 p-6">
            <div className="w-16 h-16 rounded-full bg-ink/5 animate-pulse" />
            <div className="space-y-2">
              <SkeletonLine width="w-36" className="h-5" />
              <SkeletonLine width="w-24" className="h-3" />
            </div>
          </div>
          <SkeletonRect className="h-48 w-full" />
          <SkeletonRect className="h-14 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-paper pt-32">
        <ErrorState
          title="Could not load session"
          message={error}
          onRetry={fetchSlot}
          backTo={{ label: 'Browse Trainers', path: '/' }}
        />
      </div>
    );
  }

  if (!slot || slot.is_booked || bookedSlotIds.includes(slot.id)) {
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

  const isSlotGreyed = bookedSlotIds.includes(slot.id);

  return (
    <div className="min-h-screen bg-paper pt-28 pb-20 px-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ink/40 hover:text-ink transition-colors mb-12"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <div
          className={`transition-colors duration-300 ${isSlotGreyed ? 'opacity-40 pointer-events-none' : ''}`}
        >
          <BookingWizard
            slot={slot}
            onComplete={() => navigate('/client/bookings')}
            stripeConfigured={STRIPE_CONFIGURED}
            handleBooking={handleBooking}
            createPaymentIntent={createPaymentIntent}
            platformFeePct={platformFeePct}
            referralDiscountPending={referralDiscountPending}
            PaymentFormComponent={PaymentForm}
          />
        </div>
      </div>
    </div>
  );
};

export default BookSession;
