import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useAvailabilitySession } from '@/hooks/useAvailabilitySession';
import { supabase } from '@/lib/supabase';
import LiveToggle from '@/components/trainer/LiveToggle';
import SleepTimerPills from '@/components/trainer/SleepTimerPills';
import CountdownDisplay from '@/components/trainer/CountdownDisplay';
import GoLiveLocationPicker from '@/components/trainer/GoLiveLocationPicker';

const TOOLTIP_STORAGE_KEY = 'fitrush_toggle_tooltip_dismissed';

const AvailabilityHeader: React.FC = () => {
  const { trainerProfile } = useAuthStore();

  const {
    uiStatus,
    bookingMode,
    countdownDisplay,
    showExtendPills,
    setShowExtendPills,
    goLive,
    goOffline,
    cancelWarmup,
    setSleepTimer,
    extendTimer,
  } = useAvailabilitySession(trainerProfile ?? null);

  // Booking mode selection before going live
  const [pendingBookingMode, setPendingBookingMode] = useState<'instant' | 'request'>(
    trainerProfile?.booking_mode ?? 'instant'
  );

  // Sleep timer selection
  const [pendingTimer, setPendingTimer] = useState<number | 'eod' | null>(null);

  // First-time tooltip
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!trainerProfile) return;
    const isFirstTime =
      trainerProfile.availability_status === 'offline' &&
      trainerProfile.availability_session_started_at === null;
    const dismissed = localStorage.getItem(TOOLTIP_STORAGE_KEY) === 'true';
    setShowTooltip(isFirstTime && !dismissed);
  }, [trainerProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Location picker state
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);

  // Going-offline warning state
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);

  const dismissTooltip = () => {
    localStorage.setItem(TOOLTIP_STORAGE_KEY, 'true');
    setShowTooltip(false);
  };

  const handleToggle = async () => {
    if (uiStatus === 'live') {
      // Check for upcoming bookings before going offline
      if (trainerProfile) {
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('trainer_id', trainerProfile.id)
          .in('status', ['pending', 'confirmed']);

        if (count && count > 0) {
          setUpcomingCount(count);
          setShowOfflineWarning(true);
          return;
        }
      }
      await goOffline();
    } else if (uiStatus === 'offline') {
      setShowLocationPicker(true);
    }
  };

  const handleLocationSelect = (locationId: string) => {
    setPendingLocationId(locationId);
    setShowLocationPicker(false);
    goLive(pendingBookingMode, pendingTimer, locationId);
    dismissTooltip();
  };

  const handleGoOfflineAnyway = async () => {
    setShowOfflineWarning(false);
    await goOffline();
  };

  if (!trainerProfile) return null;

  const isLive = uiStatus === 'live';
  const isActive = uiStatus === 'live' || uiStatus === 'going_live';

  // Determine selected timer duration for the pills
  const selectedDuration: number | 'eod' | null = (() => {
    if (showExtendPills || uiStatus === 'going_live') return pendingTimer;
    if (trainerProfile.sleep_timer_expires_at) {
      // We don't store the original pill value, so just show null (no pre-selected pill)
      return null;
    }
    return pendingTimer;
  })();

  const handlePillSelect = (duration: number | 'eod') => {
    if (isActive && !showExtendPills) {
      // Live state with no extend mode — set or update timer
      setPendingTimer(duration);
      setSleepTimer(duration);
    } else if (showExtendPills) {
      extendTimer(duration);
    } else {
      // Going live — set pending timer to pass to goLive
      setPendingTimer(duration);
    }
  };

  return (
    <>
    <div
      className={`fixed top-16 left-0 right-0 z-[55] h-16 border-b transition-colors duration-300 ${
        isLive
          ? 'bg-emerald-950/95 border-emerald-500/30 backdrop-blur-sm'
          : uiStatus === 'going_live'
          ? 'bg-amber-950/90 border-amber-500/30 backdrop-blur-sm'
          : 'bg-stone-950/95 border-stone-700/30 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between gap-4">
        {/* Left: Booking mode selector (when offline) + LiveToggle */}
        <div className="flex items-center gap-4">
          {uiStatus === 'offline' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPendingBookingMode('instant')}
                className={`px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-200 rounded-full border ${
                  pendingBookingMode === 'instant'
                    ? 'bg-white text-stone-950 border-white/80 shadow-sm shadow-white/10'
                    : 'text-stone-400 border-stone-600/40 hover:text-white hover:border-stone-400/60'
                }`}
              >
                Instant Book
              </button>
              <button
                type="button"
                onClick={() => setPendingBookingMode('request')}
                className={`px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-200 rounded-full border ${
                  pendingBookingMode === 'request'
                    ? 'bg-white text-stone-950 border-white/80 shadow-sm shadow-white/10'
                    : 'text-stone-400 border-stone-600/40 hover:text-white hover:border-stone-400/60'
                }`}
              >
                Request
              </button>
            </div>
          )}

          <div className="relative">
            <LiveToggle
              uiStatus={uiStatus}
              onToggle={handleToggle}
              onCancelWarmup={cancelWarmup}
            />

            {/* First-time tooltip */}
            {showTooltip && uiStatus === 'offline' && (
              <div
                className="absolute top-full left-0 mt-2 z-50 bg-white text-stone-900 p-3 text-[10px] uppercase tracking-[0.2em] whitespace-nowrap rounded shadow-lg"
                style={{ minWidth: '240px' }}
              >
                Tap to go live. Clients can book you instantly.
                <button
                  type="button"
                  onClick={dismissTooltip}
                  className="ml-3 underline hover:no-underline"
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center: Status + Countdown */}
        <div className="flex items-center gap-3">
          {isActive && (
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-emerald-300/70">
              {bookingMode === 'instant' ? 'Instant Book' : 'Request to Book'}
            </span>
          )}
          {countdownDisplay && (
            <CountdownDisplay
              display={countdownDisplay}
              onTap={() => setShowExtendPills(true)}
            />
          )}
        </div>

        {/* Right: Sleep timer pills */}
        <SleepTimerPills
          selectedDuration={showExtendPills ? null : selectedDuration}
          onSelect={handlePillSelect}
          visible={isActive || showExtendPills}
        />
      </div>

      {/* Going-offline warning */}
      {showOfflineWarning && (
        <div className="absolute inset-x-0 top-full z-40 bg-stone-950 border-b border-stone-700/30 px-6 py-3 flex items-center gap-4">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-stone-400 flex-1">
            You have {upcomingCount} upcoming{' '}
            {upcomingCount === 1 ? 'booking' : 'bookings'}. Going offline
            won&apos;t cancel them.
          </p>
          <button
            type="button"
            onClick={() => setShowOfflineWarning(false)}
            className="text-[10px] uppercase tracking-[0.2em] font-medium text-stone-500 hover:text-white"
          >
            Stay Live
          </button>
          <button
            type="button"
            onClick={handleGoOfflineAnyway}
            className="border border-red-600 text-red-600 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium hover:bg-red-600 hover:text-white transition-colors"
          >
            Go Offline Anyway
          </button>
        </div>
      )}
    </div>

    {/* Location picker modal */}
    {showLocationPicker && trainerProfile && (
      <GoLiveLocationPicker
        trainerId={trainerProfile.id}
        onSelect={handleLocationSelect}
        onClose={() => setShowLocationPicker(false)}
      />
    )}
    </>
  );
};

export default AvailabilityHeader;
