import { describe, it, expect } from 'vitest';
import { ptWeekBounds, shiftWeek } from './pacificWeek';

describe('ptWeekBounds', () => {
  it("frames Derek's last week (Jul 26 - Aug 1, PDT) around a mid-week session", () => {
    // Wed Jul 29 2026 11:00 PT (18:00Z)
    const w = ptWeekBounds(new Date('2026-07-29T18:00:00Z'));
    expect(w.fromIso).toBe('2026-07-26T07:00:00.000Z'); // Sun 00:00 PDT
    expect(w.toIso).toBe('2026-08-02T07:00:00.000Z');   // next Sun 00:00 PDT
    expect(w.label).toBe('Jul 26 – Aug 1');
  });

  it('computes each bound at its own offset across a spring-forward week', () => {
    // Tue Mar 10 2026 12:00 PT; DST begins Sun Mar 8 2026 02:00.
    const w = ptWeekBounds(new Date('2026-03-10T19:00:00Z'));
    expect(w.fromIso).toBe('2026-03-08T08:00:00.000Z'); // Sun 00:00 PST (-8)
    expect(w.toIso).toBe('2026-03-15T07:00:00.000Z');   // next Sun 00:00 PDT (-7)
    expect(w.label).toBe('Mar 8 – Mar 14');
  });

  it('uses the PT calendar day, not the UTC day, near midnight', () => {
    // Fri Jul 31 2026 21:00 PT is Aug 1 04:00Z — still the Jul 26 week.
    const w = ptWeekBounds(new Date('2026-08-01T04:00:00Z'));
    expect(w.fromIso).toBe('2026-07-26T07:00:00.000Z');
    expect(w.label).toBe('Jul 26 – Aug 1');
  });
});

describe('shiftWeek', () => {
  it('steps back a full week', () => {
    const prev = ptWeekBounds(shiftWeek(new Date('2026-07-29T18:00:00Z'), -1));
    expect(prev.label).toBe('Jul 19 – Jul 25');
    expect(prev.fromIso).toBe('2026-07-19T07:00:00.000Z');
  });

  it('steps forward a full week', () => {
    const next = ptWeekBounds(shiftWeek(new Date('2026-07-29T18:00:00Z'), 1));
    expect(next.label).toBe('Aug 2 – Aug 8');
  });
});
