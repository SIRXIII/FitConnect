import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useAvailability } from '@/hooks/useAvailability';
import { supabase } from '@/lib/supabase';
import AvailabilityManager from '@/components/trainer/AvailabilityManager';

const TrainerDashboard: React.FC = () => {
  const { profile, trainerProfile } = useAuthStore();
  const { slots } = useAvailability();
  const [showAvailability, setShowAvailability] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);

  useEffect(() => {
    if (!trainerProfile) return;

    const fetchBookings = async () => {
      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('trainer_id', trainerProfile.id)
        .in('status', ['pending', 'confirmed']);

      setUpcomingCount(count ?? 0);
    };

    fetchBookings();
  }, [trainerProfile]);

  const availableSlots = slots.filter((s) => !s.is_booked).length;
  const bookedSlots = slots.filter((s) => s.is_booked).length;

  return (
    <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-3xl serif font-light italic text-ink">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/40">
            Trainer Dashboard
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="border border-ink/10 p-8 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Upcoming Bookings</p>
            <p className="text-3xl serif font-light text-ink">{upcomingCount}</p>
          </div>
          <div className="border border-ink/10 p-8 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Available Slots</p>
            <p className="text-3xl serif font-light text-accent">{availableSlots}</p>
          </div>
          <div className="border border-ink/10 p-8 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Booked Slots</p>
            <p className="text-3xl serif font-light text-ink">{bookedSlots}</p>
          </div>
          <div className="border border-ink/10 p-8 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Rating</p>
            <p className="text-3xl serif font-light text-ink">
              {trainerProfile?.rating && trainerProfile.rating > 0
                ? Number(trainerProfile.rating).toFixed(1)
                : '—'}
            </p>
            {trainerProfile?.review_count ? (
              <p className="text-[10px] text-ink/30">{trainerProfile.review_count} reviews</p>
            ) : null}
          </div>
        </div>

        {/* Rates display */}
        {trainerProfile && (
          <div className="border border-ink/10 p-8 flex flex-wrap gap-12">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Standard Rate</p>
              <p className="text-2xl serif font-light">${trainerProfile.hourly_rate}/hr</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium">Optimized Rate</p>
              <p className="text-2xl serif font-light text-accent">${trainerProfile.optimized_rate}/hr</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Specialty</p>
              <p className="text-sm text-ink/60">
                {trainerProfile.specialty.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
            </div>
          </div>
        )}

        {/* Availability section */}
        <div className="space-y-6">
          <button
            onClick={() => setShowAvailability(!showAvailability)}
            className="border border-ink/20 px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
          >
            {showAvailability ? 'Hide Availability' : 'Manage Availability'}
          </button>

          {showAvailability && (
            <div className="border border-ink/10 p-8">
              <AvailabilityManager />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainerDashboard;
