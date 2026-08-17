import { describe, it, expect } from 'vitest';
import { stripeSetupState } from './stripeStatus';

describe('stripeSetupState', () => {
  it('returns none for null profile', () => {
    expect(stripeSetupState(null)).toBe('none');
  });
  it('returns none for undefined profile', () => {
    expect(stripeSetupState(undefined)).toBe('none');
  });
  it('returns none when stripe_account_id is missing', () => {
    expect(stripeSetupState({ stripe_account_id: null, payouts_enabled: true })).toBe('none');
  });
  it('returns incomplete when payouts_enabled is false', () => {
    expect(stripeSetupState({ stripe_account_id: 'acct_123', payouts_enabled: false })).toBe('incomplete');
  });
  it('returns connected when payouts_enabled is true', () => {
    expect(stripeSetupState({ stripe_account_id: 'acct_123', payouts_enabled: true })).toBe('connected');
  });
  it('returns incomplete when payouts_enabled is null', () => {
    expect(stripeSetupState({ stripe_account_id: 'acct_123', payouts_enabled: null })).toBe('incomplete');
  });
});
