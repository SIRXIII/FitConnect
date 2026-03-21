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
import SubscriptionTab from '@/components/subscription/SubscriptionTab';
import CalendarExportCard from '@/components/calendar/CalendarExportCard';
import BufferTimeSelector from '@/components/calendar/BufferTimeSelector';
import GoogleCalendarConnect from '@/components/calendar/GoogleCalendarConnect';
import AvailabilityHeader from '@/components/trainer/AvailabilityHeader';
import BookingRequestQueue from '@/components/trainer/BookingRequestQueue';
import CertificationUpload from '@/components/trainer/CertificationUpload';
import type { TrainerCertification } from '@/lib/certifications';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const TrainerDashboard: React.FC = () => {
  const { profile, trainerProfile, fetchProfile, user } = useAuthStore();
  const { slots, refetch: refetchAvailability } = useAvailability();
  const { tier } = useTier();
  const canAnalytics = useCan('analytics_advanced');
  const [searchParams] = useSearchParams();
  const navigateTo = useNavigate();
  const tabs = ['overview', 'payouts', 'analytics', 'subscription', 'calendar'] as const;
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>(() => {
    const tabParam = searchParams.get('tab');
    return tabs.includes(tabParam as typeof tabs[number])
      ? (tabParam as typeof tabs[number])
      : 'overview';
  });
  const [showAvailability, setShowAvailability] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  // Capture first-visit flag ONCE at mount so URL cleanup doesn't flip it back to false
  const [isFirstVisit] = useState(() => searchParams.get('welcome') === 'true');
  const [calendarToken, setCalendarToken] = useState(trainerProfile?.calendar_export_token || '');
  const [bufferMinutes, setBufferMinutes] = useState(trainerProfile?.buffer_minutes || 0);
  const [showCertUpload, setShowCertUpload] = useState(false);
  const [certSummary, setCertSummary] = useState<TrainerCertification[]>([]);

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

  useEffect(() => {
    if (!trainerProfile?.id) return;
    (supabase as any)
      .from('trainer_certifications')
      .select('id, status, cert_name')
      .eq('trainer_id', trainerProfile.id)
      .then(({ data }: { data: TrainerCertification[] | null }) => {
        if (data) setCertSummary(data);
      });
  }, [trainerProfile?.id]);

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
    <div className="min-h-screen bg-paper pt-24 md:pt-48 pb-20 px-4 sm:px-6">
      {trainerProfile && <AvailabilityHeader />}
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-3xl serif font-light italic text-ink">
            {isFirstVisit ? 'Welcome' : 'Welcome back'}{profile?.full_name ? `, ${profile.full_name}` : ''}
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/40">
            Every idle hour is untapped revenue.
          </p>
        </div>

        {/* Tabs */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="flex border-b border-ink/10 min-w-max sm:min-w-0 px-4 sm:px-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 sm:px-8 py-3 text-[10px] uppercase tracking-[0.25em] font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-b-2 border-ink text-ink -mb-px'
                    : 'text-ink/40 hover:text-ink'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (<>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="border border-ink/10 p-4 sm:p-8 space-y-3">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Upcoming Bookings</p>
            <p className="text-2xl sm:text-3xl serif font-light text-ink">{upcomingCount}</p>
          </div>
          <div className="border border-ink/10 p-4 sm:p-8 space-y-3">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Available Slots</p>
            <p className="text-2xl sm:text-3xl serif font-light text-accent">{availableSlots}</p>
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
          <div className="border border-ink/10 p-4 sm:p-8 space-y-3">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Booked Slots</p>
            <p className="text-2xl sm:text-3xl serif font-light text-ink">{bookedSlots}</p>
          </div>
          <div className="border border-ink/10 p-4 sm:p-8 space-y-3">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Rating</p>
            <p className="text-2xl sm:text-3xl serif font-light text-ink">
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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

        {/* Booking Request Queue — shown when live and in request mode */}
        {trainerProfile?.availability_status === 'live' && trainerProfile?.booking_mode === 'request' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl serif font-light text-ink italic">Booking Requests</h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Pending requests from clients</p>
            </div>
            <BookingRequestQueue />
          </div>
        )}

        {/* Referral Widget */}
        {profile?.referral_code && (
          <ReferralWidget referralCode={profile.referral_code} />
        )}

        {/* Certifications */}
        {trainerProfile && (
          <div className="border border-ink/10 p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Certifications</p>
                {certSummary.some(c => c.status === 'approved') ? (
                  <p className="text-sm text-green-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Verified Trainer
                  </p>
                ) : (
                  <p className="text-sm text-amber-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    {certSummary.length === 0
                      ? 'No certifications uploaded'
                      : 'Under review — bookings enabled once approved'}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowCertUpload(v => !v)}
                className="border border-ink/20 px-6 py-2.5 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
              >
                {showCertUpload ? 'Hide' : 'Add Certification'}
              </button>
            </div>

            {certSummary.length > 0 && !showCertUpload && (
              <div className="space-y-2">
                {certSummary.map(cert => (
                  <div key={cert.id} className="flex items-center justify-between py-2 border-b border-ink/5 last:border-0">
                    <span className="text-sm font-light text-ink">{cert.cert_name}</span>
                    <span className={`text-[10px] uppercase tracking-[0.12em] font-semibold ${
                      cert.status === 'approved' ? 'text-green-600' :
                      cert.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {cert.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!certSummary.some(c => c.status === 'approved') && certSummary.length > 0 && !showCertUpload && (
              <div className="p-4 border border-amber-200 bg-amber-50">
                <p className="text-xs text-amber-800 font-light">
                  Your certifications are under review — you'll be able to accept bookings once approved.
                </p>
              </div>
            )}

            {showCertUpload && (
              <CertificationUpload
                trainerId={trainerProfile.id}
                onCertUploaded={() => {
                  (supabase as any)
                    .from('trainer_certifications')
                    .select('id, status, cert_name')
                    .eq('trainer_id', trainerProfile.id)
                    .then(({ data }: { data: TrainerCertification[] | null }) => {
                      if (data) setCertSummary(data);
                    });
                }}
              />
            )}
          </div>
        )}

        </>)}

        {activeTab === 'payouts' && <PayoutsTab />}
        {activeTab === 'analytics' && (
          canAnalytics
            ? <AnalyticsTab />
            : <LockedFeatureBanner feature="analytics_advanced" tier={tier} />
        )}
        {activeTab === 'subscription' && <SubscriptionTab />}
        {activeTab === 'calendar' && (
          <div className="space-y-8">
            <GoogleCalendarConnect trainerId={trainerProfile?.id || ''} />
            <CalendarExportCard
              token={calendarToken}
              onTokenReset={(newToken) => setCalendarToken(newToken)}
            />
            <BufferTimeSelector
              currentBuffer={bufferMinutes}
              trainerId={trainerProfile?.id || ''}
              onBufferChange={(mins) => setBufferMinutes(mins)}
            />
          </div>
        )}

      </div>
    </div>
  );
};

export default TrainerDashboard;
