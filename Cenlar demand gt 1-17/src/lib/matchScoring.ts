// matchScoring.ts — Pure deterministic scoring engine for AI trainer-client matching.
// Phase 25-01: No external APIs, no ML, 100-point scale.

import { FITNESS_GOALS, WORKOUT_TYPES } from '@/lib/profileConstants';

// --- Types ---

export interface ClientMatchInput {
  hourly_budget_max: number | null;
  goals_ranked: string[];
  workout_types: string[];
  fitness_level: string | null;
}

export interface TrainerMatchInput {
  id: string;
  slug?: string | null;
  optimized_rate: number;
  specialty: string;
  profiles: { full_name: string; avatar_url: string | null };
}

export interface MatchResult {
  trainer: TrainerMatchInput;
  score: number;   // 0-100
  label: string;   // "Great Match" | "Good Match" | "Fair Match"
  reasons: string[];
}

// --- Specialty -> workout type mapping ---
// trainer_profiles stores a single specialty string; we expand it to comparable workout types.

const specialtyToWorkoutTypes: Record<string, string[]> = {
  strength_training: ['strength_training'],
  cardio_hiit: ['cardio', 'hiit'],
  yoga_pilates: ['yoga', 'pilates'],
  nutrition_coaching: ['general_fitness', 'weight_loss'],
  injury_rehabilitation: ['rehabilitation'],
};

// --- Label lookup helpers (from profileConstants) ---

function getGoalLabel(value: string): string | null {
  const goal = FITNESS_GOALS.find(g => g.value === value);
  if (goal) return goal.label;
  const workout = WORKOUT_TYPES.find(w => w.value === value);
  if (workout) return workout.label;
  return null;
}

// --- Core scoring ---

/**
 * Score a single trainer against a client's passport.
 * Price fit: 60pts max (primary factor).
 * Goals alignment: 40pts max (secondary factor).
 */
export function scoreTrainer(client: ClientMatchInput, trainer: TrainerMatchInput): MatchResult {
  // --- Price score (60 pts max) ---
  let priceScore = 0;
  let priceReason: string | null = null;

  if (client.hourly_budget_max !== null) {
    if (trainer.optimized_rate <= client.hourly_budget_max) {
      priceScore = 60;
      priceReason = `Within your $${client.hourly_budget_max}/hr budget`;
    } else {
      // Partial credit: proportional penalty for going over budget
      const overage = (trainer.optimized_rate - client.hourly_budget_max) / client.hourly_budget_max;
      priceScore = Math.max(0, Math.round(60 * (1 - overage)));
    }
  } else {
    priceScore = 30; // neutral when no budget preference set
  }

  // --- Goals + specialty score (40 pts max) ---
  let goalScore = 0;
  let goalReason: string | null = null;

  const trainerWorkouts = specialtyToWorkoutTypes[trainer.specialty] ?? [];
  const clientInterests = [...client.goals_ranked, ...client.workout_types];
  const matches = trainerWorkouts.filter(w => clientInterests.includes(w));

  if (matches.length > 0) {
    goalScore = Math.min(40, matches.length * 20);
    // Use real label from profileConstants for the best-matching type
    const bestMatchLabel = getGoalLabel(matches[0]);
    const displayLabel = bestMatchLabel ?? matches[0].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    goalReason = `Matches your ${displayLabel} goals`;
  }

  // --- Totals ---
  const score = Math.min(100, priceScore + goalScore);
  const label = score >= 80 ? 'Great Match' : score >= 60 ? 'Good Match' : 'Fair Match';

  const reasons: string[] = [];
  if (priceReason) reasons.push(priceReason);
  if (goalReason) reasons.push(goalReason);

  return { trainer, score, label, reasons };
}

/**
 * Score all trainers, filter out poor matches (score < 40), sort descending, return top N.
 */
export function rankAndFilter(
  client: ClientMatchInput,
  trainers: TrainerMatchInput[],
  topN = 3
): MatchResult[] {
  return trainers
    .map(t => scoreTrainer(client, t))
    .filter(r => r.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Passport completeness gate: requires fitness_level + at least 1 goal + at least 1 workout type.
 * Below this threshold, the matching carousel shows a "Complete your passport" prompt instead.
 */
export function isPassportReady(cp: {
  fitness_level: string | null;
  goals_ranked: string[];
  workout_types: string[];
}): boolean {
  return !!(
    cp.fitness_level &&
    cp.goals_ranked.length >= 1 &&
    cp.workout_types.length >= 1
  );
}

// --- Cache utilities (localStorage, 24hr TTL) ---

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Read cached match results for a user. Returns null if no cache or TTL expired.
 */
export function getCachedMatches(userId: string): MatchResult[] | null {
  const raw = localStorage.getItem(`match_cache_${userId}`);
  if (!raw) return null;
  try {
    const { data, ts } = JSON.parse(raw) as { data: MatchResult[]; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Write match results to localStorage with current timestamp.
 */
export function setCachedMatches(userId: string, results: MatchResult[]): void {
  localStorage.setItem(
    `match_cache_${userId}`,
    JSON.stringify({ data: results, ts: Date.now() })
  );
}

/**
 * Bust the match cache for a user (called on any ClientPassport save).
 */
export function clearMatchCache(userId: string): void {
  localStorage.removeItem(`match_cache_${userId}`);
}
