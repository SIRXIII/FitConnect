import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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

type BookingStep = 'review' | 'confirm' | 'success';

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

  useEffect(() => {
    if (!slotId) return;

    const fetchSlot = async () => {
      const { data } = await supabase
        .from('availability_slots')
        .select(`
          *,
          trainer_profiles!availability_slots_trainer_id_fkey (
            *,
            profiles!trainer_profiles_user_id_fkey (full_name, avatar_url)
          )
        `)
        .eq('id', slotId)
        .single();

      setSlot(data as unknown as SlotWithTrainer | null);
      setLoading(false);
    };

    fetchSlot();
  }, [slotId]);

  const handleBooking = async () => {
    if (!slot || !user || !profile) return;

    setSubmitting(true);

    const trainerProfile = slot.trainer_profiles;
    const rate = Number(trainerProfile.optimized_rate);
    const platformFee = Math.round(rate * 0.08 * 100) / 100; // 8%
    const trainerPayout = Math.round((rate - platformFee) * 100) / 100;

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        client_id: user.id,
        trainer_id: trainerProfile.id,
        slot_id: slot.id,
        status: 'pending',
        rate_charged: rate,
        platform_fee: platformFee,
        trainer_payout: trainerPayout,
        notes: notes || null,
      })
      .select('id')
      .single();

    setSubmitting(false);

    if (error) {
      alert('Booking failed. The session may no longer be available.');
      return;
    }

    setBookingId(data.id);
    setStep('success');
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
  const rate = Number(trainerData.optimized_rate);
  const platformFee = Math.round(rate * 0.08 * 100) / 100;
  const total = rate;

  // Success state
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
        <div className="max-w-lg mx-auto text-center space-y-8">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <Check size={28} className="text-accent" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl serif font-light italic text-ink">Session Requested</h1>
            <p className="text-sm text-ink/50">
              Your booking request has been sent to {trainerName}. You'll be notified once they confirm.
            </p>
          </div>
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink/50">Optimized Rate</span>
                <span className="text-sm">${rate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink/50">Platform Fee (8%)</span>
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
                  {submitting ? 'Booking...' : 'Confirm Booking'}
                </button>
              </>
            )}
          </div>

          <p className="text-[10px] text-ink/30 text-center">
            Payment will be collected after the trainer confirms your booking.
            You can cancel free of charge up to 24 hours before the session.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BookSession;
