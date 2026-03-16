import { describe, it, expect } from 'vitest';
import { rankTrainers } from './useTrainers';
import type { TrainerWithProfile } from './useTrainers';

// Helper: create a minimal TrainerWithProfile with only the fields rankTrainers uses
function makeTrainer({ id, ...rest }: Partial<TrainerWithProfile> & { id: string }): TrainerWithProfile {
  return {
    id,
    user_id: 'u1',
    specialty: 'strength_training',
    bio: null,
    hourly_rate: 100,
    optimized_rate: 100,
    discount_percentage: 0,
    location: 'New York',
    latitude: null,
    longitude: null,
    certifications: [],
    verified: true,
    rating: 4.5,
    review_count: 10,
    stripe_account_id: null,
    subscription_tier: 'free',
    subscription_status: null,
    stripe_customer_id: null,
    subscription_id: null,
    subscription_interval: null,
    trial_ends_at: null,
    current_period_end: null,
    cancel_at_period_end: false,
    tier_overridden_by: null,
    tier_overridden_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { full_name: 'Test Trainer', avatar_url: null },
    ...rest,
  } as unknown as TrainerWithProfile;
}

describe('rankTrainers tier signal', () => {
  const slotCounts = { elite1: 5, pro1: 5, free1: 5 };

  it('elite ranks above pro when all other scores equal', () => {
    const trainers = [
      makeTrainer({ id: 'pro1',   subscription_tier: 'pro',   rating: 4.5, discount_percentage: 10 }),
      makeTrainer({ id: 'elite1', subscription_tier: 'elite', rating: 4.5, discount_percentage: 10 }),
    ];
    const ranked = rankTrainers(trainers, slotCounts);
    expect(ranked[0].id).toBe('elite1');
  });

  it('pro ranks above free when all other scores equal', () => {
    const trainers = [
      makeTrainer({ id: 'free1', subscription_tier: 'free', rating: 4.5, discount_percentage: 10 }),
      makeTrainer({ id: 'pro1',  subscription_tier: 'pro',  rating: 4.5, discount_percentage: 10 }),
    ];
    const ranked = rankTrainers(trainers, { free1: 5, pro1: 5 });
    expect(ranked[0].id).toBe('pro1');
  });

  it('elite ranks above free when all other scores equal', () => {
    const trainers = [
      makeTrainer({ id: 'free1',  subscription_tier: 'free',  rating: 4.5 }),
      makeTrainer({ id: 'elite1', subscription_tier: 'elite', rating: 4.5 }),
    ];
    const ranked = rankTrainers(trainers, { free1: 5, elite1: 5 });
    expect(ranked[0].id).toBe('elite1');
  });
});
