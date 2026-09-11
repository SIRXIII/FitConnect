import { describe, it, expect } from 'vitest';
import { toWorkoutLog, toSessionEntry } from './trainerSessionLogs';

// Fixture: one trainer_session_logs row with children returned out of sort order,
// null reps/weight_kg, an exercise with no sets, and no trainer_profiles embed.
const fixtureRow = {
  id: 'log-1',
  booking_id: null,
  client_id: 'client-1',
  session_date: '2026-09-02',
  session_notes: 'Great session',
  created_at: '2026-09-02T18:00:00.000Z',
  trainer_session_exercises: [
    {
      id: 'ex-a',
      exercise_name: 'Bench Press',
      exercise_key: 'bench',
      sort_order: 1,
      trainer_exercise_sets: [
        { set_number: 2, reps: 8, weight_kg: 20 },
        { set_number: 1, reps: null, weight_kg: null },
      ],
    },
    {
      id: 'ex-b',
      exercise_name: 'Squat',
      exercise_key: 'squat',
      sort_order: 0,
      trainer_exercise_sets: [],
    },
  ],
  trainer_profiles: null,
};

describe('toWorkoutLog', () => {
  const log = toWorkoutLog(fixtureRow);

  it('maps a date-only session_date to the same calendar day locally', () => {
    const logged = new Date(log.logged_at);
    expect(logged.getDate()).toBe(2);
    expect(logged.getMonth()).toBe(8); // September, 0-indexed
  });

  it('sorts exercises by sort_order', () => {
    expect(log.workout_exercises.map((e) => e.exercise_name)).toEqual(['Squat', 'Bench Press']);
  });

  it('sorts sets by set_number and maps null reps to 0, null weight_kg to 0', () => {
    const benchSets = log.workout_exercises[1].sets;
    expect(benchSets[0]).toEqual({ reps: 0, weight: 0, unit: 'lbs' });
    expect(benchSets[1].reps).toBe(8);
  });

  it('converts weight_kg 20 to 44 lbs', () => {
    expect(log.workout_exercises[1].sets[1].weight).toBe(44);
  });

  it('is null when the trainer_profiles embed is missing', () => {
    expect(log.trainer_name).toBeNull();
  });
});

describe('toSessionEntry', () => {
  const entry = toSessionEntry(fixtureRow);

  it('sorts exercises by sort_order', () => {
    expect(entry.exercises.map((e) => e.name)).toEqual(['Squat', 'Bench Press']);
  });

  it('never lets Math.max yield -Infinity for an exercise with no sets', () => {
    expect(entry.exercises[0]).toEqual({ name: 'Squat', sets: 0, reps: 0 });
  });

  it('reports set count and max reps for an exercise with sets', () => {
    expect(entry.exercises[1]).toEqual({ name: 'Bench Press', sets: 2, reps: 8 });
  });

  it('is null when the trainer_profiles embed is missing', () => {
    expect(entry.trainer_name).toBeNull();
  });
});
