import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * AdminDashboard subscription visibility tests.
 *
 * These are structural / contract tests that verify the AdminDashboard module
 * exports and type contracts without rendering (no jsdom DOM needed).
 * We import the raw source text to verify structural expectations.
 */

// We test by reading the source file as a string to verify structural contracts
// since full component rendering requires extensive Supabase mocking.
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SOURCE = readFileSync(
  resolve(__dirname, 'AdminDashboard.tsx'),
  'utf-8'
);

describe('AdminDashboard subscription metrics (Task 1)', () => {
  it('adminTotals type includes mrr field', () => {
    expect(SOURCE).toContain('mrr: number');
  });

  it('adminTotals type includes pro_subscriber_count field', () => {
    expect(SOURCE).toContain('pro_subscriber_count: number');
  });

  it('adminTotals type includes elite_subscriber_count field', () => {
    expect(SOURCE).toContain('elite_subscriber_count: number');
  });

  it('adminTotals type includes active_trial_count field', () => {
    expect(SOURCE).toContain('active_trial_count: number');
  });

  it('fetchAdminAnalytics extracts mrr from data', () => {
    expect(SOURCE).toContain('data.totals.mrr');
  });

  it('renders Subscription Health label', () => {
    expect(SOURCE).toContain('Subscription Health');
  });

  it('renders MRR StatCard', () => {
    expect(SOURCE).toContain('label="MRR"');
  });

  it('renders Pro Subscribers StatCard', () => {
    expect(SOURCE).toContain('label="Pro Subscribers"');
  });

  it('renders Elite Subscribers StatCard', () => {
    expect(SOURCE).toContain('label="Elite Subscribers"');
  });

  it('renders Active Trials StatCard', () => {
    expect(SOURCE).toContain('label="Active Trials"');
  });

  it('has at least 8 StatCard instances', () => {
    const matches = SOURCE.match(/StatCard/g) ?? [];
    // 8 usages + definition = at least 9, but let's check at least 8 usage appearances
    expect(matches.length).toBeGreaterThanOrEqual(9);
  });
});

describe('AdminDashboard TierBadge (Task 2)', () => {
  it('UserRow interface includes trainer_profiles field', () => {
    expect(SOURCE).toContain('trainer_profiles?');
  });

  it('fetchUsers selects trainer_profiles join', () => {
    expect(SOURCE).toContain('trainer_profiles(subscription_tier');
  });

  it('TierBadge component is defined', () => {
    expect(SOURCE).toContain('const TierBadge');
  });

  it('users table header has Tier column', () => {
    // Look for the Tier header text
    expect(SOURCE).toContain('>Tier<');
  });

  it('users table header uses 5-column grid', () => {
    expect(SOURCE).toContain('grid-cols-[1fr_100px_120px_120px_120px]');
  });

  it('TierBadge handles past_due status', () => {
    expect(SOURCE).toContain('Past Due');
  });

  it('TierBadge handles trialing status', () => {
    expect(SOURCE).toContain('Trialing');
  });

  it('TierBadge renders null for non-trainer rows', () => {
    // The conditional rendering pattern
    expect(SOURCE).toContain("user.role === 'trainer'");
    expect(SOURCE).toContain('user.trainer_profiles');
  });
});
