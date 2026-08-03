import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import type { TrainerProfile } from '@/stores/auth';

export type AvailabilityUIStatus = 'offline' | 'going_live' | 'live';

export interface UseAvailabilitySessionReturn {
  uiStatus: AvailabilityUIStatus;
  bookingMode: 'instant' | 'request';
  secondsRemaining: number;
  countdownDisplay: string;
  showExtendPills: boolean;
  setShowExtendPills: (v: boolean) => void;
  goLive: (bookingMode: 'instant' | 'request', timer: number | 'eod' | null, locationId?: string) => void;
  goOffline: () => Promise<void>;
  cancelWarmup: () => void;
  setSleepTimer: (duration: number | 'eod') => void;
  extendTimer: (duration: number | 'eod') => void;
}

function computeExpiresAt(duration: number | 'eod'): string {
  if (duration === 'eod') {
    const eod = new Date();
    eod.setHours(23, 59, 59, 0);
    return eod.toISOString();
  }
  return new Date(Date.now() + duration * 3600 * 1000).toISOString();
}

export function useAvailabilitySession(
  trainerProfile: TrainerProfile | null
): UseAvailabilitySessionReturn {
  const warmupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warned10MinRef = useRef(false);

  const [uiStatus, setUiStatus] = useState<AvailabilityUIStatus>(() => {
    if (!trainerProfile) return 'offline';
    return trainerProfile.availability_status === 'live' ? 'live' : 'offline';
  });

  const [bookingMode, setBookingMode] = useState<'instant' | 'request'>(
    trainerProfile?.booking_mode ?? 'instant'
  );

  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [showExtendPills, setShowExtendPills] = useState(false);

  // Sync uiStatus from trainerProfile changes (e.g., Realtime or Zustand refresh)
  useEffect(() => {
    if (!trainerProfile) return;
    // Only sync to offline if not in the middle of warm-up
    if (trainerProfile.availability_status === 'live' && uiStatus === 'going_live') return;
    const dbStatus = trainerProfile.availability_status === 'live' ? 'live' : 'offline';
    setUiStatus(dbStatus);
    setBookingMode(trainerProfile.booking_mode ?? 'instant');
  }, [trainerProfile?.availability_status, trainerProfile?.booking_mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown interval from sleep_timer_expires_at
  useEffect(() => {
    const expiresAt = trainerProfile?.sleep_timer_expires_at;
    if (!expiresAt) {
      setSecondsRemaining(0);
      warned10MinRef.current = false;
      return;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsRemaining(remaining);

      // Fire 10-minute warning exactly once
      if (remaining <= 600 && remaining > 590 && !warned10MinRef.current) {
        warned10MinRef.current = true;
        toast.warning('Availability expires in 10 min. Extend Timer?', {
          duration: Infinity,
          action: {
            label: 'Extend Timer',
            onClick: () => setShowExtendPills(true),
          },
        });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [trainerProfile?.sleep_timer_expires_at]);

  // Realtime subscription for external changes (e.g., pg_cron expiry)
  useEffect(() => {
    if (!trainerProfile) return;

    const channel = supabase
      .channel(`trainer-availability-${trainerProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trainer_profiles',
          filter: `id=eq.${trainerProfile.id}`,
        },
        (payload) => {
          const updated = payload.new as TrainerProfile;
          // Update Zustand store so trainerProfile reference changes and effects re-run
          useAuthStore.getState().fetchProfile(updated.user_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trainerProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup warmup timeout on unmount
  useEffect(() => {
    return () => {
      if (warmupTimeoutRef.current) {
        clearTimeout(warmupTimeoutRef.current);
      }
    };
  }, []);

  const goLive = useCallback(
    (mode: 'instant' | 'request', timer: number | 'eod' | null, locationId?: string) => {
      if (!trainerProfile) return;

      setUiStatus('going_live');
      setBookingMode(mode);

      // Pitfall 5: DB write happens AFTER warm-up completes, not during warm-up
      warmupTimeoutRef.current = setTimeout(async () => {
        const sleepTimerExpiresAt = timer !== null ? computeExpiresAt(timer) : null;

        const { error } = await supabase
          .from('trainer_profiles')
          .update({
            availability_status: 'live',
            booking_mode: mode,
            sleep_timer_expires_at: sleepTimerExpiresAt,
            availability_session_started_at: new Date().toISOString(),
            active_location_id: locationId ?? null,
          })
          .eq('id', trainerProfile.id);

        if (!error) {
          setUiStatus('live');
          warned10MinRef.current = false;
          await useAuthStore.getState().fetchProfile(trainerProfile.user_id);
        } else {
          // DB write failed — revert to offline
          console.error('[goLive] DB update failed:', JSON.stringify(error));
          setUiStatus('offline');
          toast.error('Failed to go live. Check your connection and try again.');
        }
      }, 5000);
    },
    [trainerProfile]
  );

  const goOffline = useCallback(async () => {
    if (!trainerProfile) return;

    const { error } = await supabase
      .from('trainer_profiles')
      .update({
        availability_status: 'offline',
        sleep_timer_expires_at: null,
        availability_session_started_at: null,
        active_location_id: null,
      })
      .eq('id', trainerProfile.id);

    if (!error) {
      setUiStatus('offline');
      warned10MinRef.current = false;
      await useAuthStore.getState().fetchProfile(trainerProfile.user_id);
    } else {
      toast.error('Failed to go offline. Check your connection and try again.');
    }
  }, [trainerProfile]);

  const cancelWarmup = useCallback(() => {
    if (uiStatus !== 'going_live') return;
    if (warmupTimeoutRef.current) {
      clearTimeout(warmupTimeoutRef.current);
      warmupTimeoutRef.current = null;
    }
    // Pitfall 5: Do NOT write to DB during warm-up cancellation
    setUiStatus('offline');
  }, [uiStatus]);

  const setSleepTimer = useCallback(
    async (duration: number | 'eod') => {
      if (!trainerProfile) return;
      const sleepTimerExpiresAt = computeExpiresAt(duration);

      const { error } = await supabase
        .from('trainer_profiles')
        .update({ sleep_timer_expires_at: sleepTimerExpiresAt })
        .eq('id', trainerProfile.id);

      if (!error) {
        warned10MinRef.current = false;
        await useAuthStore.getState().fetchProfile(trainerProfile.user_id);
      } else {
        toast.error('Failed to set sleep timer. Try again.');
      }
    },
    [trainerProfile]
  );

  const extendTimer = useCallback(
    async (duration: number | 'eod') => {
      if (!trainerProfile) return;

      const currentExpires = trainerProfile.sleep_timer_expires_at;

      let newExpiresAt: string;
      if (duration === 'eod') {
        newExpiresAt = computeExpiresAt('eod');
      } else {
        // Add to remaining time, not from now
        const base = currentExpires
          ? Math.max(new Date(currentExpires).getTime(), Date.now())
          : Date.now();
        newExpiresAt = new Date(base + duration * 3600 * 1000).toISOString();
      }

      const { error } = await supabase
        .from('trainer_profiles')
        .update({ sleep_timer_expires_at: newExpiresAt })
        .eq('id', trainerProfile.id);

      if (!error) {
        warned10MinRef.current = false;
        setShowExtendPills(false);
        await useAuthStore.getState().fetchProfile(trainerProfile.user_id);
      } else {
        toast.error('Failed to extend timer. Try again.');
      }
    },
    [trainerProfile]
  );

  // Build countdown display string
  const countdownDisplay = (() => {
    if (secondsRemaining <= 0) return '';
    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  })();

  return {
    uiStatus,
    bookingMode,
    secondsRemaining,
    countdownDisplay,
    showExtendPills,
    setShowExtendPills,
    goLive,
    goOffline,
    cancelWarmup,
    setSleepTimer,
    extendTimer,
  };
}
