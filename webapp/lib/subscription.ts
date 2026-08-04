import { supabase } from '@/lib/supabase';
import type { Tier, TierFeature } from '@/lib/tierGates';
import { TIER_GATES } from '@/lib/tierGates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BillingInterval = 'month' | 'year';

export interface PlanPricing {
  tier: Tier;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  annualMonthly: number;
  features: string[];
  highlighted: boolean;
}

// ---------------------------------------------------------------------------
// Pricing data
// ---------------------------------------------------------------------------

export const PRICING_DATA: PlanPricing[] = [
  {
    tier: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    annualMonthly: 0,
    features: [
      'Up to 3 visible availability slots',
      'Basic trainer profile',
      'Standard bio (280 characters)',
      'Standard search ranking',
    ],
    highlighted: false,
  },
  {
    tier: 'pro',
    name: 'Pro',
    monthlyPrice: 9,
    annualPrice: 86.4,
    annualMonthly: 7.2,
    features: [
      'Up to 10 visible availability slots',
      'Extended bio (1,000 characters)',
      'Advanced analytics dashboard',
      'Priority search ranking',
      '30-day free trial',
    ],
    highlighted: true,
  },
  {
    tier: 'elite',
    name: 'Elite',
    monthlyPrice: 29,
    annualPrice: 278.4,
    annualMonthly: 23.2,
    features: [
      'Unlimited visible availability slots',
      'Extended bio (1,000 characters)',
      'Advanced analytics dashboard',
      'Priority search ranking',
      'Featured on landing page',
      '30-day free trial',
    ],
    highlighted: false,
  },
];

// ---------------------------------------------------------------------------
// Edge Function caller
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function callEdgeFunction<T>(
  fnName: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) {
    throw new Error('Session expired -- please sign in again.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload?.error ?? `Edge Function error (${res.status})`);
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export async function startTrial(
  tier: 'pro' | 'elite',
  interval: BillingInterval,
): Promise<{ subscriptionId: string; status: string }> {
  return callEdgeFunction<{ subscriptionId: string; status: string }>(
    'create-subscription',
    { tier, interval },
  );
}

export async function getPortalUrl(): Promise<{ url: string }> {
  return callEdgeFunction<{ url: string }>('manage-subscription');
}

export async function setAdminTierOverride(
  trainerId: string,
  tier: 'free' | 'pro' | 'elite',
): Promise<{ success: boolean }> {
  return callEdgeFunction<{ success: boolean }>(
    'admin-set-tier-override',
    { trainerId, tier },
  );
}

export function featuresLostOnDowngrade(
  from: Tier,
  to: Tier,
): TierFeature[] {
  return (Object.entries(TIER_GATES) as [TierFeature, Tier[]][]).filter(
    ([, tiers]) => tiers.includes(from) && !tiers.includes(to),
  ).map(([feature]) => feature);
}
