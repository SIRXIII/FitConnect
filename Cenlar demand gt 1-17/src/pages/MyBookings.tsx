import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Star, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { reviewSchema } from '@/lib/schemas';
import { formatSpecialty } from '@/types';
import type { Tables } from '@/types/supabase';
import { BookingCardSkeleton } from '@/components/skeleton/BookingCardSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { mapError } from '@/lib/errorMessages';
import SessionNotesDisplay from '@/components/session/SessionNotesDisplay';
import type { ExerciseEntry } from '@/types/session';

type BookingRow = Tables<'bookings'>;
type ReviewRow = Tables<'reviews'>;

interface BookingWithDetails
  extends Pick<BookingRow, 'id' | 'status' | 'rate_charged' | 'notes' | 'created_at'> {
  availability_slots: {
    start_time: string;
    end_time: string;
  };
  trainer_profiles: {
    id: string;
    specialty: string;
    location: string;
    profiles: {
      full_name: string;
      avatar_url: string | null;
    };
  };
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-ink/5 text-ink/50 border-ink/10',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
  no_show: 'bg-red-50 text-red-600 border-red-200',
};

interface SubRatings {
  punctuality: number;
  expertise: number;
  communication: number;
}

const StarPicker: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={16}
            className={`transition-colors ${
              star <= (hovered || value) ? 'text-accent fill-accent' : 'text-ink/15'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

const ReviewModal: React.FC<{
  booking: BookingWithDetails;
  onClose: () => void;
  onSubmit: (bookingId: string, trainerId: string, rating: number, comment: string, subRatings: SubRatings) => Promise<void>;
}> = ({ booking, onClose, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [subRatings, setSubRatings] = useState<SubRatings>({ punctuality: 0, expertise: 0, communication: 0 });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    await onSubmit(booking.id, booking.trainer_profiles.id, rating, comment, subRatings);
    setSubmitting(false);
  };

  const trainerName = booking.trainer_profiles?.profiles?.full_name || 'Trainer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={onClose}>
      <div className="bg-paper max-w-md w-full p-8 space-y-6 border border-ink/10 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <h3 className="text-xl serif font-light italic text-ink">Rate your session</h3>
          <p className="text-sm text-ink/40">How was your session with {trainerName}?</p>
        </div>

        {/* Overall star rating */}
        <div className="flex gap-2 justify-center py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={32}
                className={`transition-colors ${
                  star <= (hoveredRating || rating)
                    ? 'text-accent fill-accent'
                    : 'text-ink/15'
                }`}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-center text-xs text-ink/40">
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
          </p>
        )}

        {/* Sub-ratings */}
        <div className="space-y-3 border border-ink/8 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">Detailed Ratings (optional)</p>
          {(
            [
              { key: 'punctuality', label: 'Punctuality' },
              { key: 'expertise', label: 'Expertise' },
              { key: 'communication', label: 'Communication' },
            ] as Array<{ key: keyof SubRatings; label: string }>
          ).map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs text-ink/50">{label}</span>
              <StarPicker
                value={subRatings[key]}
                onChange={(v) => setSubRatings((prev) => ({ ...prev, [key]: v }))}
              />
            </div>
          ))}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience (optional)"
          rows={3}
          className="w-full border border-ink/10 bg-transparent p-4 text-sm text-ink placeholder:text-ink/20 focus:outline-none focus:border-accent/40 resize-none"
        />

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-[10px] uppercase tracking-[0.2em] text-ink/40 border border-ink/10 hover:border-ink/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="px-6 py-2.5 text-[10px] uppercase tracking-[0.2em] bg-ink text-white hover:bg-ink/80 transition-colors disabled:opacity-30"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MyBookings: React.FC = () => {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<unknown>(null);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [reviewBooking, setReviewBooking] = useState<BookingWithDetails | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [sessionLogsMap, setSessionLogsMap] = useState<Map<string, { notes: string | null; exercises: ExerciseEntry[] }>>(new Map());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const fetchBookings = useCallback(async () => {
    if (!user) return;

    setFetchError(null);
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, status, rate_charged, notes, created_at,
        availability_slots!bookings_slot_id_fkey (start_time, end_time),
        trainer_profiles!bookings_trainer_id_fkey (
          id, specialty, location,
          profiles!trainer_profiles_user_id_fkey (full_name, avatar_url)
        )
      `)
      .eq('client_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setFetchError(error);
      setLoading(false);
      return;
    }
    setBookings((data as unknown as BookingWithDetails[]) || []);
    setLoading(false);

    // Fetch which bookings already have reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select('booking_id')
      .eq('client_id', user.id);

      if (reviews) {
        setReviewedIds(new Set(reviews.map((r: Pick<ReviewRow, 'booking_id'>) => r.booking_id)));
      }

    // Fetch session logs for completed bookings
    const completedIds = ((data as unknown as BookingWithDetails[]) || [])
      .filter(b => b.status === 'completed')
      .map(b => b.id);
    if (completedIds.length > 0) {
      const { data: logsData } = await (supabase as any)
        .from('session_logs')
        .select('booking_id, notes, exercises')
        .in('booking_id', completedIds);
      if (logsData) {
        const map = new Map<string, { notes: string | null; exercises: ExerciseEntry[] }>();
        for (const log of logsData) {
          map.set(log.booking_id, { notes: log.notes, exercises: log.exercises ?? [] });
        }
        setSessionLogsMap(map);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`client-bookings-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `client_id=eq.${user.id}`,
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchBookings]);

  const handleReviewSubmit = async (bookingId: string, trainerId: string, rating: number, comment: string, subRatings: SubRatings) => {
    if (!user) return;

    const validation = reviewSchema.safeParse({ rating, comment: comment || undefined });
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    const { error } = await supabase.from('reviews').insert({
      booking_id: bookingId,
      client_id: user.id,
      trainer_id: trainerId,
      rating,
      comment: comment || null,
      rating_punctuality: subRatings.punctuality > 0 ? subRatings.punctuality : null,
      rating_expertise: subRatings.expertise > 0 ? subRatings.expertise : null,
      rating_communication: subRatings.communication > 0 ? subRatings.communication : null,
    });

    if (error) {
      toast.error('Failed to submit review. Please try again.');
    } else {
      toast.success('Review submitted — thank you!');
      setReviewedIds((prev) => new Set(prev).add(bookingId));
      setReviewBooking(null);
    }
  };

  const now = new Date();
  const upcomingBookings = bookings.filter((b) => {
    const sessionTime = new Date(b.availability_slots?.start_time);
    return sessionTime >= now && ['pending', 'confirmed'].includes(b.status);
  });
  const pastBookings = bookings.filter((b) => {
    const sessionTime = new Date(b.availability_slots?.start_time);
    return sessionTime < now || ['completed', 'cancelled', 'no_show'].includes(b.status);
  });

  const displayBookings = tab === 'upcoming' ? upcomingBookings : pastBookings;

  const handleCancel = async (bookingId: string) => {
    if (!user) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-booking`,
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
        toast.error(result.error || 'Failed to cancel booking. Please try again.');
        return;
      }

      toast.success(result.refunded ? 'Booking cancelled and refund issued.' : 'Booking cancelled.');
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
      );
    } catch {
      toast.error('Failed to cancel booking. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="space-y-4">
          <h1 className="text-3xl serif font-light italic text-ink">My Bookings</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/40">
            Manage your training sessions
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-ink/10">
          <button
            onClick={() => setTab('upcoming')}
            className={`pb-4 text-[11px] uppercase tracking-[0.2em] font-medium transition-colors ${
              tab === 'upcoming'
                ? 'text-ink border-b-2 border-accent'
                : 'text-ink/30 hover:text-ink/50'
            }`}
          >
            Upcoming ({upcomingBookings.length})
          </button>
          <button
            onClick={() => setTab('past')}
            className={`pb-4 text-[11px] uppercase tracking-[0.2em] font-medium transition-colors ${
              tab === 'past'
                ? 'text-ink border-b-2 border-accent'
                : 'text-ink/30 hover:text-ink/50'
            }`}
          >
            Past ({pastBookings.length})
          </button>
        </div>

        {/* Booking List */}
        {loading ? (
          <div className="space-y-4">
            <BookingCardSkeleton />
            <BookingCardSkeleton />
            <BookingCardSkeleton />
          </div>
        ) : fetchError ? (
          <ErrorState
            {...mapError(fetchError)}
            onRetry={() => { setFetchError(null); setLoading(true); fetchBookings(); }}
          />
        ) : displayBookings.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-ink/10">
            <h3 className="text-2xl serif font-light italic text-ink mb-3">
              {tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
            </h3>
            <p className="text-sm text-ink/40 mb-8">
              {tab === 'upcoming'
                ? 'Browse trainers to book your first session'
                : 'Your completed sessions will appear here'}
            </p>
            {tab === 'upcoming' && (
              <Link
                to="/trainers"
                className="inline-block border border-ink/20 px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
              >
                Browse Trainers
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayBookings.map((booking) => {
              const start = new Date(booking.availability_slots?.start_time);
              const end = new Date(booking.availability_slots?.end_time);
              const trainer = booking.trainer_profiles;
              const trainerName = trainer?.profiles?.full_name || 'Trainer';
              const canCancel =
                ['pending', 'confirmed'].includes(booking.status) &&
                start.getTime() - now.getTime() > 24 * 60 * 60 * 1000;

              return (
                <div key={booking.id} className="border border-ink/10 p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {trainer?.profiles?.avatar_url ? (
                        <img
                          src={trainer.profiles.avatar_url}
                          alt={trainerName}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-ink/5 flex items-center justify-center text-lg serif text-ink/20">
                          {trainerName.charAt(0)}
                        </div>
                      )}
                      <div className="space-y-1">
                        <Link
                          to={`/trainers/${trainer?.id}`}
                          className="text-lg serif font-light text-ink hover:text-accent transition-colors"
                        >
                          {trainerName}
                        </Link>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                          {trainer?.specialty ? formatSpecialty(trainer.specialty) : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-[9px] uppercase tracking-[0.15em] font-semibold border ${
                        STATUS_STYLES[booking.status] || 'bg-ink/5 text-ink/50 border-ink/10'
                      }`}
                    >
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-6 text-sm text-ink/60">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-accent" />
                      {start.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-accent" />
                      {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} -{' '}
                      {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                    {trainer?.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-accent" />
                        {trainer.location}
                      </div>
                    )}
                    <div className="ml-auto text-accent serif text-lg">
                      ${Number(booking.rate_charged)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    {canCancel && (
                      <button
                        onClick={() => handleCancel(booking.id)}
                        className="text-[10px] uppercase tracking-[0.2em] text-red-500 border border-red-200 px-4 py-2 hover:bg-red-50 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    {booking.status === 'completed' && !reviewedIds.has(booking.id) && (
                      <button
                        onClick={() => setReviewBooking(booking)}
                        className="text-[10px] uppercase tracking-[0.2em] text-accent border border-accent/20 px-4 py-2 hover:bg-accent/5 transition-colors flex items-center gap-1.5"
                      >
                        <Star size={10} />
                        Leave Review
                      </button>
                    )}
                    {booking.status === 'completed' && reviewedIds.has(booking.id) && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-green-600 flex items-center gap-1.5 px-4 py-2">
                        <Star size={10} className="fill-green-600" />
                        Reviewed
                      </span>
                    )}
                  </div>

                  {booking.status === 'completed' && sessionLogsMap.has(booking.id) && (
                    <SessionNotesDisplay
                      notes={sessionLogsMap.get(booking.id)!.notes}
                      exercises={(sessionLogsMap.get(booking.id)!.exercises as ExerciseEntry[]) ?? []}
                      expanded={expandedNotes.has(booking.id)}
                      onToggle={() => setExpandedNotes(prev => {
                        const next = new Set(prev);
                        if (next.has(booking.id)) next.delete(booking.id);
                        else next.add(booking.id);
                        return next;
                      })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewBooking && (
        <ReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSubmit={handleReviewSubmit}
        />
      )}
    </div>
  );
};

export default MyBookings;
