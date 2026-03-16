import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import { useAvailability } from '@/hooks/useAvailability';
import { useTier, useCan } from '@/hooks/useTier';
import { supabase } from '@/lib/supabase';
import AvailabilityManager from '@/components/trainer/AvailabilityManager';
import DiscountSlider, { computeDiscountedRate } from '@/components/trainer/DiscountSlider';
import PayoutsTab from '@/components/trainer/PayoutsTab';
import AnalyticsTab from '@/components/trainer/AnalyticsTab';
import ReferralWidget from '@/components/shared/ReferralWidget';
import LockedFeatureBanner from '@/components/shared/LockedFeatureBanner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const TrainerDashboard: React.FC = () => {
  const { profile, trainerProfile, fetchProfile, user } = useAuthStore();
  const { slots, refetch: refetchAvailability } = useAvailability();
  const { tier } = useTier();
  const canAnalytics = useCan('analytics_advanced');
  const [searchParams] = useSearchParams();
  const navigateTo = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'analytics'>('overview');
  const [showAvailability, setShowAvailability] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  // Capture first-visit flag ONCE at mount so URL cleanup doesn't flip it back to false
  const [isFirstVisit] = useState(() => searchParams.get('welcome') === 'true');

  // Remove ?welcome=true from URL after reading it so a refresh shows "Welcome back"
  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      navigateTo('/trainer/dashboard', { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Single abort controller covers the entire fetch operation
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 10000);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('Session expired — please sign in again.');
      }

      if (!SUPABASE_URL) {
        throw new Error('Stripe setup is not configured. Contact support.');
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-connect-account`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          return_url: window.location.href,
          refresh_url: window.location.href,
        }),
      });

      clearTimeout(abortTimer);

      if (res.status === 404) {
        throw new Error('Payment setup not yet available — add STRIPE_SECRET_KEY to Supabase Edge Function secrets.');
      }

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error || `Server error (${res.status}) — please try again.`);
      }

      if (!payload?.url) {
        throw new Error('No redirect URL returned — check STRIPE_SECRET_KEY in Supabase secrets.');
      }

      await fetchProfile(user.id);
      window.location.href = payload.url;
    } catch (err: unknown) {
      clearTimeout(abortTimer);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const msg = isAbort
        ? 'Request timed out (10s). Check your connection or Supabase Edge Function logs.'
        : err instanceof Error ? err.message : 'Payment setup failed — please try again.';
      toast.error(msg);
      setStripeError(msg);
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
            {isFirstVisit ? 'Welcome' : 'Welcome back'}{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/40">
            Trainer Dashboard
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ink/10">
          {(['overview', 'payouts', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-3 text-[10px] uppercase tracking-[0.25em] font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-ink text-ink -mb-px'
                  : 'text-ink/40 hover:text-ink'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (<>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="border border-ink/10 p-8 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Upcoming Bookings</p>
            <p className="text-3xl serif font-light text-ink">{upcomingCount}</p>
          </div>
          <div className="border border-ink/10 p-8 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Available Slots</p>
            <p className="text-3xl serif font-light text-accent">{availableSlots}</p>
            {tier === 'free' && availableSlots > 3 && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-600/70 font-medium">
                3 of {availableSlots} visible to clients
              </p>
            )}
            {tier === 'free' && availableSlots <= 3 && availableSlots > 0 && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink/30">
                All {availableSlots} visible — upgrade to show more
              </p>
            )}
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
            {(trainerProfile.discount_percentage ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Session Rate</p>
                <p className="text-2xl serif font-light text-accent">
                  ${computeDiscountedRate(Number(trainerProfile.optimized_rate), trainerProfile.discount_percentage ?? 0)}/hr
                  <span className="text-[11px] text-ink/30 ml-2">({trainerProfile.discount_percentage}% off)</span>
                </p>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Specialty</p>
              <p className="text-sm text-ink/60">
                {trainerProfile.specialty.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
            </div>
          </div>
        )}

        {/* Discount slider */}
        {trainerProfile && (
          <div className="border border-ink/10 p-8">
            <DiscountSlider
              currentDiscount={trainerProfile.discount_percentage ?? 0}
              optimizedRate={Number(trainerProfile.optimized_rate)}
              onSaved={() => fetchProfile(user!.id)}
            />
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

        {/* Referral Widget */}
        {profile?.referral_code && (
          <ReferralWidget referralCode={profile.referral_code} />
        )}

        </>)}

        {activeTab === 'payouts' && <PayoutsTab />}
        {activeTab === 'analytics' && (
          canAnalytics
            ? <AnalyticsTab />
            : <LockedFeatureBanner feature="analytics_advanced" tier={tier} />
        )}

      </div>
    </div>
  );
};

export default TrainerDashboard;
