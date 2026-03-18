import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, UserRound, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import type { Tables } from '@/types/supabase';
import FitnessPassportCard from '@/components/booking/FitnessPassportCard';

type BookingStatus = Tables<'bookings'>['status'];

interface TrainerBooking {
  id: string;
  status: BookingStatus;
  rate_charged: number;
  notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  availability_slots: {
    id: string;
    start_time: string;
    end_time: string;
  } | null;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  client_profiles: {
    bio: string | null;
    fitness_goals: string[];
    workout_types: string[];
    training_frequency: string | null;
    health_notes: string | null;
    fitness_level: string | null;
  } | null;
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-ink/5 text-ink/60 border-ink/10',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
  no_show: 'bg-red-50 text-red-600 border-red-200',
};

const TrainerBookings: React.FC = () => {
  const { trainerProfile, user } = useAuthStore();
  const [bookings, setBookings] = useState<TrainerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'action' | 'history'>('action');

  const fetchBookings = async () => {
    if (!trainerProfile) return;

    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select(
        `
          id,
          status,
          rate_charged,
          notes,
          cancellation_reason,
          created_at,
          availability_slots!bookings_slot_id_fkey (
            id,
            start_time,
            end_time
          ),
          profiles!bookings_client_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `
      )
      .eq('trainer_id', trainerProfile.id)
      .order('created_at', { ascending: false });

    const rawBookings = (data as unknown as Omit<TrainerBooking, 'client_profiles'>[]) || [];

    // Fetch client fitness passport data via secondary query
    const clientIds = rawBookings
      .map((b) => b.profiles?.id)
      .filter((id): id is string => Boolean(id));

    let profileMap = new Map<
      string,
      TrainerBooking['client_profiles']
    >();

    if (clientIds.length > 0) {
      const uniqueIds = [...new Set(clientIds)];
      const { data: cpData } = await supabase
        .from('client_profiles')
        .select(
          'user_id, bio, fitness_goals, workout_types, training_frequency, health_notes, fitness_level'
        )
        .in('user_id', uniqueIds);

      if (cpData) {
        for (const cp of cpData) {
          profileMap.set(cp.user_id, {
            bio: cp.bio,
            fitness_goals: cp.fitness_goals || [],
            workout_types: cp.workout_types || [],
            training_frequency: cp.training_frequency,
            health_notes: cp.health_notes,
            fitness_level: cp.fitness_level,
          });
        }
      }
    }

    const enriched: TrainerBooking[] = rawBookings.map((b) => ({
      ...b,
      client_profiles: b.profiles?.id
        ? profileMap.get(b.profiles.id) || null
        : null,
    }));

    setBookings(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, [trainerProfile?.id]);

  useEffect(() => {
    if (!trainerProfile) return;

    const channel = supabase
      .channel(`trainer-bookings-${trainerProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `trainer_id=eq.${trainerProfile.id}`,
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trainerProfile?.id]);

  const actionRequired = useMemo(
    () =>
      bookings.filter((booking) => {
        if (booking.status === 'pending') return true;
        if (booking.status === 'confirmed') {
          const slotStart = booking.availability_slots?.start_time;
          if (!slotStart) return true;
          return new Date(slotStart) <= new Date();
        }
        return false;
      }),
    [bookings]
  );

  const history = useMemo(
    () => bookings.filter((booking) => !actionRequired.some((target) => target.id === booking.id)),
    [bookings, actionRequired]
  );

  const updateStatus = async (
    bookingId: string,
    status: BookingStatus,
    cancellationReason?: string
  ) => {
    if (!trainerProfile || !user) return;

    setUpdatingId(bookingId);

    const updatePayload: {
      status: BookingStatus;
      cancellation_reason?: string;
      cancelled_by?: string;
    } = { status };

    if (status === 'cancelled') {
      updatePayload.cancellation_reason = cancellationReason || 'Cancelled by trainer';
      updatePayload.cancelled_by = user.id;
    }

    const { error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .eq('trainer_id', trainerProfile.id);

    if (error) {
      toast.error('Failed to update booking status. Please try again.');
    } else {
      const statusLabel = status === 'confirmed' ? 'confirmed' : status === 'completed' ? 'marked complete' : status === 'no_show' ? 'marked as no-show' : 'cancelled';
      toast.success(`Booking ${statusLabel}.`);
      setBookings((prev) => prev.map((booking) => (booking.id === bookingId ? { ...booking, ...updatePayload } : booking)));

      // Trigger referral reward processing (non-blocking — failure does not affect booking UI)
      if (status === 'completed' && user) {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-referral-reward`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ booking_id: bookingId }),
            }
          ).catch((err) => console.error('[TrainerBookings] referral reward error:', err));
        }
      }
    }

    setUpdatingId(null);
  };

  return (
    <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-3xl serif font-light italic text-ink">Trainer Bookings</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/40">
              Confirm and complete your session requests
            </p>
          </div>
          <Link
            to="/trainer/dashboard"
            className="border border-ink/20 px-6 py-3 text-[10px] uppercase tracking-[0.2em] hover:bg-ink hover:text-white transition-all"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="flex gap-6 border-b border-ink/10">
          <button
            onClick={() => setActiveTab('action')}
            className={`pb-4 text-[11px] uppercase tracking-[0.2em] font-medium transition-colors ${
              activeTab === 'action' ? 'text-ink border-b-2 border-accent' : 'text-ink/30 hover:text-ink/50'
            }`}
          >
            Action Required ({actionRequired.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-4 text-[11px] uppercase tracking-[0.2em] font-medium transition-colors ${
              activeTab === 'history' ? 'text-ink border-b-2 border-accent' : 'text-ink/30 hover:text-ink/50'
            }`}
          >
            History ({history.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (activeTab === 'action' ? actionRequired : history).length === 0 ? (
          <div className="text-center py-20 border border-dashed border-ink/10">
            <h3 className="text-2xl serif font-light italic text-ink mb-3">No bookings in this view</h3>
            <p className="text-sm text-ink/40">New requests will appear here in real time</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(activeTab === 'action' ? actionRequired : history).map((booking) => {
              const start = booking.availability_slots?.start_time
                ? new Date(booking.availability_slots.start_time)
                : null;
              const end = booking.availability_slots?.end_time
                ? new Date(booking.availability_slots.end_time)
                : null;
              const clientName = booking.profiles?.full_name || 'Client';
              const canManagePending = booking.status === 'pending';
              const canManageConfirmed = booking.status === 'confirmed';

              return (
                <div key={booking.id} className="border border-ink/10 p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {booking.profiles?.avatar_url ? (
                        <img
                          src={booking.profiles.avatar_url}
                          alt={clientName}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-ink/5 flex items-center justify-center text-sm text-ink/40">
                          <UserRound size={16} />
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-lg serif font-light text-ink">{clientName}</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Booking #{booking.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-[9px] uppercase tracking-[0.15em] font-semibold border ${
                        STATUS_STYLES[booking.status]
                      }`}
                    >
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-6 text-sm text-ink/60">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-accent" />
                      {start
                        ? start.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Date unavailable'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-accent" />
                      {start && end
                        ? `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`
                        : 'Time unavailable'}
                    </div>
                    <div className="ml-auto text-accent serif text-lg">${Number(booking.rate_charged)}</div>
                  </div>

                  {booking.notes ? (
                    <div className="border border-ink/10 bg-ink/3 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-ink/35 mb-1">Client Notes</p>
                      <p className="text-sm text-ink/60">{booking.notes}</p>
                    </div>
                  ) : null}

                  {booking.client_profiles && (
                    <FitnessPassportCard
                      bio={booking.client_profiles.bio}
                      fitnessGoals={booking.client_profiles.fitness_goals}
                      workoutTypes={booking.client_profiles.workout_types}
                      trainingFrequency={booking.client_profiles.training_frequency}
                      healthNotes={booking.client_profiles.health_notes}
                      fitnessLevel={booking.client_profiles.fitness_level}
                    />
                  )}

                  {booking.cancellation_reason ? (
                    <div className="border border-red-100 bg-red-50 p-4 text-red-700 text-sm">
                      <p className="text-[10px] uppercase tracking-[0.2em] mb-1">Cancellation Reason</p>
                      <p>{booking.cancellation_reason}</p>
                    </div>
                  ) : null}

                  {(canManagePending || canManageConfirmed) && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      {canManagePending && (
                        <>
                          <button
                            onClick={() => updateStatus(booking.id, 'confirmed')}
                            disabled={updatingId === booking.id}
                            className="text-[10px] uppercase tracking-[0.2em] text-green-700 border border-green-200 px-4 py-2 hover:bg-green-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 size={10} />
                            Confirm
                          </button>
                          <button
                            onClick={() => updateStatus(booking.id, 'cancelled', 'Declined by trainer')}
                            disabled={updatingId === booking.id}
                            className="text-[10px] uppercase tracking-[0.2em] text-red-600 border border-red-200 px-4 py-2 hover:bg-red-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle size={10} />
                            Decline
                          </button>
                        </>
                      )}

                      {canManageConfirmed && (
                        <>
                          <button
                            onClick={() => updateStatus(booking.id, 'completed')}
                            disabled={updatingId === booking.id}
                            className="text-[10px] uppercase tracking-[0.2em] text-ink border border-ink/20 px-4 py-2 hover:bg-ink hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 size={10} />
                            Mark Completed
                          </button>
                          <button
                            onClick={() => updateStatus(booking.id, 'no_show')}
                            disabled={updatingId === booking.id}
                            className="text-[10px] uppercase tracking-[0.2em] text-amber-700 border border-amber-200 px-4 py-2 hover:bg-amber-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <AlertTriangle size={10} />
                            Mark No-Show
                          </button>
                          <button
                            onClick={() => updateStatus(booking.id, 'cancelled', 'Cancelled by trainer')}
                            disabled={updatingId === booking.id}
                            className="text-[10px] uppercase tracking-[0.2em] text-red-600 border border-red-200 px-4 py-2 hover:bg-red-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle size={10} />
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerBookings;
