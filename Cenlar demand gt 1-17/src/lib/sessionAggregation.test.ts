import { describe, it, expect } from 'vitest';
import { aggregateByWeek } from './sessionAggregation';
import type { WeeklyPoint } from './sessionAggregation';

describe('aggregateByWeek', () => {
  it('Test 1: returns empty array for empty logs', () => {
    const result = aggregateByWeek([]);
    expect(result).toEqual([]);
  });

  it('Test 2: single log with exercises sums sets correctly', () => {
    const result = aggregateByWeek([
      {
        slot_start: '2026-03-16T10:00:00Z', // Monday
        exercises: [
          { name: 'Squats', sets: 3, reps: 12 },
          { name: 'Bench', sets: 4, reps: 8 },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].sessions).toBe(1);
    expect(result[0].sets).toBe(7);
    expect(result[0].week).toBe('Mar 16');
  });

  it('Test 3: two logs in same ISO week merge into one WeeklyPoint', () => {
    const result = aggregateByWeek([
      {
        slot_start: '2026-03-16T10:00:00Z', // Monday
        exercises: [{ name: 'Squats', sets: 3, reps: 12 }],
      },
      {
        slot_start: '2026-03-18T10:00:00Z', // Wednesday same week
        exercises: [{ name: 'Bench', sets: 4, reps: 8 }],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].sessions).toBe(2);
    expect(result[0].sets).toBe(7);
  });

  it('Test 4: logs from different weeks produce sorted array (earliest first)', () => {
    const result = aggregateByWeek([
      {
        slot_start: '2026-03-16T10:00:00Z', // week of Mar 16
        exercises: [{ name: 'Squats', sets: 2, reps: 10 }],
      },
      {
        slot_start: '2026-03-09T10:00:00Z', // week of Mar 9
        exercises: [{ name: 'Bench', sets: 3, reps: 8 }],
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].week).toBe('Mar 9');
    expect(result[1].week).toBe('Mar 16');
  });

  it('Test 5: log with empty exercises array contributes sessions=1, sets=0', () => {
    const result = aggregateByWeek([
      {
        slot_start: '2026-03-16T10:00:00Z',
        exercises: [],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].sessions).toBe(1);
    expect(result[0].sets).toBe(0);
  });
});
