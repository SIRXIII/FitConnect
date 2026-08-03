import type { SetEntry } from '../types/workout';

/**
 * Convert a weight value between lbs and kg.
 * Same unit returns the input unchanged.
 * lbs -> kg: rounded to 1 decimal place.
 * kg -> lbs: rounded to the nearest integer.
 */
export function convertWeight(
  weight: number,
  from: 'lbs' | 'kg',
  to: 'lbs' | 'kg',
): number {
  if (from === to) return weight;
  if (from === 'lbs' && to === 'kg') {
    return Math.round(weight * 0.453592 * 10) / 10;
  }
  // kg -> lbs
  return Math.round(weight * 2.20462);
}

/**
 * Format a single set as "{reps} x {weight}{unit}".
 * Example: "10 x 135lbs"
 */
export function formatSet(set: SetEntry): string {
  return `${set.reps} x ${set.weight}${set.unit}`;
}

/**
 * Format a set count summary.
 * Example: "3 sets"
 */
export function formatSetSummary(sets: SetEntry[]): string {
  return `${sets.length} sets`;
}
