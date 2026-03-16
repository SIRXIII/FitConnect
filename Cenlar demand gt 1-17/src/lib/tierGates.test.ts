import { describe, it, expect } from 'vitest';
import { TIER_GATES, bioLimitForTier } from './tierGates';

describe('TIER_GATES', () => {
  it('analytics_advanced requires pro or elite', () => {
    expect(TIER_GATES.analytics_advanced).toContain('pro');
    expect(TIER_GATES.analytics_advanced).toContain('elite');
    expect(TIER_GATES.analytics_advanced).not.toContain('free');
  });
  it('extended_bio requires pro or elite', () => {
    expect(TIER_GATES.extended_bio).toContain('pro');
    expect(TIER_GATES.extended_bio).not.toContain('free');
  });
  it('featured_landing is elite-only', () => {
    expect(TIER_GATES.featured_landing).toEqual(['elite']);
  });
  it('priority_search requires pro or elite', () => {
    expect(TIER_GATES.priority_search).toContain('pro');
    expect(TIER_GATES.priority_search).not.toContain('free');
  });
});

describe('bioLimitForTier', () => {
  it('free tier limit is 280', () => expect(bioLimitForTier('free')).toBe(280));
  it('pro tier limit is 1000', () => expect(bioLimitForTier('pro')).toBe(1000));
  it('elite tier limit is 1000', () => expect(bioLimitForTier('elite')).toBe(1000));
});
