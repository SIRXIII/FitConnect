import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { TrainerSession } from '@/lib/payoutFunding';

// Two releasable sessions, $43 each (Derek's last week).
const twoSessions: TrainerSession[] = [
  {
    booking_id: 'bk-a', booking_status: 'completed', is_comp: false,
    start_time: '2026-07-29T18:00:00Z', end_time: '2026-07-29T19:00:00Z',
    client_name: 'Xman', rate_charged: 43, trainer_payout: 43,
    payment_id: 'a', payment_status: 'succeeded', payment_trainer_payout: 43, payout_transaction_id: null,
  },
  {
    booking_id: 'bk-b', booking_status: 'completed', is_comp: false,
    start_time: '2026-08-01T19:00:00Z', end_time: '2026-08-01T20:00:00Z',
    client_name: 'Xman', rate_charged: 43, trainer_payout: 43,
    payment_id: 'b', payment_status: 'succeeded', payment_trainer_payout: 43, payout_transaction_id: null,
  },
];

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TrainerSessionsModal from './TrainerSessionsModal';

const trainer = {
  trainer_profile_id: 'tp-1',
  trainer_name: 'Derek Salem',
  stripe_account_id: 'acct_1',
  payout_on_hold: false,
};

const renderModal = () =>
  render(
    <TrainerSessionsModal
      open
      trainer={trainer}
      availableCents={100000}
      onClose={() => {}}
      onReleased={() => {}}
    />,
  );

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.invoke.mockReset();
  mocks.rpc.mockResolvedValue({ data: twoSessions, error: null });
  mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
});

describe('TrainerSessionsModal selection', () => {
  // The Release button label carries the live selection total and is unique
  // (each session row also renders "$43.00"), so assert against it.
  const releaseBtn = () => screen.getByRole('button', { name: /Release \$/i });

  // Each row exposes ONE accessible checkbox (the row div, role=checkbox); the
  // native <input> is aria-hidden and visual-only. Clicking the row is the sole
  // toggle path — no <label> double-fire that a real browser would trigger.
  const checked = (el: Element) => el.getAttribute('aria-checked') === 'true';

  it('pre-selects both releasable sessions ($86.00)', async () => {
    renderModal();
    await waitFor(() => expect(releaseBtn().textContent).toContain('$86.00'));
    const rows = screen.getAllByRole('checkbox');
    expect(rows).toHaveLength(2);
    expect(rows.every(checked)).toBe(true);
  });

  it('deselecting a session STAYS deselected and drops the total', async () => {
    renderModal();
    await waitFor(() => expect(releaseBtn().textContent).toContain('$86.00'));
    const rows = screen.getAllByRole('checkbox');

    fireEvent.click(rows[0]);

    // Total drops to one session immediately...
    await waitFor(() => expect(releaseBtn().textContent).toContain('$43.00'));
    // ...and the row does NOT re-check itself on subsequent renders.
    await new Promise((r) => setTimeout(r, 50));
    const after = screen.getAllByRole('checkbox');
    expect(checked(after[0])).toBe(false);
    expect(checked(after[1])).toBe(true);
    expect(releaseBtn().textContent).toContain('$43.00');
  });

  it('releases only the still-selected payment id', async () => {
    renderModal();
    await waitFor(() => expect(releaseBtn().textContent).toContain('$86.00'));
    const rows = screen.getAllByRole('checkbox');
    fireEvent.click(rows[0]); // drop 'a', keep 'b'
    await waitFor(() => expect(releaseBtn().textContent).toContain('$43.00'));

    fireEvent.click(releaseBtn());

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalled());
    const [, opts] = mocks.invoke.mock.calls[0];
    expect(opts.body.target_trainer_profile_id).toBe('tp-1');
    expect(opts.body.payment_ids).toEqual(['b']);
  });
});
