import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// Fallbacks only — live values come from platform_settings (keys below).
export const DEFAULT_PLATFORM_FEE_PCT = 0.13;
export const DEFAULT_FOUNDING_CUTOFF = '2026-10-01';
export const FOUNDING_FREE_MONTHS = 12;

/** Founding Personal Trainers: joined before the cutoff date. */
export function isFoundingTrainer(
  trainerCreatedAt?: string | null,
  foundingCutoff?: string | null
): boolean {
  if (!trainerCreatedAt || !foundingCutoff) return false;
  const joined = new Date(trainerCreatedAt);
  const cutoff = new Date(foundingCutoff);
  if (isNaN(joined.getTime()) || isNaN(cutoff.getTime())) return false;
  return joined < cutoff;
}

/**
 * Effective platform fee for a trainer. Founding trainers pay 0% for their
 * first FOUNDING_FREE_MONTHS months from their join date, then the standard fee.
 */
export function effectivePlatformFee(
  feePct: number,
  trainerCreatedAt?: string | null,
  foundingCutoff?: string | null,
  now: Date = new Date()
): number {
  if (!isFoundingTrainer(trainerCreatedAt, foundingCutoff)) return feePct;
  const freeUntil = new Date(trainerCreatedAt as string);
  freeUntil.setMonth(freeUntil.getMonth() + FOUNDING_FREE_MONTHS);
  return now < freeUntil ? 0 : feePct;
}

/**
 * Single source of truth for the platform fee in the UI.
 * Reads platform_fee_pct and founding_cutoff from platform_settings,
 * falling back to the defaults above until loaded (or if unreadable).
 */
export function usePlatformFee() {
  const [feePct, setFeePct] = useState(DEFAULT_PLATFORM_FEE_PCT);
  const [foundingCutoff, setFoundingCutoff] = useState(DEFAULT_FOUNDING_CUTOFF);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['platform_fee_pct', 'founding_cutoff']);
      if (cancelled || !data) return;
      for (const row of data) {
        if (row.key === 'platform_fee_pct') {
          const parsed = parseFloat(row.value);
          if (!isNaN(parsed)) setFeePct(parsed);
        } else if (row.key === 'founding_cutoff' && row.value) {
          setFoundingCutoff(row.value);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const feeFor = useCallback(
    (trainerCreatedAt?: string | null) =>
      effectivePlatformFee(feePct, trainerCreatedAt, foundingCutoff),
    [feePct, foundingCutoff]
  );

  const isFounding = useCallback(
    (trainerCreatedAt?: string | null) => isFoundingTrainer(trainerCreatedAt, foundingCutoff),
    [foundingCutoff]
  );

  return { feePct, foundingCutoff, feeFor, isFounding };
}
