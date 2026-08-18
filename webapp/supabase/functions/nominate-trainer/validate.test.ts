import { describe, it, expect } from 'vitest';
import { validateNomination, US_STATE_CODES } from './validate';

// Covers the normalize/validate contract the edge function relies on before
// ever touching the database or the rate limiter.

describe('validateNomination', () => {
  it('accepts a happy-path submission and returns normalized data', () => {
    const result = validateNomination({
      first_name: '  Jordan  ',
      city: '  austin  ',
      state: 'tx',
    });
    expect(result).toEqual({
      ok: true,
      data: { first_name: 'Jordan', city: 'Austin', state: 'TX' },
    });
  });

  it('title-cases multi-word cities ("san francisco" -> "San Francisco")', () => {
    const result = validateNomination({
      first_name: 'Alex',
      city: 'san francisco',
      state: 'CA',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.city).toBe('San Francisco');
    }
  });

  it('rejects a state not in the 50 + DC whitelist', () => {
    const result = validateNomination({
      first_name: 'Alex',
      city: 'Metropolis',
      state: 'ZZ',
    });
    expect(result).toEqual({ ok: false, error: 'Please select a valid state' });
  });

  it('rejects a missing first name', () => {
    const result = validateNomination({
      first_name: '',
      city: 'Fresno',
      state: 'CA',
    });
    expect(result).toEqual({ ok: false, error: 'First name is required' });
  });

  it('rejects a malformed nominee email', () => {
    const result = validateNomination({
      first_name: 'Alex',
      city: 'Fresno',
      state: 'CA',
      nominee_email: 'not-an-email',
    });
    expect(result).toEqual({ ok: false, error: 'Please enter a valid nominee email' });
  });

  it('accepts a submission with all optional nominee fields absent', () => {
    const result = validateNomination({
      first_name: 'Alex',
      city: 'Fresno',
      state: 'CA',
    });
    expect(result).toEqual({
      ok: true,
      data: { first_name: 'Alex', city: 'Fresno', state: 'CA' },
    });
  });

  it('normalizes a present nominee email to lowercase and keeps optional fields', () => {
    const result = validateNomination({
      first_name: 'Alex',
      city: 'Fresno',
      state: 'CA',
      nominee_name: 'Sam Rivera',
      nominee_email: 'Sam@Example.COM',
      nominee_phone: '555-0100',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        first_name: 'Alex',
        city: 'Fresno',
        state: 'CA',
        nominee_name: 'Sam Rivera',
        nominee_email: 'sam@example.com',
        nominee_phone: '555-0100',
      },
    });
  });

  it('exports exactly 51 state codes (50 states + DC)', () => {
    expect(US_STATE_CODES.length).toBe(51);
    expect(US_STATE_CODES).toContain('DC');
  });
});
