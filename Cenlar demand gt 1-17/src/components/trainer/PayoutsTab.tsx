import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface TransactionRow {
  id: string;
  date: string;
  client: string;
  amount: number;
  status: string;
  type: 'payment' | 'payout';
}

const formatUSD = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const normalized = status.toLowerCase();
  let color = 'text-ink/40';
  let dot = 'bg-ink/20';
  let label = status;

  if (normalized === 'succeeded' || normalized === 'completed') {
    color = 'text-green-700';
    dot = 'bg-green-500';
    label = 'Completed';
  } else if (normalized === 'pending' || normalized === 'processing') {
    color = 'text-amber-600';
    dot = 'bg-amber-500';
    label = 'Pending';
  } else if (normalized === 'failed') {
    color = 'text-red-600';
    dot = 'bg-red-500';
    label = 'Failed';
  }

  return (
    <span className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-medium ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
};

const PayoutsTab: React.FC = () => {
  const { trainerProfile } = useAuthStore();

  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const fetchBalanceAndTransactions = useCallback(async () => {
    if (!trainerProfile) return;

    setLoading(true);
    try {
      // 1. Get all booking IDs for this trainer
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('id')
        .eq('trainer_id', trainerProfile.id);

      if (bookingError) throw bookingError;

      const bookingIds = (bookingData ?? []).map((b) => b.id);

      if (bookingIds.length === 0) {
        setAvailableBalance(0);
        setPendingBalance(0);
        setTransactions([]);
        setLoading(false);
        return;
      }

      // 2. Fetch payment rows (available + pending balance + transaction history)
      const { data: paymentRows, error: paymentError } = await supabase
        .from('payments')
        .select('id, booking_id, trainer_payout, status, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false });

      if (paymentError) throw paymentError;

      const payments = (paymentRows ?? []) as Array<{
        id: string;
        booking_id: string;
        trainer_payout: number;
        status: string;
        created_at: string;
      }>;

      // 3. Available balance: succeeded payments
      const available = payments
        .filter((p) => p.status === 'succeeded')
        .reduce((sum, p) => sum + Number(p.trainer_payout), 0);

      // 4. Pending balance: pending/processing payments
      const pending = payments
        .filter((p) => p.status === 'pending' || p.status === 'processing')
        .reduce((sum, p) => sum + Number(p.trainer_payout), 0);

      setAvailableBalance(available);
      setPendingBalance(pending);

      // 5. Build payment transaction rows — need client names
      // Fetch client profile names via bookings
      const { data: bookingDetails, error: bookingDetailError } = await supabase
        .from('bookings')
        .select('id, client_id, profiles:client_id(full_name)')
        .in('id', bookingIds);

      if (bookingDetailError) throw bookingDetailError;

      const bookingClientMap: Record<string, string> = {};
      (bookingDetails ?? []).forEach((b: any) => {
        bookingClientMap[b.id] = b.profiles?.full_name ?? 'Unknown Client';
      });

      const paymentTxRows: TransactionRow[] = payments.map((p) => ({
        id: `payment-${p.id}`,
        date: p.created_at,
        client: bookingClientMap[p.booking_id] ?? 'Unknown Client',
        amount: Number(p.trainer_payout),
        status: p.status,
        type: 'payment',
      }));

      // 6. Fetch payout_transactions for this trainer (table may not exist yet — treat errors as empty)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: payoutData } = await (supabase as any)
        .from('payout_transactions')
        .select('id, amount, status, created_at')
        .eq('trainer_id', trainerProfile.id)
        .order('created_at', { ascending: false });

      const payoutTxRows: TransactionRow[] = ((payoutData ?? []) as Array<{
        id: string;
        amount: number;
        status: string;
        created_at: string;
      }>).map((pt) => ({
        id: `payout-${pt.id}`,
        date: pt.created_at,
        client: 'Payout Transfer',
        amount: Number(pt.amount),
        status: pt.status,
        type: 'payout',
      }));

      // 7. Combine and sort newest-first
      const combined = [...paymentTxRows, ...payoutTxRows].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setTransactions(combined);
    } catch (err) {
      console.error('Failed to load payout data:', err);
      toast.error('Failed to load payout data');
    } finally {
      setLoading(false);
    }
  }, [trainerProfile]);

  useEffect(() => {
    fetchBalanceAndTransactions();
  }, [fetchBalanceAndTransactions]);

  // Realtime subscription on payments table for this trainer's bookings
  useEffect(() => {
    if (!trainerProfile) return;

    const channel = supabase
      .channel(`payouts-tab-payments-${trainerProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
        },
        () => {
          fetchBalanceAndTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trainerProfile, fetchBalanceAndTransactions]);

  const handleRequestPayout = async () => {
    setPayoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (res.ok) {
        toast.success('Payout requested successfully');
        setShowModal(false);
        // Optimistic clear
        setAvailableBalance(0);
        // Refetch to get actual state
        fetchBalanceAndTransactions();
      } else {
        setShowModal(false);
        toast.error('Payout failed. Please try again or contact support.');
      }
    } catch {
      setShowModal(false);
      toast.error('Payout failed. Please try again or contact support.');
    } finally {
      setPayoutLoading(false);
    }
  };

  const canRequestPayout = availableBalance >= 50;

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Balance skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-ink/10 p-8 space-y-3 animate-pulse">
            <div className="h-3 bg-ink/10 rounded w-32" />
            <div className="h-12 bg-ink/10 rounded w-48" />
          </div>
          <div className="border border-ink/10 p-8 space-y-3 animate-pulse">
            <div className="h-3 bg-ink/10 rounded w-24" />
            <div className="h-6 bg-ink/10 rounded w-32" />
          </div>
        </div>
        {/* Table skeleton */}
        <div className="border border-ink/10 animate-pulse">
          <div className="h-10 bg-ink/5 border-b border-ink/10" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-ink/5">
              <div className="h-3 bg-ink/10 rounded w-20" />
              <div className="h-3 bg-ink/10 rounded w-24" />
              <div className="h-3 bg-ink/10 rounded w-16" />
              <div className="h-3 bg-ink/10 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Balance Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Available Balance — hero */}
        <div className="border border-ink/10 p-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Available Balance</p>
          <p className="text-5xl serif font-light text-ink">{formatUSD(availableBalance)}</p>
        </div>

        {/* Pending Balance */}
        <div className="border border-ink/10 p-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Pending</p>
          <p
            className="text-lg serif font-light text-ink/60"
            title="Completed sessions not yet paid out"
          >
            {formatUSD(pendingBalance)}
          </p>
          <p className="text-[10px] text-ink/30">Completed sessions not yet paid out</p>
        </div>
      </div>

      {/* Request Payout Button */}
      <div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!canRequestPayout}
          title={!canRequestPayout ? 'Minimum $50 required' : undefined}
          className={`border px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium transition-all duration-300 ${
            canRequestPayout
              ? 'border-accent text-accent hover:bg-accent hover:text-white'
              : 'border-ink/20 text-ink/30 opacity-50 cursor-not-allowed'
          }`}
        >
          Request Payout
        </button>
        {!canRequestPayout && (
          <p className="text-[10px] text-ink/30 mt-2">Minimum $50.00 balance required to request a payout.</p>
        )}
      </div>

      {/* Transaction History Table */}
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.25em] font-medium text-ink/40">Transaction History</p>

        <div className="border border-ink/10">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_120px_120px] gap-4 px-6 py-3 border-b border-ink/10 bg-ink/[0.02]">
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Date</p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Client</p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Amount</p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Status</p>
          </div>

          {transactions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-xs text-ink/30 uppercase tracking-widest">No transactions yet.</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-[1fr_1fr_120px_120px] gap-4 px-6 py-4 border-b border-ink/5 items-center hover:bg-ink/[0.02] transition-colors"
              >
                <p className="text-[11px] text-ink/60">{formatDate(tx.date)}</p>
                <p className={`text-sm ${tx.type === 'payout' ? 'text-ink/40 italic' : 'text-ink'}`}>
                  {tx.client}
                </p>
                <p className={`text-sm serif font-light ${tx.type === 'payout' ? 'text-ink/50' : 'text-ink'}`}>
                  {tx.type === 'payout' ? `−${formatUSD(tx.amount)}` : formatUSD(tx.amount)}
                </p>
                <StatusBadge status={tx.status} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-paper border border-ink/10 p-10 max-w-sm w-full mx-4 space-y-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] font-medium text-ink/40">Confirm Payout</p>
              <p className="text-lg serif font-light text-ink">
                Request payout of {formatUSD(availableBalance)}?
              </p>
              <p className="text-sm text-ink/50">Funds arrive within 2 business days.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRequestPayout}
                disabled={payoutLoading}
                className="flex-1 border border-accent text-accent px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent hover:text-white transition-all duration-300 disabled:opacity-50"
              >
                {payoutLoading ? 'Processing…' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                disabled={payoutLoading}
                className="flex-1 border border-ink/20 px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayoutsTab;
