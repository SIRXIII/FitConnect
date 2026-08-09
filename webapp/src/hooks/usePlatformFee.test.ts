import { describe, it, expect } from 'vitest';
import { effectivePlatformFee, isFoundingTrainer } from './usePlatformFee';

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
  it('is 0 for a founding trainer within 12 months of joining', () => {
    const now = new Date('2026-08-10T00:00:00Z');
    expect(effectivePlatformFee(FEE, '2026-03-15T00:00:00Z', CUTOFF, now)).toBe(0);
  });

  it('reverts to the standard fee 12 months after joining', () => {
    const now = new Date('2027-03-16T00:00:00Z');
    expect(effectivePlatformFee(FEE, '2026-03-15T00:00:00Z', CUTOFF, now)).toBe(FEE);
  });

  it('charges the standard fee for post-cutoff trainers immediately', () => {
    const now = new Date('2026-11-02T00:00:00Z');
    expect(effectivePlatformFee(FEE, '2026-11-01T00:00:00Z', CUTOFF, now)).toBe(FEE);
  });

  it('falls back to the standard fee when trainer join date is unknown', () => {
    expect(effectivePlatformFee(FEE, null, CUTOFF)).toBe(FEE);
  });
});
