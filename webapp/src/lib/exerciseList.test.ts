import { describe, it, expect } from 'vitest';
import { EXERCISES, searchExercises, getExerciseByKey } from './exerciseList';

describe('EXERCISES catalog', () => {
  it('contains at least 40 entries', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(40);
  });

  it('every exercise has a non-empty key and name', () => {
    for (const ex of EXERCISES) {
      expect(ex.key.length).toBeGreaterThan(0);
      expect(ex.name.length).toBeGreaterThan(0);
    }
  });
});

describe('searchExercises', () => {
  it('returns all exercises for empty string', () => {
    expect(searchExercises('')).toHaveLength(EXERCISES.length);
  });

  it('returns at least bench_press and incline_bench_press for "bench"', () => {
    const results = searchExercises('bench');
    const keys = results.map((e) => e.key);
    expect(keys).toContain('bench_press');
    expect(keys).toContain('incline_bench_press');
  });

  it('returns empty array for no-match query', () => {
    expect(searchExercises('zzz')).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const lower = searchExercises('squat');
    const upper = searchExercises('SQUAT');
    expect(lower).toEqual(upper);
  });
});

describe('getExerciseByKey', () => {
  it('returns correct entry for "squat"', () => {
    const result = getExerciseByKey('squat');
    expect(result).toBeDefined();
    expect(result?.key).toBe('squat');
    expect(result?.name).toBe('Squat');
    expect(result?.muscleGroup).toBe('legs');
  });

  it('returns undefined for unknown key', () => {
    expect(getExerciseByKey('unknown_exercise')).toBeUndefined();
  });
});
