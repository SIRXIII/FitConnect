import { describe, it, expect, vi } from 'vitest';
import { effectivePlatformFee, isFoundingTrainer, parseSettingDate } from './usePlatformFee';

// The hook module imports the Supabase client; the pure helpers under test don't need it.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const CUTOFF = '2026-10-01';
const FEE = 0.13;

describe('isFoundingTrainer', () => {
  it('is true for trainers who joined before the cutoff', () => {
    expect(isFoundingTrainer('2026-03-15T00:00:00Z', CUTOFF)).toBe(true);
  });

  it('is false for trainers who joined on/after the cutoff', () => {
    expect(isFoundingTrainer('2026-10-01T00:00:00Z', CUTOFF)).toBe(false);
    expect(isFoundingTrainer('2027-01-01T00:00:00Z', CUTOFF)).toBe(false);
  });

  it('is false for missing or invalid inputs', () => {
    expect(isFoundingTrainer(null, CUTOFF)).toBe(false);
    expect(isFoundingTrainer('2026-03-15T00:00:00Z', null)).toBe(false);
    expect(isFoundingTrainer('not-a-date', CUTOFF)).toBe(false);
  });
});

describe('effectivePlatformFee', () => {
  const now = new Date('2026-09-05T00:00:00Z');

  it('is 0 for a founding trainer whose benefit has not started yet', () => {
    expect(effectivePlatformFee(FEE, null, true, now)).toBe(0);
    expect(effectivePlatformFee(FEE, undefined, true, now)).toBe(0);
  });

  it('is 0 for a founding trainer within 12 months of the benefit start', () => {
    expect(effectivePlatformFee(FEE, '2026-06-18T00:00:00Z', true, now)).toBe(0);
    // Last instant of the window still counts.
    expect(effectivePlatformFee(FEE, '2026-06-18T00:00:00Z', true, new Date('2027-06-17T23:59:59Z'))).toBe(0);
  });

  it('reverts to the standard fee 12 months after the benefit start', () => {
    expect(effectivePlatformFee(FEE, '2026-06-18T00:00:00Z', true, new Date('2027-06-18T00:00:00Z'))).toBe(FEE);
  });

  it('charges the standard fee for non-founding trainers regardless of the start column', () => {
    expect(effectivePlatformFee(FEE, null, false, now)).toBe(FEE);
    expect(effectivePlatformFee(FEE, '2026-06-18T00:00:00Z', false, now)).toBe(FEE);
  });

  it('defaults to non-founding when the flag is omitted', () => {
    expect(effectivePlatformFee(FEE)).toBe(FEE);
  });
});

describe('parseSettingDate (promo ticker window)', () => {
  it('reads a YYYY-MM-DD setting as that local calendar day', () => {
    // new Date('2026-12-01') would be UTC midnight, which is Nov 30 in the US
    // and would make the ticker advertise the wrong end date.
    const d = parseSettingDate('2026-12-01');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(11);
    expect(d!.getDate()).toBe(1);
    expect(d!.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })).toBe('December 1');
  });

  it('returns null for missing or unparseable values so the ticker stays hidden', () => {
    expect(parseSettingDate(null)).toBeNull();
    expect(parseSettingDate(undefined)).toBeNull();
    expect(parseSettingDate('')).toBeNull();
    expect(parseSettingDate('not-a-date')).toBeNull();
  });

  it('supports the active/expired comparison the ticker gates on', () => {
    expect(new Date('2026-09-10') < parseSettingDate('2026-12-01')!).toBe(true);
    expect(new Date('2027-01-05') < parseSettingDate('2026-12-01')!).toBe(false);
  });
});
