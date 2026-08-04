import type { ExerciseEntry } from '@/types/session';

export interface SessionLogForChart {
  slot_start: string; // availability_slots.start_time from joined query
  exercises: ExerciseEntry[] | unknown;
}

export interface WeeklyPoint {
  week: string;    // formatted as "Mar 10" (short month + day of week start)
  sessions: number;
  sets: number;
}

// Returns ISO week number for a given date
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Returns the Monday of the ISO week containing date
function getISOWeekMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

export function aggregateByWeek(logs: SessionLogForChart[]): WeeklyPoint[] {
  if (logs.length === 0) return [];

  // Map: weekKey ("YYYY-WXX") -> { sessions, sets, monday }
  const map = new Map<string, { sessions: number; sets: number; monday: Date }>();

  for (const log of logs) {
    const date = new Date(log.slot_start);
    const year = date.getUTCFullYear();
    const week = getISOWeek(date);
    const weekKey = `${year}-W${String(week).padStart(2, '0')}`;

    const entries = (Array.isArray(log.exercises) ? log.exercises : []) as ExerciseEntry[];
    const totalSets = entries.reduce((acc, e) => acc + (e.sets || 0), 0);

    const existing = map.get(weekKey);
    if (existing) {
      existing.sessions += 1;
      existing.sets += totalSets;
    } else {
      map.set(weekKey, {
        sessions: 1,
        sets: totalSets,
        monday: getISOWeekMonday(date),
      });
    }
  }

  // Sort by week key (lexicographic sort works for YYYY-WXX)
  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return sorted.map(([, value]) => ({
    week: value.monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    sessions: value.sessions,
    sets: value.sets,
  }));
}
