import { describe, it, expect } from 'vitest';
import { convertWeight, formatSet, formatSetSummary } from './workoutUtils';
import type { SetEntry } from '../types/workout';

describe('convertWeight', () => {
  it('converts 135 lbs to 61.2 kg', () => {
    expect(convertWeight(135, 'lbs', 'kg')).toBe(61.2);
  });

  it('converts 60 kg to 132 lbs', () => {
    expect(convertWeight(60, 'kg', 'lbs')).toBe(132);
  });

  it('returns same value when from === to (lbs)', () => {
    expect(convertWeight(100, 'lbs', 'lbs')).toBe(100);
  });

  it('returns same value when from === to (kg)', () => {
    expect(convertWeight(80, 'kg', 'kg')).toBe(80);
  });
});

describe('formatSet', () => {
  it('formats a set as "reps x weightunit"', () => {
    const set: SetEntry = { reps: 10, weight: 135, unit: 'lbs' };
    expect(formatSet(set)).toBe('10 x 135lbs');
  });

  it('works with kg unit', () => {
    const set: SetEntry = { reps: 8, weight: 60, unit: 'kg' };
    expect(formatSet(set)).toBe('8 x 60kg');
  });
});

describe('formatSetSummary', () => {
  it('formats 3 sets as "3 sets"', () => {
    const sets: SetEntry[] = [
      { reps: 10, weight: 135, unit: 'lbs' },
      { reps: 10, weight: 135, unit: 'lbs' },
      { reps: 8, weight: 145, unit: 'lbs' },
    ];
    expect(formatSetSummary(sets)).toBe('3 sets');
  });

  it('formats 1 set as "1 sets"', () => {
    const sets: SetEntry[] = [{ reps: 5, weight: 100, unit: 'kg' }];
    expect(formatSetSummary(sets)).toBe('1 sets');
  });

  it('formats 0 sets as "0 sets"', () => {
    expect(formatSetSummary([])).toBe('0 sets');
  });
});
