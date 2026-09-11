import { effectivePlatformFee } from '@/hooks/usePlatformFee';

/** Referral discount applied to individual sessions when profiles.referral_discount_pending is set. */
export const REFERRAL_DISCOUNT = 5;

export interface QuoteSlot {
  slot_type?: string | null;
  group_rate?: number | string | null;
  is_intro?: boolean | null;
}

export interface QuoteTrainer {
  optimized_rate: number | string;
  discount_percentage?: number | null;
}

export interface DisplayQuote {
  isGroup: boolean;
  /** group_rate for group slots, optimized_rate otherwise */
  baseRate: number;
  discountPct: number;
  /** Session price after the trainer's discount, before the referral discount */
  rate: number;
  referralDiscount: number;
  /** What the trainer charges for the session (= trainer payout under Model B) */
  rateCharged: number;
  feePct: number;
  platformFee: number;
  /** rateCharged + platformFee — what the client pays */
  total: number;
  trainerPayout: number;
}

/** Subset of the quote returned by create_booking_atomic / quote_booking_price. */
export interface ServerQuote {
  rate_charged: number;
  platform_fee: number;
  total: number;
  trainer_payout: number;
  fee_pct?: number;
  referral_discount?: number;
  discount_pct?: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Client-side mirror of public.quote_booking_price(), used for display before
 * the booking exists (the RPC quote replaces it afterwards).
 * - complimentary intro slots: all-zero, no fee, no discount
 * - group slots: group_rate, no trainer or referral discount
 * - individual: optimized_rate minus discount_percentage, minus the referral
 *   discount when pending
 * - fee: 0 while the founding window is active, else feePct of rateCharged
 * - total = rateCharged + platformFee; trainer keeps rateCharged
 */
export function computeDisplayQuote({
  slot,
  trainerProfile,
  feePct,
  foundingStartedAt,
  isFounding,
  referralPending,
  now,
}: {
  slot: QuoteSlot;
  trainerProfile: QuoteTrainer;
  feePct: number;
  foundingStartedAt?: string | null;
  isFounding: boolean;
  referralPending: boolean;
  now?: Date;
}): DisplayQuote {
  const isGroup = slot.slot_type === 'group';
  if (slot.is_intro) {
    return {
      isGroup,
      baseRate: 0,
      discountPct: 0,
      rate: 0,
      referralDiscount: 0,
      rateCharged: 0,
      feePct: 0,
      platformFee: 0,
      total: 0,
      trainerPayout: 0,
    };
  }
  const baseRate = isGroup ? Number(slot.group_rate ?? 0) : Number(trainerProfile.optimized_rate);
  const discountPct = isGroup ? 0 : (trainerProfile.discount_percentage ?? 0);
  const rate = discountPct > 0 ? cents(baseRate * (1 - discountPct / 100)) : baseRate;
  const referralDiscount = !isGroup && referralPending ? Math.min(REFERRAL_DISCOUNT, rate) : 0;
  const rateCharged = cents(rate - referralDiscount);
  const effectiveFeePct = effectivePlatformFee(feePct, foundingStartedAt, isFounding, now);
  const platformFee = cents(rateCharged * effectiveFeePct);
  const total = cents(rateCharged + platformFee);
  return {
    isGroup,
    baseRate,
    discountPct,
    rate,
    referralDiscount,
    rateCharged,
    feePct: effectiveFeePct,
    platformFee,
    total,
    trainerPayout: rateCharged,
  };
}

/** Overlay the server's authoritative numbers on a display quote. */
export function applyServerQuote(display: DisplayQuote, server: ServerQuote): DisplayQuote {
  const rateCharged = Number(server.rate_charged);
  const platformFee = Number(server.platform_fee);
  return {
    ...display,
    rateCharged,
    platformFee,
    total: Number(server.total),
    trainerPayout: Number(server.trainer_payout),
    feePct: server.fee_pct != null ? Number(server.fee_pct) : rateCharged > 0 ? cents(platformFee / rateCharged) : 0,
    referralDiscount: server.referral_discount != null ? Number(server.referral_discount) : display.referralDiscount,
    discountPct: server.discount_pct != null ? Number(server.discount_pct) : display.discountPct,
  };
}
