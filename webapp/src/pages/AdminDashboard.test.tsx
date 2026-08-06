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

  it('fetchAdminAnalytics extracts mrr from the analytics RPC payload', () => {
    expect(SOURCE).toContain('mrr: Number(data.mrr ?? 0)');
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

  it('fetchPendingTrainers uses the pending-trainer admin RPC', () => {
    expect(SOURCE).toContain("rpc('get_admin_pending_trainers')");
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
  it('UserRow includes the flattened subscription fields returned by the admin RPC', () => {
    expect(SOURCE).toContain("subscription_tier?: 'free' | 'pro' | 'elite' | null");
    expect(SOURCE).toContain("subscription_status?: 'inactive' | 'trialing' | 'active'");
  });

  it('fetchUsers loads the admin-safe user directory RPC', () => {
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
    expect(SOURCE).toContain('grid-cols-[1fr_180px_80px_100px_100px_100px_120px_140px_80px]');
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
    expect(SOURCE).toContain('user.subscription_tier');
  });
});

describe('AdminDashboard current tab structure', () => {
  const tabs = [
    'analytics',
    'transactions',
    'payouts',
    'users',
    'reviews',
    'certifications',
    'audit',
    'settings',
    'support',
    'pending-trainers',
    'sessions',
  ];

  it.each(tabs)('includes the %s tab in the dashboard contract', (tab) => {
    expect(SOURCE).toContain(`'${tab}'`);
  });
});

describe('Payouts Balance Summary', () => {
  it('reads the platform balance from the stripe-balance edge function', () => {
    expect(SOURCE).toContain("supabase.functions.invoke('stripe-balance')");
  });

  it('derives the summary from the shared, tested helper rather than inline math', () => {
    expect(SOURCE).toContain('summarizePayoutFunding(stripeBalance, payoutBalances)');
  });

  it('loads the balance when the payouts tab opens and after a release', () => {
    expect(SOURCE).toContain('fetchStripeBalance();');
    expect(SOURCE).toContain('await fetchStripeBalance();');
  });

  it('surfaces the real edge function error instead of the generic non-2xx string', () => {
    expect(SOURCE).toContain("edgeFunctionError(err, 'Could not read Stripe balance')");
  });

  it('names balance_insufficient so the warning matches what Stripe returns', () => {
    expect(SOURCE).toContain('balance_insufficient');
  });

  it('flags automatic payouts draining the float', () => {
    expect(SOURCE).toContain('recent_payouts.find((p) => p.automatic)');
  });

  it('warns when Stripe is in test mode', () => {
    expect(SOURCE).toContain('Stripe test mode');
  });

  it('treats arrival_date as unix seconds', () => {
    expect(SOURCE).toContain('autoPayout.arrival_date * 1000');
  });
});

describe('Partial payouts / weekly session view', () => {
  it('mounts the weekly TrainerSessionsModal', () => {
    expect(SOURCE).toContain("import TrainerSessionsModal from '@/components/admin/TrainerSessionsModal'");
    expect(SOURCE).toContain('<TrainerSessionsModal');
  });

  it('opens the modal per trainer via a View button', () => {
    expect(SOURCE).toContain('setSessionsModalTrainer(b)');
    expect(SOURCE).toMatch(/>\s*View\s*</);
  });

  it('relabels the whole-balance action to Release all', () => {
    expect(SOURCE).toContain("'Release all'");
  });

  it('keeps the whole-balance release free of payment_ids (that path stays full-balance)', () => {
    // handleReleasePayout must not narrow to specific sessions.
    const start = SOURCE.indexOf('const handleReleasePayout');
    const handler = SOURCE.slice(start, start + 900);
    expect(handler).not.toContain('payment_ids');
  });

  it('passes the Stripe available balance to the modal for the funding guard', () => {
    expect(SOURCE).toContain('availableCents={stripeBalance?.available_cents ?? null}');
  });
});
