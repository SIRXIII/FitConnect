import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * usePullToRefresh — native-feeling pull-to-refresh for iOS Capacitor.
 *
 * Attach `containerRef` to the scrollable container div.
 * When the user pulls down past the threshold while at scroll top,
 * `onRefresh` is called. A visual indicator is shown during the pull
 * and while the refresh promise resolves.
 *
 * Works purely with touch events — no Capacitor plugin required.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const THRESHOLD = 72; // px to trigger refresh
  const MAX_PULL = 100; // px cap on visual stretch

  const startYRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current;
    if (!el || refreshingRef.current) return;
    // Only initiate when already scrolled to the very top
    if (el.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startYRef.current === null || refreshingRef.current) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) {
      startYRef.current = null;
      setPullDistance(0);
      return;
    }
    // Rubber-band damping: resistance increases as pull grows
    const damped = Math.min(MAX_PULL, delta * 0.45);
    setPullDistance(damped);
    // Prevent native scroll when pulling down from top
    if (delta > 2) e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (startYRef.current === null || refreshingRef.current) return;
    startYRef.current = null;

    if (pullDistance >= THRESHOLD) {
      refreshingRef.current = true;
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6); // snap to spinner position
      try {
        await onRefresh();
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const isActive = pullDistance > 0 || refreshing;
  const progress = Math.min(1, pullDistance / THRESHOLD);

  return { containerRef, pullDistance, refreshing, isActive, progress };
}
