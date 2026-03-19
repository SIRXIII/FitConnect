import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useAvailabilitySession } from '@/hooks/useAvailabilitySession';
import { supabase } from '@/lib/supabase';
import LiveToggle from '@/components/trainer/LiveToggle';
import SleepTimerPills from '@/components/trainer/SleepTimerPills';
import CountdownDisplay from '@/components/trainer/CountdownDisplay';

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
      goLive(pendingBookingMode, pendingTimer);
      dismissTooltip();
    }
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
    <div
      className={`fixed top-16 left-0 right-0 z-40 h-16 border-b border-ink/10 bg-paper ${
        isLive ? 'border-t-2 border-green-500' : ''
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
                className={`px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium transition-colors rounded-full ${
                  pendingBookingMode === 'instant'
                    ? 'bg-ink text-white'
                    : 'text-ink/40 hover:text-ink'
                }`}
              >
                Instant Book
              </button>
              <button
                type="button"
                onClick={() => setPendingBookingMode('request')}
                className={`px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium transition-colors rounded-full ${
                  pendingBookingMode === 'request'
                    ? 'bg-ink text-white'
                    : 'text-ink/40 hover:text-ink'
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
                className="absolute top-full left-0 mt-2 z-50 bg-ink text-paper p-3 text-[10px] uppercase tracking-[0.2em] whitespace-nowrap"
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
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-ink/40">
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
        <div className="absolute inset-x-0 top-full z-40 bg-paper border-b border-ink/10 px-6 py-3 flex items-center gap-4">
          <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-ink/60 flex-1">
            You have {upcomingCount} upcoming{' '}
            {upcomingCount === 1 ? 'booking' : 'bookings'}. Going offline
            won&apos;t cancel them.
          </p>
          <button
            type="button"
            onClick={() => setShowOfflineWarning(false)}
            className="text-[10px] uppercase tracking-[0.2em] font-medium text-ink/40 hover:text-ink"
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
  );
};

export default AvailabilityHeader;
