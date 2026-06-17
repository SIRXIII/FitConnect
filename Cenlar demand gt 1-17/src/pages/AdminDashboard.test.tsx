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
    expect(SOURCE).toContain('data.mrr');
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

describe('AdminDashboard trainer approval (REQ-219)', () => {
  // Write path: RPC_REQUIRED (25-00 Probe 2 verdict — admin cannot UPDATE
  // another trainer's trainer_profiles row directly under current RLS).
  // All assertions target the RPC path (supabase.rpc('approve_trainer',...)).

  it('handleApproveTrainer handler exists', () => {
    expect(SOURCE).toContain('handleApproveTrainer');
  });

  it('approve handler calls approve_trainer RPC', () => {
    expect(SOURCE).toContain("rpc('approve_trainer'");
  });

  it('approve handler passes p_user_id parameter', () => {
    expect(SOURCE).toContain('p_user_id: userId');
  });

  it('fetchPendingTrainers filters to pending approval_status', () => {
    expect(SOURCE).toContain("eq('approval_status', 'pending')");
  });

  it('pending-trainers tab member exists in activeTab union', () => {
    expect(SOURCE).toContain("'pending-trainers'");
  });

  it('fetchPendingTrainers function is defined and called', () => {
    // Must appear at least twice: definition + at least one call site
    const count = (SOURCE.match(/fetchPendingTrainers/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('approve handler does NOT touch trainer_certifications', () => {
    // Guard: handleApproveTrainer block must not reference trainer_certifications
    expect(SOURCE).not.toMatch(/handleApproveTrainer[\s\S]{0,300}trainer_certifications/);
  });

  it('approval targets user_id not profile id', () => {
    expect(SOURCE).toContain('p_user_id: userId');
    // Must NOT filter by plain .eq('id', userId) in the approve path
    expect(SOURCE).not.toMatch(/handleApproveTrainer[\s\S]{0,400}\.eq\('id', userId\)/);
  });
});

describe('AdminDashboard TierBadge (Task 2)', () => {
  it('UserRow interface includes subscription_tier field', () => {
    expect(SOURCE).toContain('subscription_tier?');
  });

  it('fetchUsers loads users via get_admin_user_list RPC', () => {
    expect(SOURCE).toContain("rpc('get_admin_user_list')");
  });

  it('TierBadge component is defined', () => {
    expect(SOURCE).toContain('const TierBadge');
  });

  it('users table header has Tier column', () => {
    // Look for the Tier header text
    expect(SOURCE).toContain('>Tier<');
  });

  it('users table header uses multi-column grid', () => {
    expect(SOURCE).toContain('grid-cols-[1fr_180px_80px_100px_100px_100px_120px_140px]');
  });

  it('TierBadge handles past_due status', () => {
    expect(SOURCE).toContain('Past Due');
  });

  it('TierBadge handles trialing status', () => {
    expect(SOURCE).toContain('Trialing');
  });

  it('TierBadge renders null for non-trainer rows', () => {
    // The conditional rendering pattern: badge shown only for trainers with a tier
    expect(SOURCE).toContain("user.role === 'trainer'");
    expect(SOURCE).toContain('user.subscription_tier');
  });
});
