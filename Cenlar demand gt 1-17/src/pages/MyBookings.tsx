import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Star, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { formatSpecialty } from '@/types';

interface BookingWithDetails {
  id: string;
  status: string;
  rate_charged: number;
  notes: string | null;
  created_at: string;
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

const MyBookings: React.FC = () => {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (!user) return;

    const fetchBookings = async () => {
      setLoading(true);
      const { data } = await supabase
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

      setBookings((data as unknown as BookingWithDetails[]) || []);
      setLoading(false);
    };

    fetchBookings();
  }, [user]);

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
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_by: user?.id })
      .eq('id', bookingId)
      .eq('client_id', user?.id);

    if (!error) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
      );
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
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border border-accent border-t-transparent rounded-full animate-spin" />
          </div>
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
                    {booking.status === 'completed' && (
                      <button className="text-[10px] uppercase tracking-[0.2em] text-accent border border-accent/20 px-4 py-2 hover:bg-accent/5 transition-colors flex items-center gap-1.5">
                        <Star size={10} />
                        Leave Review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;
