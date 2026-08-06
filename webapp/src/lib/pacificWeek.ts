// Pacific-time week bounds, no date library.
//
// The Payouts "View" modal shows a trainer's sessions one PT week at a time
// (Sunday 00:00 PT .. next Sunday 00:00 PT) and passes those bounds to the
// get_admin_trainer_sessions RPC as UTC instants. PT's offset flips between
// PST (-08) and PDT (-07), and a single week can straddle a DST change, so each
// bound's offset is computed at that bound's own instant rather than assumed.

const TZ = 'America/Los_Angeles';

// Offset (ms) of `instant` in TZ: (TZ wall-clock read as if UTC) - instant.
// Negative for Pacific (e.g. -7h in PDT).
function tzOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== 'literal') m[p.type] = Number(p.value);
  const asUtc = Date.UTC(m.year, m.month - 1, m.day, m.hour % 24, m.minute, m.second);
  return asUtc - instant.getTime();
}

// The instant when PT wall-clock reads (y, m, d) 00:00:00. Two-pass so a DST
// transition on that day resolves to the correct offset.
function ptMidnight(y: number, m: number, d: number): Date {
  const wallAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  let instant = wallAsUtc - tzOffsetMs(new Date(wallAsUtc));
  instant = wallAsUtc - tzOffsetMs(new Date(instant));
  return new Date(instant);
}

// PT calendar year/month/day/weekday(0=Sun) of an instant.
function ptParts(instant: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    y: Number(map.year), m: Number(map.month), d: Number(map.day),
    weekday: weekdays.indexOf(map.weekday),
  };
}

export interface PacificWeek {
  fromIso: string; // Sunday 00:00 PT, as UTC ISO
  toIso: string;   // next Sunday 00:00 PT, as UTC ISO (exclusive)
  label: string;   // e.g. "Jul 26 – Aug 1"
}

export function ptWeekBounds(anchor: Date): PacificWeek {
  const { y, m, d, weekday } = ptParts(anchor);
  // Walk the calendar (DST-agnostic UTC counter) back to Sunday, forward a week.
  const cal = new Date(Date.UTC(y, m - 1, d));
  cal.setUTCDate(cal.getUTCDate() - weekday);
  const sun = { y: cal.getUTCFullYear(), m: cal.getUTCMonth() + 1, d: cal.getUTCDate() };
  cal.setUTCDate(cal.getUTCDate() + 6);
  const sat = { y: cal.getUTCFullYear(), m: cal.getUTCMonth() + 1, d: cal.getUTCDate() };
  cal.setUTCDate(cal.getUTCDate() + 1);
  const nextSun = { y: cal.getUTCFullYear(), m: cal.getUTCMonth() + 1, d: cal.getUTCDate() };

  const from = ptMidnight(sun.y, sun.m, sun.d);
  const to = ptMidnight(nextSun.y, nextSun.m, nextSun.d);
  const fmt = (instant: Date) =>
    instant.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric' });

  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    label: `${fmt(from)} – ${fmt(ptMidnight(sat.y, sat.m, sat.d))}`,
  };
}

// Move the anchor by whole weeks. A 7-day jump lands solidly inside the target
// week even if a DST change shifts the wall clock by an hour.
export function shiftWeek(anchor: Date, direction: number): Date {
  return new Date(anchor.getTime() + direction * 7 * 24 * 60 * 60 * 1000);
}
