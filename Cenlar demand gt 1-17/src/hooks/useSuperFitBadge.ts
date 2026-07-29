import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Checks whether a trainer currently holds an active SuperFit badge.
 * `superfit_badges` isn't in the generated Supabase types yet, so this uses
 * the same `(supabase as any)` escape hatch as get_visible_slots.
 */
export function useSuperFitBadge(trainerId: string | undefined) {
  const [hasBadge, setHasBadge] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trainerId) {
      setHasBadge(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('superfit_badges')
        .select('id')
        .eq('trainer_id', trainerId)
        .is('revoked_at', null)
        .limit(1);

      if (!cancelled) {
        setHasBadge(Array.isArray(data) && data.length > 0);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trainerId]);

  return { hasBadge, loading };
}
