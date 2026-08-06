import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { edgeFunctionError } from '@/lib/errorMessages';
import {
  formatCents,
  isReleasableSession,
  sessionSelectionTotalCents,
  type TrainerSession,
} from '@/lib/payoutFunding';
import { ptWeekBounds, shiftWeek } from '@/lib/pacificWeek';

// Only the fields the modal needs — avoids importing AdminDashboard's local
// PayoutBalance/StripeBalanceResponse types (and a circular import).
export interface ModalTrainer {
  trainer_profile_id: string;
  trainer_name: string;
  stripe_account_id: string | null;
  payout_on_hold: boolean;
}

interface Props {
  open: boolean;
  trainer: ModalTrainer | null;
  /** Platform Stripe available balance in cents, or null when unknown. */
  availableCents: number | null;
  onClose: () => void;
  onReleased: () => void;
}

const TZ = 'America/Los_Angeles';
const ptTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
const ptDayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ });

function paymentChip(s: TrainerSession): { label: string; cls: string } {
  if (s.is_comp) return { label: 'Comp', cls: 'bg-ink/5 text-ink/50' };
  if (!s.payment_id) return { label: 'No payment', cls: 'bg-red-50 text-red-600' };
  if (s.payout_transaction_id) return { label: 'Paid out', cls: 'bg-ink/5 text-ink/40' };
  if (isReleasableSession(s)) return { label: 'Ready', cls: 'bg-emerald-50 text-emerald-700' };
  return { label: s.payment_status ?? 'unpaid', cls: 'bg-amber-50 text-amber-700' };
}

const TrainerSessionsModal: React.FC<Props> = ({ open, trainer, availableCents, onClose, onReleased }) => {
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [sessions, setSessions] = useState<TrainerSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [releasing, setReleasing] = useState(false);

  const week = ptWeekBounds(anchor);

  const fetchWeek = useCallback(async () => {
    if (!trainer) return;
    setLoading(true);
    setError(null);
    try {
      // Admin RPC is not in the generated Supabase types (matches the other
      // get_admin_* calls in AdminDashboard) — cast to reach it.
      const { data, error: rpcError } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      }).rpc('get_admin_trainer_sessions', {
        p_trainer_profile_id: trainer.trainer_profile_id,
        p_from: week.fromIso,
        p_to: week.toIso,
      });
      if (rpcError) throw rpcError;
      const rows = (data ?? []) as TrainerSession[];
      setSessions(rows);
      // Pre-tick everything releasable in the viewed week: the common case is
      // "pay this week's completed sessions", one glance and one click.
      setSelected(new Set(rows.filter(isReleasableSession).map((s) => s.payment_id as string)));
    } catch (err) {
      setSessions([]);
      setSelected(new Set());
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [trainer, week.fromIso, week.toIso]);

  // Reset to the current week each time the modal opens for a trainer.
  useEffect(() => {
    if (open && trainer) setAnchor(new Date());
  }, [open, trainer?.trainer_profile_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && trainer) fetchWeek();
  }, [open, trainer, fetchWeek]);

  if (!open || !trainer) return null;

  const totalCents = sessionSelectionTotalCents(sessions, selected);
  const underfunded = availableCents !== null && totalCents > availableCents;
  const canRelease = selected.size > 0 && !releasing && !!trainer.stripe_account_id && !trainer.payout_on_hold;

  const toggle = (paymentId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  };

  const release = async () => {
    if (!canRelease) return;
    setReleasing(true);
    try {
      const { error: fnError } = await supabase.functions.invoke('create-payout', {
        body: { target_trainer_profile_id: trainer.trainer_profile_id, payment_ids: [...selected] },
      });
      if (fnError) throw fnError;
      toast.success(`Released ${formatCents(totalCents)} to ${trainer.trainer_name}`);
      onReleased();
      await fetchWeek();
    } catch (err) {
      toast.error(await edgeFunctionError(err, 'Release failed'));
    } finally {
      setReleasing(false);
    }
  };

  // Group by PT day, preserving the RPC's start_time ordering.
  const days: { label: string; rows: TrainerSession[] }[] = [];
  for (const s of sessions) {
    const label = ptDayLabel(s.start_time);
    const last = days[days.length - 1];
    if (last && last.label === label) last.rows.push(s);
    else days.push({ label, rows: [s] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={onClose}>
      <div
        className="bg-paper border border-ink/10 w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink/10">
          <div>
            <h2 className="text-xl serif font-light italic text-ink">{trainer.trainer_name}</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium mt-1">Sessions · Weekly</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAnchor((a) => shiftWeek(a, -1))}
              className="px-2 py-1 text-[11px] uppercase tracking-wider text-ink/50 hover:text-ink transition-colors"
            >
              ‹ Prev
            </button>
            <span className="text-xs text-ink/70 tabular-nums min-w-[110px] text-center">{week.label}</span>
            <button
              onClick={() => setAnchor((a) => shiftWeek(a, 1))}
              className="px-2 py-1 text-[11px] uppercase tracking-wider text-ink/50 hover:text-ink transition-colors"
            >
              Next ›
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-4 h-4 border border-ink/20 border-t-ink/60 rounded-full animate-spin mx-auto" />
            </div>
          ) : error ? (
            <p className="py-12 text-center text-xs text-red-600">{error}</p>
          ) : days.length === 0 ? (
            <p className="py-12 text-center text-xs text-ink/50">No sessions this week.</p>
          ) : (
            <div className="space-y-5">
              {days.map((day) => (
                <div key={day.label}>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium mb-2">{day.label}</p>
                  <div className="border border-ink/10">
                    {day.rows.map((s) => {
                      const chip = paymentChip(s);
                      const eligible = isReleasableSession(s);
                      const pid = s.payment_id;
                      return (
                        <label
                          key={s.booking_id}
                          className={`grid grid-cols-[24px_130px_1fr_90px_110px] gap-3 items-center px-4 py-3 border-b border-ink/5 last:border-0 ${eligible ? 'cursor-pointer hover:bg-ink/[0.02]' : ''}`}
                        >
                          <input
                            type="checkbox"
                            disabled={!eligible || !pid}
                            checked={!!pid && selected.has(pid)}
                            onChange={() => pid && toggle(pid)}
                            className="accent-emerald-600 disabled:opacity-30"
                          />
                          <span className="text-xs text-ink/70 tabular-nums">
                            {ptTime(s.start_time)}–{ptTime(s.end_time)}
                          </span>
                          <span className="text-sm text-ink truncate">{s.client_name}</span>
                          <span className="text-sm text-ink tabular-nums">
                            {formatCents(Math.round(Number(s.payment_trainer_payout ?? s.trainer_payout) * 100))}
                          </span>
                          <span className={`justify-self-end text-[9px] uppercase tracking-wider font-medium px-2 py-0.5 ${chip.cls}`}>
                            {chip.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-ink/10 px-6 py-4 space-y-2">
          {underfunded && (
            <p className="text-[11px] text-amber-700">
              Selected {formatCents(totalCents)} exceeds the {formatCents(availableCents ?? 0)} available in Stripe.
              Release may fail with balance_insufficient until the pending funds settle.
            </p>
          )}
          {trainer.payout_on_hold && (
            <p className="text-[11px] text-amber-700">Payouts are on hold for this trainer.</p>
          )}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink/70">
              Selected: <span className="tabular-nums">{selected.size}</span> session{selected.size === 1 ? '' : 's'} ·{' '}
              <span className="font-medium text-ink tabular-nums">{formatCents(totalCents)}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="border border-ink/20 px-6 py-2.5 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all"
              >
                Close
              </button>
              <button
                onClick={release}
                disabled={!canRelease}
                className={`px-6 py-2.5 text-[11px] uppercase tracking-[0.2em] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${underfunded ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                {releasing ? 'Releasing...' : `Release ${formatCents(totalCents)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainerSessionsModal;
