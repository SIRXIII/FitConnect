import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useAvailability } from '@/hooks/useAvailability';
import { supabase } from '@/lib/supabase';
import AvailabilityManager from '@/components/trainer/AvailabilityManager';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const TrainerDashboard: React.FC = () => {
  const { profile, trainerProfile, fetchProfile, user } = useAuthStore();
  const { slots, refetch: refetchAvailability } = useAvailability();
  const [showAvailability, setShowAvailability] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const fetchBookingCount = async () => {
    if (!trainerProfile) return;

    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('trainer_id', trainerProfile.id)
      .in('status', ['pending', 'confirmed']);

    setUpcomingCount(count ?? 0);
  };

  useEffect(() => {
    fetchBookingCount();
  }, [trainerProfile?.id]);

  useEffect(() => {
    if (!trainerProfile) return;

    const bookingChannel = supabase
      .channel(`trainer-dashboard-bookings-${trainerProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `trainer_id=eq.${trainerProfile.id}`,
        },
        () => {
          fetchBookingCount();
        }
      )
      .subscribe();

    const slotChannel = supabase
      .channel(`trainer-dashboard-slots-${trainerProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_slots',
          filter: `trainer_id=eq.${trainerProfile.id}`,
        },
        () => {
          refetchAvailability();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingChannel);
      supabase.removeChannel(slotChannel);
    };
  }, [trainerProfile?.id, refetchAvailability]);

  const handleStripeConnect = async () => {
    if (!user) return;
    setStripeLoading(true);
    setStripeError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-connect-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          return_url: window.location.href,
          refresh_url: window.location.href,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create Stripe account');

      // Refresh profile to get updated stripe_account_id
      await fetchProfile(user.id);

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err: any) {
      setStripeError(err.message);
    } finally {
      setStripeLoading(false);
    }
  };

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

        {/* Stripe Connect */}
        <div className="border border-ink/10 p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Payment Setup</p>
              {trainerProfile?.stripe_account_id ? (
                <p className="text-sm text-green-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Stripe account connected
                </p>
              ) : (
                <p className="text-sm text-ink/50">
                  Connect your Stripe account to receive payouts from bookings
                </p>
              )}
            </div>
            {!trainerProfile?.stripe_account_id && (
              <button
                onClick={handleStripeConnect}
                disabled={stripeLoading}
                className="border border-accent text-accent px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent hover:text-white transition-all duration-300 disabled:opacity-50"
              >
                {stripeLoading ? 'Setting up...' : 'Set Up Payments'}
              </button>
            )}
            {trainerProfile?.stripe_account_id && (
              <button
                onClick={handleStripeConnect}
                disabled={stripeLoading}
                className="border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300 disabled:opacity-50"
              >
                {stripeLoading ? 'Loading...' : 'Manage Payments'}
              </button>
            )}
          </div>
          {stripeError && (
            <p className="text-sm text-red-600">{stripeError}</p>
          )}
        </div>

        {/* Availability section */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setShowAvailability(!showAvailability)}
              className="border border-ink/20 px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
            >
              {showAvailability ? 'Hide Availability' : 'Manage Availability'}
            </button>
            <Link
              to="/trainer/bookings"
              className="border border-accent/30 text-accent px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent hover:text-white transition-all duration-300"
            >
              Manage Bookings
            </Link>
          </div>

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
