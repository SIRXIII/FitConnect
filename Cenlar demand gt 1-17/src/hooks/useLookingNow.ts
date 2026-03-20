import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface LivePosition {
  lat: number;
  lng: number;
}

export function useLookingNow() {
  const [isActive, setIsActive] = useState(false);
  const [livePosition, setLivePosition] = useState<LivePosition | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deactivate = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsActive(false);
    setLivePosition(null);
  }, []);

  const activate = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLivePosition({ lat: latitude, lng: longitude });
        setIsActive(true);

        // Auto-disable after 2 hours
        timerRef.current = setTimeout(() => {
          setIsActive(false);
          setLivePosition(null);
          timerRef.current = null;
        }, 2 * 60 * 60 * 1000);
      },
      () => {
        toast.error('Location access denied');
      }
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { isActive, livePosition, activate, deactivate };
}
