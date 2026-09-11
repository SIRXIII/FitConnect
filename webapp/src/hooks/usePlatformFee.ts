import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// Fallbacks only — live values come from platform_settings (keys below).
export const DEFAULT_PLATFORM_FEE_PCT = 0.13;
export const DEFAULT_FOUNDING_CUTOFF = '2026-10-01';
export const FOUNDING_FREE_MONTHS = 12;
export const DEFAULT_FREE_INTRO_UNTIL = '2026-12-01';

/**
 * platform_settings dates are plain 'YYYY-MM-DD'. new Date('2026-12-01') parses
 * as UTC midnight, which renders as Nov 30 west of Greenwich, so parse local.
 */
export function parseSettingDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

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
 * Effective platform fee for a trainer. Mirrors quote_booking_price(): founding
 * trainers pay 0% until FOUNDING_FREE_MONTHS after their benefit started
 * (trainer_profiles.founding_benefit_started_at, set by the first paid booking);
 * while it has not started yet the fee is also 0%.
 */
export function effectivePlatformFee(
  feePct: number,
  foundingStartedAt?: string | null,
  isFounding = false,
  now: Date = new Date()
): number {
  if (!isFounding) return feePct;
  if (!foundingStartedAt) return 0;
  const freeUntil = new Date(foundingStartedAt);
  if (isNaN(freeUntil.getTime())) return 0;
  freeUntil.setMonth(freeUntil.getMonth() + FOUNDING_FREE_MONTHS);
  return now < freeUntil ? 0 : feePct;
}

/** The two trainer_profiles columns the fee depends on. */
export interface FeeTrainer {
  created_at?: string | null;
  founding_benefit_started_at?: string | null;
}

/**
 * Single source of truth for the platform fee in the UI.
 * Reads platform_fee_pct and founding_cutoff from platform_settings,
 * falling back to the defaults above until loaded (or if unreadable).
 */
export function usePlatformFee() {
  const [feePct, setFeePct] = useState(DEFAULT_PLATFORM_FEE_PCT);
  const [foundingCutoff, setFoundingCutoff] = useState(DEFAULT_FOUNDING_CUTOFF);
  const [freeIntroUntil, setFreeIntroUntil] = useState(DEFAULT_FREE_INTRO_UNTIL);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['platform_fee_pct', 'founding_cutoff', 'free_intro_until']);
      if (cancelled || !data) return;
      for (const row of data) {
        if (row.key === 'platform_fee_pct') {
          const parsed = parseFloat(row.value);
          if (!isNaN(parsed)) setFeePct(parsed);
        } else if (row.key === 'founding_cutoff' && row.value) {
          setFoundingCutoff(row.value);
        } else if (row.key === 'free_intro_until' && row.value) {
          setFreeIntroUntil(row.value);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isFounding = useCallback(
    (trainerCreatedAt?: string | null) => isFoundingTrainer(trainerCreatedAt, foundingCutoff),
    [foundingCutoff]
  );

  const feeFor = useCallback(
    (trainer?: FeeTrainer | null) =>
      effectivePlatformFee(
        feePct,
        trainer?.founding_benefit_started_at,
        isFoundingTrainer(trainer?.created_at, foundingCutoff)
      ),
    [feePct, foundingCutoff]
  );

  const introEndsAt = parseSettingDate(freeIntroUntil);
  const introActive = introEndsAt !== null && new Date() < introEndsAt;

  return { feePct, foundingCutoff, feeFor, isFounding, freeIntroUntil, introEndsAt, introActive };
}
