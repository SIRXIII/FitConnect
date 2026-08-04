import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  scoreTrainer,
  rankAndFilter,
  isPassportReady,
  getCachedMatches,
  setCachedMatches,
  clearMatchCache,
} from './matchScoring';
import type { ClientMatchInput, TrainerMatchInput } from './matchScoring';

// --- Test fixtures ---

const CLIENT: ClientMatchInput = {
  hourly_budget_max: 60,
  goals_ranked: ['weight_loss', 'hiit'],
  workout_types: ['hiit', 'strength_training'],
  fitness_level: 'intermediate',
};

const TRAINER_GOOD: TrainerMatchInput = {
  id: 't1',
  optimized_rate: 55,
  specialty: 'cardio_hiit',
  profiles: { full_name: 'Jane Trainer', avatar_url: null },
};

const TRAINER_BAD: TrainerMatchInput = {
  id: 't2',
  optimized_rate: 120,
  specialty: 'yoga_pilates',
  profiles: { full_name: 'Bob Yoga', avatar_url: null },
};

// --- scoreTrainer ---

describe('scoreTrainer', () => {
  it('returns score >= 60 and label "Great Match" when rate within budget and goals match', () => {
    const result = scoreTrainer(CLIENT, TRAINER_GOOD);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.label).toBe('Great Match');
  });

  it('returns score < 40 when trainer rate is far over budget', () => {
    const result = scoreTrainer(CLIENT, TRAINER_BAD);
    expect(result.score).toBeLessThan(40);
  });

  it('gives neutral price score of 30 when hourly_budget_max is null', () => {
    const clientNoBudget: ClientMatchInput = { ...CLIENT, hourly_budget_max: null };
    const trainerNoGoalMatch: TrainerMatchInput = {
      id: 't3',
      optimized_rate: 80,
      specialty: 'yoga_pilates',
      profiles: { full_name: 'Yoga Pal', avatar_url: null },
    };
    const result = scoreTrainer(clientNoBudget, trainerNoGoalMatch);
    // price score = 30 (neutral), no goal match => goalScore = 0, total = 30
    expect(result.score).toBe(30);
  });

  it('includes goal reason when specialty (cardio_hiit) matches client goal (hiit)', () => {
    const result = scoreTrainer(CLIENT, TRAINER_GOOD);
    const hasGoalReason = result.reasons.some(r => r.includes('HIIT'));
    expect(hasGoalReason).toBe(true);
  });

  it('does not include goal reason when specialty does not match client goals', () => {
    const clientNonMatch: ClientMatchInput = {
      hourly_budget_max: 60,
      goals_ranked: ['weight_loss'],
      workout_types: ['strength_training'],
      fitness_level: 'beginner',
    };
    const trainerYoga: TrainerMatchInput = {
      id: 't4',
      optimized_rate: 50,
      specialty: 'yoga_pilates',
      profiles: { full_name: 'Yoga Pro', avatar_url: null },
    };
    const result = scoreTrainer(clientNonMatch, trainerYoga);
    const goalReasonCount = result.reasons.filter(r => r.includes('goals')).length;
    expect(goalReasonCount).toBe(0);
  });

  it('includes "Within your $60/hr budget" reason when rate fits', () => {
    const result = scoreTrainer(CLIENT, TRAINER_GOOD);
    expect(result.reasons).toContain('Within your $60/hr budget');
  });

  it('includes "Matches your HIIT goals" reason when goals match (label from profileConstants)', () => {
    const result = scoreTrainer(CLIENT, TRAINER_GOOD);
    expect(result.reasons).toContain('Matches your HIIT goals');
  });
});

// --- rankAndFilter ---

describe('rankAndFilter', () => {
  it('returns at most topN results', () => {
    const trainers: TrainerMatchInput[] = [
      { id: 't1', optimized_rate: 50, specialty: 'cardio_hiit', profiles: { full_name: 'A', avatar_url: null } },
      { id: 't2', optimized_rate: 55, specialty: 'strength_training', profiles: { full_name: 'B', avatar_url: null } },
      { id: 't3', optimized_rate: 58, specialty: 'cardio_hiit', profiles: { full_name: 'C', avatar_url: null } },
      { id: 't4', optimized_rate: 60, specialty: 'strength_training', profiles: { full_name: 'D', avatar_url: null } },
    ];
    const results = rankAndFilter(CLIENT, trainers, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('filters out trainers with score below 40', () => {
    const trainers: TrainerMatchInput[] = [
      TRAINER_GOOD,
      TRAINER_BAD, // should be filtered: rate 120, no goals match with our client
    ];
    const results = rankAndFilter(CLIENT, trainers, 3);
    const hasTrainerBad = results.some(r => r.trainer.id === 't2');
    expect(hasTrainerBad).toBe(false);
  });

  it('returns results sorted descending by score', () => {
    const trainers: TrainerMatchInput[] = [
      { id: 'low', optimized_rate: 59, specialty: 'yoga_pilates', profiles: { full_name: 'Low', avatar_url: null } },
      { id: 'high', optimized_rate: 55, specialty: 'cardio_hiit', profiles: { full_name: 'High', avatar_url: null } },
    ];
    const results = rankAndFilter(CLIENT, trainers, 3);
    if (results.length >= 2) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    }
  });
});

// --- isPassportReady ---

describe('isPassportReady', () => {
  it('returns false when fitness_level is null', () => {
    expect(isPassportReady({ fitness_level: null, goals_ranked: ['weight_loss'], workout_types: ['hiit'] })).toBe(false);
  });

  it('returns false when goals_ranked is empty', () => {
    expect(isPassportReady({ fitness_level: 'beginner', goals_ranked: [], workout_types: ['hiit'] })).toBe(false);
  });

  it('returns false when workout_types is empty', () => {
    expect(isPassportReady({ fitness_level: 'beginner', goals_ranked: ['weight_loss'], workout_types: [] })).toBe(false);
  });

  it('returns true when fitness_level, goals_ranked, and workout_types are all present', () => {
    expect(isPassportReady({ fitness_level: 'intermediate', goals_ranked: ['weight_loss'], workout_types: ['hiit'] })).toBe(true);
  });
});

// --- Cache utilities ---

// localStorage mock for cache tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

describe('getCachedMatches', () => {
  const userId = 'user-test-123';

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  it('returns null when no cache exists', () => {
    expect(getCachedMatches(userId)).toBeNull();
  });

  it('returns cached data within 24hr TTL', () => {
    const fakeResults = [{ trainer: TRAINER_GOOD, score: 80, label: 'Great Match', reasons: [] }];
    setCachedMatches(userId, fakeResults);
    const result = getCachedMatches(userId);
    expect(result).not.toBeNull();
    expect(result![0].score).toBe(80);
  });

  it('returns null after 24hr TTL has expired', () => {
    const fakeResults = [{ trainer: TRAINER_GOOD, score: 80, label: 'Great Match', reasons: [] }];
    // Write cache with a timestamp in the past (25 hours ago)
    const expiredTs = Date.now() - (25 * 60 * 60 * 1000);
    localStorage.setItem(`match_cache_${userId}`, JSON.stringify({ data: fakeResults, ts: expiredTs }));
    expect(getCachedMatches(userId)).toBeNull();
  });

  it('clearMatchCache removes the localStorage entry', () => {
    const fakeResults = [{ trainer: TRAINER_GOOD, score: 80, label: 'Great Match', reasons: [] }];
    setCachedMatches(userId, fakeResults);
    clearMatchCache(userId);
    expect(localStorage.getItem(`match_cache_${userId}`)).toBeNull();
  });
});
