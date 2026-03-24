import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, UserX, UserCheck, Settings, Users, DollarSign, BarChart2, TrendingUp, Flag, Eye, EyeOff, ScrollText, ShieldCheck, AlertTriangle, LifeBuoy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/supabase';
import { type TimeRange, getDateBounds, getBucketParam } from '@/lib/analytics';
import { setAdminTierOverride } from '@/lib/subscription';
import { CERTIFICATION_TIERS, getCertificationByCode } from '@/lib/certifications';
import AdminSupportQueue from '@/components/support/AdminSupportQueue';
import { useSupportTickets } from '@/hooks/useSupportTickets';

type ProfileRow = Tables<'profiles'>;

interface FlaggedReview {
  id: string;
  rating: number;
  comment: string | null;
  is_flagged: boolean;
  is_hidden: boolean;
  created_at: string;
  client: { full_name: string } | null;
  trainer: { full_name: string } | null;
}

interface UserRow {
  id: string;
  full_name: string;
  role: 'trainer' | 'client' | 'admin' | null;
  is_suspended: boolean;
  created_at: string;
  email?: string;
  last_sign_in_at?: string | null;
  subscription_tier?: 'free' | 'pro' | 'elite' | null;
  subscription_status?: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'incomplete' | null;
  tier_overridden_by?: string | null;
  tier_overridden_at?: string | null;
}

interface PayoutBalance {
  trainer_profile_id: string;
  trainer_user_id: string;
  trainer_name: string;
  stripe_account_id: string | null;
  pending_balance: number;
  unpaid_booking_count: number;
}

interface PayoutHistoryRow {
  id: string;
  amount: number;
  status: string;
  trainer_id: string;
  created_at: string;
  updated_at: string | null;
}

interface CertReviewItem {
  id: string;
  trainer_id: string;
  cert_code: string;
  cert_name: string;
  file_url: string;
  expiry_date: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  trainer?: {
    id: string;
    user_id: string;
    avatar_url?: string | null;
    profiles?: { full_name: string; avatar_url?: string | null } | null;
  } | null;
}

interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  actor?: { full_name: string } | null;
}

interface TransactionRow {
  id: string;
  amount: number;
  platform_fee: number;
  trainer_payout: number;
  status: string;
  created_at: string;
  client_name: string;
  trainer_name: string;
}

interface Stats {
  totalBookings: number;
  totalRevenue: number;
  activeUsers: number;
  avgDiscount: number;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({ totalBookings: 0, totalRevenue: 0, activeUsers: 0, avgDiscount: 0 });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [platformFee, setPlatformFee] = useState('0.08');
  const [savedFee, setSavedFee] = useState('0.08');
  const [savingFee, setSavingFee] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'transactions' | 'payouts' | 'users' | 'reviews' | 'certifications' | 'audit' | 'settings' | 'support'>('analytics');
  const { tickets: supportTickets } = useSupportTickets(true);
  const openSupportCount = supportTickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  const [pendingCerts, setPendingCerts] = useState<CertReviewItem[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [certRejectNotes, setCertRejectNotes] = useState<Record<string, string>>({});
  const [certChecklist, setCertChecklist] = useState<Record<string, Record<string, boolean>>>({});
  const [processingCertId, setProcessingCertId] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [flaggedReviews, setFlaggedReviews] = useState<FlaggedReview[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditOffset, setAuditOffset] = useState(0);
  const [hasMoreAudit, setHasMoreAudit] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [adminRange, setAdminRange] = useState<TimeRange>('month');
  const [adminTotals, setAdminTotals] = useState<{
    total_revenue: number;
    total_platform_fee: number;
    total_payouts: number;
    booking_volume: number;
    mrr: number;
    pro_subscriber_count: number;
    elite_subscriber_count: number;
    active_trial_count: number;
  } | null>(null);
  const [topEarners, setTopEarners] = useState<Array<{
    trainer_name: string;
    gross: number;
    net: number;
    bookings_count: number;
  }>>([]);
  const [loadingAdminAnalytics, setLoadingAdminAnalytics] = useState(false);
  const [overridingUserId, setOverridingUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [txStatusFilter, setTxStatusFilter] = useState<string>('all');
  const [txOffset, setTxOffset] = useState(0);
  const [hasMoreTx, setHasMoreTx] = useState(true);
  const TX_PAGE_SIZE = 25;
  const [payoutBalances, setPayoutBalances] = useState<PayoutBalance[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistoryRow[]>([]);
  const [loadingPayoutHistory, setLoadingPayoutHistory] = useState(false);
  const [processingPayoutTrainerId, setProcessingPayoutTrainerId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [bookingResult, paymentResult, userResult, trainerResult, feeResult] = await Promise.all([
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('amount').eq('status', 'succeeded'),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .in('role', ['trainer', 'client'])
          .eq('is_suspended', false),
        supabase.from('trainer_profiles').select('discount_percentage'),
        supabase.from('platform_settings').select('value').eq('key', 'platform_fee_pct').single(),
      ]);

      const totalRevenue = (paymentResult.data ?? []).reduce((sum, p) => sum + p.amount, 0);
      const discounts = trainerResult.data ?? [];
      const avgDiscount = discounts.length
        ? Math.round(discounts.reduce((sum, t) => sum + t.discount_percentage, 0) / discounts.length)
        : 0;

      setStats({
        totalBookings: bookingResult.count ?? 0,
        totalRevenue,
        activeUsers: userResult.count ?? 0,
        avgDiscount,
      });

      if (feeResult.data?.value) {
        setPlatformFee(feeResult.data.value);
        setSavedFee(feeResult.data.value);
      }
    } catch {
      setStats({ totalBookings: 0, totalRevenue: 0, activeUsers: 0, avgDiscount: 0 });
      toast.error('Failed to load platform stats');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_admin_user_list');
      if (error) throw error;
      let rows = (data ?? []) as UserRow[];

      // Client-side filtering (RPC returns all users, filter in JS for responsiveness)
      if (roleFilter !== 'all') {
        rows = rows.filter(u => u.role === roleFilter);
      }
      if (statusFilter === 'active') {
        rows = rows.filter(u => !u.is_suspended);
      } else if (statusFilter === 'suspended') {
        rows = rows.filter(u => u.is_suspended);
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter(u =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        );
      }

      setUsers(rows);
    } catch {
      setUsers([]);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [search, roleFilter, statusFilter]);

  const fetchTransactions = useCallback(async (offset = 0, append = false) => {
    setLoadingTransactions(true);
    try {
      let query = (supabase as any)
        .from('bookings')
        .select(`
          id, rate_charged, platform_fee, trainer_payout, status, stripe_payment_intent_id, created_at,
          client:client_id(full_name),
          trainer_profile:trainer_id(user_id, profiles:user_id(full_name))
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + TX_PAGE_SIZE - 1);

      if (txStatusFilter !== 'all') {
        query = query.eq('status', txStatusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows: TransactionRow[] = (data ?? []).map((b: any) => ({
        id: b.id,
        amount: Number(b.rate_charged || 0),
        platform_fee: Number(b.platform_fee || 0),
        trainer_payout: Number(b.trainer_payout || 0),
        status: b.status,
        created_at: b.created_at,
        client_name: b.client?.full_name ?? '—',
        trainer_name: b.trainer_profile?.profiles?.full_name ?? '—',
      }));

      if (append) {
        setTransactions(prev => [...prev, ...rows]);
      } else {
        setTransactions(rows);
      }
      setHasMoreTx(rows.length === TX_PAGE_SIZE);
      setTxOffset(offset + rows.length);
    } catch {
      toast.error('Failed to load transactions');
      if (!append) setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }, [txStatusFilter]);

  useEffect(() => { if (activeTab === 'transactions') fetchTransactions(); }, [activeTab, fetchTransactions]);

  const fetchPayoutBalances = useCallback(async () => {
    setLoadingPayouts(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_admin_payout_balances');
      if (error) throw error;
      setPayoutBalances((data ?? []) as PayoutBalance[]);
    } catch {
      toast.error('Failed to load payout balances');
      setPayoutBalances([]);
    } finally {
      setLoadingPayouts(false);
    }
  }, []);

  const fetchPayoutHistory = useCallback(async () => {
    setLoadingPayoutHistory(true);
    try {
      const { data, error } = await (supabase as any)
        .from('payout_transactions')
        .select('id, amount, status, trainer_id, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setPayoutHistory((data ?? []) as PayoutHistoryRow[]);
    } catch {
      toast.error('Failed to load payout history');
    } finally {
      setLoadingPayoutHistory(false);
    }
  }, []);

  const handleApprovePayout = async (balance: PayoutBalance) => {
    if (!balance.stripe_account_id) {
      toast.error(`${balance.trainer_name} has no Stripe account connected`);
      return;
    }
    if (balance.pending_balance < 50) {
      toast.error('Minimum payout is $50');
      return;
    }
    setProcessingPayoutTrainerId(balance.trainer_profile_id);
    try {
      const { error } = await supabase.functions.invoke('create-payout', {
        body: { trainer_id: balance.trainer_user_id },
      });
      if (error) throw error;
      toast.success(`Payout of $${balance.pending_balance.toFixed(2)} initiated for ${balance.trainer_name}`);
      await fetchPayoutBalances();
      await fetchPayoutHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payout failed');
    } finally {
      setProcessingPayoutTrainerId(null);
    }
  };

  const handleHoldPayout = async (balance: PayoutBalance) => {
    setProcessingPayoutTrainerId(balance.trainer_profile_id);
    try {
      const { error } = await (supabase as any)
        .from('payout_transactions')
        .insert({
          trainer_id: balance.trainer_profile_id,
          amount: balance.pending_balance,
          status: 'held',
        });
      if (error) throw error;
      toast.success(`Payout held for ${balance.trainer_name}`);
      await fetchPayoutBalances();
      await fetchPayoutHistory();
    } catch {
      toast.error('Failed to hold payout');
    } finally {
      setProcessingPayoutTrainerId(null);
    }
  };

  useEffect(() => { if (activeTab === 'payouts') { fetchPayoutBalances(); fetchPayoutHistory(); } }, [activeTab, fetchPayoutBalances, fetchPayoutHistory]);

  const fetchPendingCerts = useCallback(async () => {
    setLoadingCerts(true);
    try {
      const { data, error } = await (supabase as any)
        .from('trainer_certifications')
        .select('*, trainer:trainer_id(id, user_id, profiles:user_id(full_name, avatar_url))')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      setPendingCerts(data ?? []);
    } catch {
      // table may not exist in dev
    } finally {
      setLoadingCerts(false);
    }
  }, []);

  const handleCertApprove = async (certId: string) => {
    setProcessingCertId(certId);
    try {
      const { error } = await (supabase as any)
        .from('trainer_certifications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', certId);
      if (error) throw error;
      toast.success('Certification approved.');
      await fetchPendingCerts();
    } catch {
      toast.error('Failed to approve certification.');
    } finally {
      setProcessingCertId(null);
    }
  };

  const handleCertReject = async (certId: string) => {
    const notes = certRejectNotes[certId]?.trim();
    if (!notes) {
      toast.error('Please add notes explaining the rejection reason.');
      return;
    }
    setProcessingCertId(certId);
    try {
      const { error } = await (supabase as any)
        .from('trainer_certifications')
        .update({ status: 'rejected', admin_notes: notes, reviewed_at: new Date().toISOString() })
        .eq('id', certId);
      if (error) throw error;
      toast.success('Certification rejected.');
      setCertRejectNotes(n => { const copy = { ...n }; delete copy[certId]; return copy; });
      await fetchPendingCerts();
    } catch {
      toast.error('Failed to reject certification.');
    } finally {
      setProcessingCertId(null);
    }
  };

  const fetchFlaggedReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, comment, is_flagged, is_hidden, created_at, client:client_id(full_name), trainer:trainer_id(full_name)')
        .eq('is_flagged', true)
        .order('created_at', { ascending: false });
      setFlaggedReviews((data ?? []) as unknown as FlaggedReview[]);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (offset = 0, append = false) => {
    setLoadingAudit(true);
    const PAGE_SIZE = 50;
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, actor_id, action, table_name, record_id, old_values, new_values, created_at, actor:actor_id(full_name)')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const entries = (data ?? []) as unknown as AuditLogEntry[];
      if (append) {
        setAuditLogs((prev) => [...prev, ...entries]);
      } else {
        setAuditLogs(entries);
      }
      setHasMoreAudit(entries.length === PAGE_SIZE);
      setAuditOffset(offset + entries.length);
    } catch {
      if (!append) setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchFlaggedReviews(); }, [fetchFlaggedReviews]);
  useEffect(() => { fetchAuditLogs(); }, [fetchAuditLogs]);
  useEffect(() => { fetchPendingCerts(); }, [fetchPendingCerts]);

  useEffect(() => {
    const fetchAdminAnalytics = async () => {
      setLoadingAdminAnalytics(true);
      const bounds = getDateBounds(adminRange);
      const { data: rawData, error } = await supabase.rpc('get_admin_analytics', {
        p_start: bounds.start,
        p_end: bounds.end,
        p_bucket: getBucketParam(adminRange),
      });
      const data = rawData as any;
      if (error || !data?.totals) {
        setAdminTotals(null);
        setTopEarners([]);
        setLoadingAdminAnalytics(false);
        return;
      }
      setAdminTotals({
        total_revenue: Number(data.totals.total_revenue),
        total_platform_fee: Number(data.totals.total_platform_fee),
        total_payouts: Number(data.totals.total_payouts),
        booking_volume: Number(data.totals.booking_volume),
        mrr: Number(data.mrr ?? 0),
        pro_subscriber_count: Number(data.pro_subscriber_count ?? 0),
        elite_subscriber_count: Number(data.elite_subscriber_count ?? 0),
        active_trial_count: Number(data.active_trial_count ?? 0),
      });
      setTopEarners((data.top_earners ?? []).map((r: { trainer_name: string; gross: string; net: string; bookings_count: string }) => ({
        trainer_name: r.trainer_name,
        gross: Number(r.gross),
        net: Number(r.net),
        bookings_count: Number(r.bookings_count),
      })));
      setLoadingAdminAnalytics(false);
    };
    fetchAdminAnalytics();
  }, [adminRange]);

  const handleToggleHideReview = async (review: FlaggedReview) => {
    const next = !review.is_hidden;
    const { error } = await supabase
      .from('reviews')
      .update({ is_hidden: next })
      .eq('id', review.id);
    if (error) { toast.error('Failed to update review'); return; }
    setFlaggedReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, is_hidden: next } : r));
    toast.success(next ? 'Review hidden from public' : 'Review restored to public');
  };

  const handleSuspend = async (user: UserRow) => {
    const next = !user.is_suspended;
    const { error } = await supabase
      .from('profiles')
      .update({ is_suspended: next } as Partial<ProfileRow>)
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update user status');
      return;
    }

    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_suspended: next } : u));
    toast.success(next ? `${user.full_name} suspended` : `${user.full_name} reinstated`);
  };

  const handleSaveFee = async () => {
    const parsed = parseFloat(platformFee);
    if (isNaN(parsed) || parsed < 0 || parsed > 0.5) {
      toast.error('Fee must be between 0 and 0.5 (0%–50%)');
      return;
    }

    setSavingFee(true);
    const { error } = await supabase
      .from('platform_settings')
      .update({ value: parsed.toString(), updated_at: new Date().toISOString() })
      .eq('key', 'platform_fee_pct');

    setSavingFee(false);

    if (error) {
      toast.error('Failed to save platform fee');
      return;
    }

    setSavedFee(parsed.toString());
    toast.success(`Platform fee updated to ${Math.round(parsed * 100)}%`);
  };

  const handleOverride = async (trainerId: string, tier: 'free' | 'pro' | 'elite') => {
    try {
      await setAdminTierOverride(trainerId, tier);
      toast.success(`Tier override set to ${tier}`);
      setOverridingUserId(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Override failed');
    }
  };

  const isDirty = platformFee !== savedFee;

  return (
    <div className="min-h-screen bg-paper pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto space-y-12">

        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-3xl serif font-light italic text-ink">Admin Dashboard</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/40">Platform Control</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-ink/10">
          {(['analytics', 'transactions', 'payouts', 'users', 'reviews', 'certifications', 'audit', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-3 text-[10px] uppercase tracking-[0.25em] font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-ink text-ink -mb-px'
                  : 'text-ink/40 hover:text-ink'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('support')}
            className={`px-8 py-3 text-[10px] uppercase tracking-[0.25em] font-medium transition-colors relative ${
              activeTab === 'support'
                ? 'border-b-2 border-ink text-ink -mb-px'
                : 'text-ink/40 hover:text-ink'
            }`}
          >
            support
            {openSupportCount > 0 && (
              <span className="absolute top-2 right-3 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-accent text-white rounded-full">
                {openSupportCount}
              </span>
            )}
          </button>
        </div>

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Range selector */}
            <div className="flex border-b border-ink/10">
              {(['week', 'month', 'quarter', 'year'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAdminRange(r)}
                  className={`px-6 py-2 text-[10px] uppercase tracking-[0.2em] font-medium transition-colors ${
                    adminRange === r
                      ? 'border-b-2 border-ink text-ink -mb-px'
                      : 'text-ink/40 hover:text-ink'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Platform aggregate stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard
                icon={<DollarSign size={18} strokeWidth={1.5} />}
                label="Total Revenue"
                value={loadingAdminAnalytics || !adminTotals ? '—' : `$${adminTotals.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                accent
              />
              <StatCard
                icon={<TrendingUp size={18} strokeWidth={1.5} />}
                label="Platform Fee Collected"
                value={loadingAdminAnalytics || !adminTotals ? '—' : `$${adminTotals.total_platform_fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
              <StatCard
                icon={<BarChart2 size={18} strokeWidth={1.5} />}
                label="Trainer Payouts"
                value={loadingAdminAnalytics || !adminTotals ? '—' : `$${adminTotals.total_payouts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
              <StatCard
                icon={<Users size={18} strokeWidth={1.5} />}
                label="Booking Volume"
                value={loadingAdminAnalytics || !adminTotals ? '—' : adminTotals.booking_volume.toLocaleString()}
              />
            </div>

            {/* Subscription Health */}
            <div className="space-y-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Subscription Health</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                  icon={<TrendingUp size={18} strokeWidth={1.5} />}
                  label="MRR"
                  value={loadingAdminAnalytics || !adminTotals ? '—' : `$${adminTotals.mrr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  accent
                />
                <StatCard
                  icon={<Users size={18} strokeWidth={1.5} />}
                  label="Pro Subscribers"
                  value={loadingAdminAnalytics || !adminTotals ? '—' : `${adminTotals.pro_subscriber_count}`}
                />
                <StatCard
                  icon={<Users size={18} strokeWidth={1.5} />}
                  label="Elite Subscribers"
                  value={loadingAdminAnalytics || !adminTotals ? '—' : `${adminTotals.elite_subscriber_count}`}
                />
                <StatCard
                  icon={<BarChart2 size={18} strokeWidth={1.5} />}
                  label="Active Trials"
                  value={loadingAdminAnalytics || !adminTotals ? '—' : `${adminTotals.active_trial_count}`}
                />
              </div>
            </div>

            {/* Top Earners table */}
            <div className="space-y-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Top Earners</p>
              <div className="border border-ink/10">
                <div className="grid grid-cols-[2fr_1fr_1fr_80px] gap-4 px-6 py-3 border-b border-ink/10 bg-ink/[0.02]">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Trainer</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Gross</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Net</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Bookings</p>
                </div>
                {loadingAdminAnalytics ? (
                  <div className="px-6 py-8 text-center">
                    <div className="w-4 h-4 border border-ink/20 border-t-ink/60 rounded-full animate-spin mx-auto" />
                  </div>
                ) : topEarners.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-xs text-ink/30">No completed bookings in this period</p>
                  </div>
                ) : (
                  topEarners.map((row, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[2fr_1fr_1fr_80px] gap-4 px-6 py-4 border-b border-ink/5 items-center hover:bg-ink/[0.02] transition-colors last:border-0"
                    >
                      <p className="text-sm text-ink">{row.trainer_name}</p>
                      <p className="text-sm text-ink">${row.gross.toFixed(2)}</p>
                      <p className="text-sm text-ink font-medium">${row.net.toFixed(2)}</p>
                      <p className="text-sm text-ink/60">{row.bookings_count}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            {/* Status filter */}
            <div className="flex items-center gap-4">
              <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Filter:</p>
              {['all', 'succeeded', 'pending', 'processing', 'failed', 'refunded'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setTxStatusFilter(s); setTxOffset(0); }}
                  className={`px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] font-medium transition-colors border ${
                    txStatusFilter === s
                      ? 'border-ink text-ink bg-ink/5'
                      : 'border-ink/10 text-ink/40 hover:text-ink hover:border-ink/30'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Transaction table */}
            <div className="border border-ink/10">
              <div className="grid grid-cols-[1fr_1fr_100px_100px_100px_100px_140px] gap-4 px-6 py-3 border-b border-ink/10 bg-ink/[0.02]">
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Client</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Trainer</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Amount</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Fee</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Payout</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Status</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Date</p>
              </div>

              {loadingTransactions ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-4 h-4 border border-ink/20 border-t-ink/60 rounded-full animate-spin mx-auto" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-xs text-ink/30">No transactions found</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[1fr_1fr_100px_100px_100px_100px_140px] gap-4 px-6 py-4 border-b border-ink/5 items-center hover:bg-ink/[0.02] transition-colors last:border-0"
                  >
                    <p className="text-sm text-ink truncate">{tx.client_name}</p>
                    <p className="text-sm text-ink truncate">{tx.trainer_name}</p>
                    <p className="text-sm text-ink">${tx.amount.toFixed(2)}</p>
                    <p className="text-sm text-ink/60">${tx.platform_fee.toFixed(2)}</p>
                    <p className="text-sm text-ink">${tx.trainer_payout.toFixed(2)}</p>
                    <span className={`inline-block px-2 py-0.5 text-[9px] uppercase tracking-wider font-medium ${
                      tx.status === 'succeeded' ? 'bg-emerald-50 text-emerald-600' :
                      tx.status === 'failed' ? 'bg-red-50 text-red-600' :
                      tx.status === 'refunded' ? 'bg-amber-50 text-amber-600' :
                      'bg-ink/5 text-ink/50'
                    }`}>
                      {tx.status}
                    </span>
                    <p className="text-xs text-ink/40">{new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                ))
              )}
            </div>

            {/* Load more */}
            {hasMoreTx && transactions.length > 0 && (
              <div className="text-center">
                <button
                  onClick={() => fetchTransactions(txOffset, true)}
                  disabled={loadingTransactions}
                  className="px-8 py-2 text-[10px] uppercase tracking-[0.2em] font-medium border border-ink/10 text-ink/60 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-50"
                >
                  Load More
                </button>
              </div>
            )}
          </div>
        )}

        {/* Payouts Tab */}
        {activeTab === 'payouts' && (
          <div className="space-y-8">
            {/* Pending Balances */}
            <div className="space-y-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Trainer Pending Balances</p>
              <div className="border border-ink/10">
                <div className="grid grid-cols-[2fr_120px_100px_100px_180px] gap-4 px-6 py-3 border-b border-ink/10 bg-ink/[0.02]">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Trainer</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Balance</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Bookings</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Stripe</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Actions</p>
                </div>

                {loadingPayouts ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-4 h-4 border border-ink/20 border-t-ink/60 rounded-full animate-spin mx-auto" />
                  </div>
                ) : payoutBalances.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-xs text-ink/30">No pending payout balances</p>
                  </div>
                ) : (
                  payoutBalances.map((b) => (
                    <div
                      key={b.trainer_profile_id}
                      className="grid grid-cols-[2fr_120px_100px_100px_180px] gap-4 px-6 py-4 border-b border-ink/5 items-center hover:bg-ink/[0.02] transition-colors last:border-0"
                    >
                      <p className="text-sm text-ink">{b.trainer_name}</p>
                      <p className="text-sm text-ink font-medium">${Number(b.pending_balance).toFixed(2)}</p>
                      <p className="text-sm text-ink/60">{b.unpaid_booking_count}</p>
                      <span className={`text-[9px] uppercase tracking-wider font-medium ${b.stripe_account_id ? 'text-emerald-600' : 'text-red-500'}`}>
                        {b.stripe_account_id ? 'Connected' : 'None'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprovePayout(b)}
                          disabled={processingPayoutTrainerId === b.trainer_profile_id || !b.stripe_account_id || b.pending_balance < 50}
                          className="px-3 py-1 text-[9px] uppercase tracking-wider font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {processingPayoutTrainerId === b.trainer_profile_id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleHoldPayout(b)}
                          disabled={processingPayoutTrainerId === b.trainer_profile_id}
                          className="px-3 py-1 text-[9px] uppercase tracking-wider font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-40"
                        >
                          Hold
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payout History */}
            <div className="space-y-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Payout History</p>
              <div className="border border-ink/10">
                <div className="grid grid-cols-[1fr_120px_100px_100px_140px] gap-4 px-6 py-3 border-b border-ink/10 bg-ink/[0.02]">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">ID</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Amount</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Status</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Initiated</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Date</p>
                </div>
                {loadingPayoutHistory ? (
                  <div className="px-6 py-8 text-center">
                    <div className="w-4 h-4 border border-ink/20 border-t-ink/60 rounded-full animate-spin mx-auto" />
                  </div>
                ) : payoutHistory.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-xs text-ink/30">No payout history</p>
                  </div>
                ) : (
                  payoutHistory.map((ph) => (
                    <div
                      key={ph.id}
                      className="grid grid-cols-[1fr_120px_100px_100px_140px] gap-4 px-6 py-4 border-b border-ink/5 items-center hover:bg-ink/[0.02] transition-colors last:border-0"
                    >
                      <p className="text-xs text-ink/50 font-mono truncate">{ph.id.slice(0, 8)}...</p>
                      <p className="text-sm text-ink font-medium">${Number(ph.amount).toFixed(2)}</p>
                      <span className={`inline-block px-2 py-0.5 text-[9px] uppercase tracking-wider font-medium ${
                        ph.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                        ph.status === 'failed' ? 'bg-red-50 text-red-600' :
                        ph.status === 'held' ? 'bg-amber-50 text-amber-600' :
                        'bg-ink/5 text-ink/50'
                      }`}>
                        {ph.status}
                      </span>
                      <p className="text-xs text-ink/40">admin</p>
                      <p className="text-xs text-ink/40">{new Date(ph.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative max-w-sm flex-1">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-ink/10 bg-transparent text-sm text-ink placeholder-ink/25 focus:outline-none focus:border-ink/30"
                />
              </div>

              {/* Role filter */}
              <div className="flex gap-1">
                {['all', 'trainer', 'client', 'admin'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] font-medium border transition-colors ${
                      roleFilter === r
                        ? 'border-ink text-ink bg-ink/5'
                        : 'border-ink/10 text-ink/40 hover:text-ink'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Status filter */}
              <div className="flex gap-1">
                {['all', 'active', 'suspended'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] font-medium border transition-colors ${
                      statusFilter === s
                        ? 'border-ink text-ink bg-ink/5'
                        : 'border-ink/10 text-ink/40 hover:text-ink'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-ink/10">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_180px_80px_100px_100px_100px_120px_140px] gap-4 px-6 py-3 border-b border-ink/10 bg-ink/[0.02]">
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Name</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Email</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Role</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Tier</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Joined</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Last Login</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Status</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Override</p>
              </div>

              {loadingUsers ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-4 h-4 border border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : users.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-xs text-ink/30">No users found</p>
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="grid grid-cols-[1fr_180px_80px_100px_100px_100px_120px_140px] gap-4 px-6 py-4 border-b border-ink/5 items-center hover:bg-ink/[0.02] transition-colors"
                  >
                    <div>
                      <p className={`text-sm font-medium ${user.is_suspended ? 'text-ink/30 line-through' : 'text-ink'}`}>
                        {user.full_name || '—'}
                      </p>
                    </div>
                    <p className="text-xs text-ink/50 truncate">{user.email ?? '—'}</p>
                    <p className="text-[10px] uppercase tracking-widest text-ink/50">{user.role}</p>
                    <div>
                      {user.role === 'trainer' && user.subscription_tier ? (
                        <TierBadge
                          tier={user.subscription_tier}
                          status={user.subscription_status ?? 'inactive'}
                        />
                      ) : null}
                    </div>
                    <p className="text-[10px] text-ink/40">
                      {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-ink/40">
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'Never'}
                    </p>
                    <button
                      onClick={() => handleSuspend(user)}
                      className={`flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] font-medium transition-colors ${
                        user.is_suspended
                          ? 'text-green-600 hover:text-green-700'
                          : 'text-red-500 hover:text-red-600'
                      }`}
                    >
                      {user.is_suspended ? (
                        <><UserCheck size={12} /> Reinstate</>
                      ) : (
                        <><UserX size={12} /> Suspend</>
                      )}
                    </button>
                    <div>
                      {user.role === 'trainer' && (
                        overridingUserId === user.id ? (
                          <div className="flex items-center gap-2">
                            {(['free', 'pro', 'elite'] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => handleOverride(user.id, t)}
                                className="text-[9px] uppercase tracking-widest font-medium text-ink/50 hover:text-ink transition-colors"
                              >
                                {t}
                              </button>
                            ))}
                            <button
                              onClick={() => setOverridingUserId(null)}
                              className="text-[9px] uppercase tracking-widest font-medium text-ink/20 hover:text-ink/50 transition-colors ml-1"
                            >
                              x
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <button
                              onClick={() => setOverridingUserId(user.id)}
                              className="text-[9px] uppercase tracking-widest font-medium text-ink/30 hover:text-ink transition-colors"
                            >
                              Override
                            </button>
                            {user.tier_overridden_at && (
                              <p className="text-[8px] text-ink/25">
                                Set {new Date(user.tier_overridden_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Flag size={16} strokeWidth={1.5} className="text-ink/40" />
              <p className="text-xs uppercase tracking-[0.25em] font-medium text-ink/40">
                Flagged Reviews ({flaggedReviews.length})
              </p>
            </div>

            {loadingReviews ? (
              <div className="text-center py-16 text-ink/30 text-xs uppercase tracking-widest">Loading…</div>
            ) : flaggedReviews.length === 0 ? (
              <div className="text-center py-16 border border-ink/10 space-y-2">
                <Flag size={24} className="mx-auto text-ink/15" strokeWidth={1} />
                <p className="text-xs text-ink/30 uppercase tracking-widest">No flagged reviews</p>
              </div>
            ) : (
              <div className="space-y-4">
                {flaggedReviews.map((review) => (
                  <div
                    key={review.id}
                    className={`border p-6 space-y-3 ${review.is_hidden ? 'border-ink/5 opacity-50' : 'border-red-200'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] uppercase tracking-widest text-ink/40">
                            Client: {review.client?.full_name ?? '—'}
                          </span>
                          <span className="text-ink/20">·</span>
                          <span className="text-[10px] uppercase tracking-widest text-ink/40">
                            Trainer: {review.trainer?.full_name ?? '—'}
                          </span>
                          <span className="text-ink/20">·</span>
                          <span className="text-[10px] text-ink/30">
                            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-ink/60 leading-relaxed">{review.comment}</p>
                        )}
                        <p className="text-[10px] text-ink/25">
                          {new Date(review.created_at).toLocaleDateString('en-US', {
                            month: 'long', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleHideReview(review)}
                        className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium shrink-0 transition-colors ${
                          review.is_hidden
                            ? 'text-green-600 hover:text-green-700'
                            : 'text-red-500 hover:text-red-700'
                        }`}
                      >
                        {review.is_hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                        {review.is_hidden ? 'Restore' : 'Hide'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <ScrollText size={16} strokeWidth={1.5} className="text-ink/40" />
              <p className="text-xs uppercase tracking-[0.25em] font-medium text-ink/40">
                Audit Log
              </p>
            </div>

            <div className="border border-ink/10">
              {/* Table header */}
              <div className="grid grid-cols-[140px_1fr_100px_120px_100px_1fr] gap-4 px-6 py-3 border-b border-ink/10 bg-ink/[0.02]">
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Date</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Actor</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Action</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Table</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Record ID</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Changes</p>
              </div>

              {loadingAudit ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-4 h-4 border border-ink/20 border-t-ink/60 rounded-full animate-spin mx-auto" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="px-6 py-12 text-center space-y-2">
                  <ScrollText size={24} className="mx-auto text-ink/15" strokeWidth={1} />
                  <p className="text-xs text-ink/30 uppercase tracking-widest">No audit events recorded yet</p>
                </div>
              ) : (
                auditLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[140px_1fr_100px_120px_100px_1fr] gap-4 px-6 py-4 border-b border-ink/5 items-start hover:bg-ink/[0.02] transition-colors last:border-0"
                  >
                    <p className="text-[10px] text-ink/40">
                      {new Date(entry.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}{' '}
                      {new Date(entry.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <p className="text-sm text-ink truncate">
                      {entry.actor?.full_name ?? (entry.actor_id ? entry.actor_id.slice(0, 8) + '...' : 'System')}
                    </p>
                    <span className={`text-[10px] uppercase tracking-widest font-medium ${
                      entry.action === 'DELETE' ? 'text-red-500' :
                      entry.action === 'INSERT' ? 'text-green-600' :
                      'text-accent'
                    }`}>
                      {entry.action}
                    </span>
                    <p className="text-[10px] uppercase tracking-widest text-ink/50">{entry.table_name}</p>
                    <p className="text-[10px] text-ink/40 font-mono truncate" title={entry.record_id ?? ''}>
                      {entry.record_id ? entry.record_id.slice(0, 8) + '...' : '---'}
                    </p>
                    <div className="text-[10px] text-ink/40 overflow-hidden">
                      {entry.action === 'UPDATE' && entry.old_values && entry.new_values ? (
                        <AuditDiff oldValues={entry.old_values} newValues={entry.new_values} />
                      ) : entry.action === 'INSERT' ? (
                        <span className="text-green-600/60">New record created</span>
                      ) : entry.action === 'DELETE' ? (
                        <span className="text-red-500/60">Record deleted</span>
                      ) : (
                        <span>---</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {hasMoreAudit && auditLogs.length > 0 && (
              <div className="text-center">
                <button
                  onClick={() => fetchAuditLogs(auditOffset, true)}
                  disabled={loadingAudit}
                  className="border border-ink/10 px-8 py-3 text-[10px] uppercase tracking-[0.2em] font-medium text-ink/40 hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-40"
                >
                  {loadingAudit ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Certifications Tab */}
        {activeTab === 'certifications' && (
          <div className="space-y-8">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <ShieldCheck size={16} strokeWidth={1.5} className="text-accent" />
                <p className="text-xs uppercase tracking-[0.25em] font-medium text-ink/40">
                  Pending Certifications
                </p>
              </div>
              <p className="text-sm font-light text-ink/50">
                {loadingCerts ? 'Loading…' : `${pendingCerts.length} certification${pendingCerts.length !== 1 ? 's' : ''} awaiting review`}
              </p>
            </div>

            {/* USREPS universal verification link */}
            <div className="flex items-center gap-4 border border-ink/10 px-6 py-4">
              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-[0.15em] font-medium text-ink/60">U.S. Registry of Exercise Professionals</p>
                <p className="text-xs text-ink/40 mt-1">150,000+ active credentials. Verify any NCCA-accredited certification in one search.</p>
              </div>
              <a
                href="https://usreps.org"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 border border-accent/40 text-accent px-5 py-2.5 text-[11px] uppercase tracking-[0.15em] font-medium hover:bg-accent hover:text-white transition-all"
              >
                USREPS Registry
              </a>
            </div>

            {!loadingCerts && pendingCerts.length === 0 && (
              <div className="border border-ink/10 p-12 text-center">
                <ShieldCheck size={32} strokeWidth={1} className="text-green-400 mx-auto mb-3" />
                <p className="text-sm text-ink/40 font-light">All certifications reviewed — queue is empty.</p>
              </div>
            )}

            {pendingCerts.map((cert) => {
              const trainerName = (cert.trainer as any)?.profiles?.full_name ?? 'Unknown Trainer';
              const avatarUrl = (cert.trainer as any)?.profiles?.avatar_url ?? null;
              const certDef = getCertificationByCode(cert.cert_code);
              const tierLabel = certDef
                ? certDef.tier === 'gold' ? 'Gold (NCCA)'
                : certDef.tier === 'silver' ? 'Silver (Recognized)'
                : 'Specialty'
                : (() => {
                  for (const [key, tier] of Object.entries(CERTIFICATION_TIERS)) {
                    if (tier.certs.some(c => c.code === cert.cert_code)) {
                      return key === 'tier1_gold' ? 'Gold (NCCA)'
                           : key === 'tier2_silver' ? 'Silver (DEAC/NBFE)'
                           : 'Specialty';
                    }
                  }
                  return 'Unknown';
                })();

              const checklist = certChecklist[cert.id] ?? {};
              const checkItems = [
                { key: 'legible', label: 'Document is legible and not expired' },
                { key: 'matches_type', label: 'Certification matches the selected type' },
                { key: 'name_matches', label: "Trainer name on cert matches profile name" },
                { key: 'photo_ok', label: 'High-resolution profile photo uploaded' },
              ];
              const allChecked = checkItems.every(item => checklist[item.key]);

              const setCheck = (key: string, val: boolean) => {
                setCertChecklist(prev => ({
                  ...prev,
                  [cert.id]: { ...(prev[cert.id] ?? {}), [key]: val },
                }));
              };

              return (
                <div key={cert.id} className="border border-ink/10 p-8 space-y-6">
                  {/* Header row */}
                  <div className="flex items-start gap-6">
                    {/* Profile photo */}
                    <div className="shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={trainerName}
                          className="w-16 h-16 object-cover border border-ink/10"
                        />
                      ) : (
                        <div className="w-16 h-16 border border-red-200 bg-red-50 flex items-center justify-center">
                          <AlertTriangle size={20} className="text-red-400" strokeWidth={1.5} />
                        </div>
                      )}
                      {!avatarUrl && (
                        <p className="text-[9px] text-red-500 mt-1 uppercase tracking-wide">No photo</p>
                      )}
                    </div>

                    {/* Cert info */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{trainerName}</p>
                      <p className="text-sm font-light text-ink/70">{cert.cert_name}</p>
                      {certDef && (
                        <p className="text-[11px] text-ink/50 font-light">{certDef.issuer}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className={`text-[10px] uppercase tracking-[0.15em] font-semibold border px-2 py-0.5 ${
                          certDef?.tier === 'gold'
                            ? 'text-amber-700 border-amber-300 bg-amber-50'
                            : certDef?.tier === 'silver'
                            ? 'text-sky-700 border-sky-300 bg-sky-50'
                            : 'text-ink/60 border-ink/20 bg-ink/[0.03]'
                        }`}>
                          {tierLabel}
                        </span>
                        {certDef?.ncca_accredited && (
                          <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-green-700 border border-green-300 bg-green-50 px-2 py-0.5">
                            NCCA Accredited
                          </span>
                        )}
                        {certDef?.category && (
                          <span className="text-[10px] uppercase tracking-[0.12em] text-ink/40 border border-ink/15 px-2 py-0.5">
                            {certDef.category}
                          </span>
                        )}
                        <span className="text-[10px] text-ink/40 uppercase tracking-[0.1em]">
                          {cert.cert_code}
                        </span>
                        {cert.expiry_date && (
                          <span className="text-[10px] text-ink/40 uppercase tracking-[0.1em]">
                            Expires {new Date(cert.expiry_date).toLocaleDateString()}
                          </span>
                        )}
                        <span className="text-[10px] text-ink/30">
                          Submitted {new Date(cert.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Document + verify links */}
                    <div className="shrink-0 flex flex-col gap-2">
                      <a
                        href={cert.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-ink/20 px-4 py-2 text-[11px] uppercase tracking-[0.15em] hover:bg-ink hover:text-white transition-all text-center"
                      >
                        View Doc
                      </a>
                      {certDef?.verification_url && (
                        <a
                          href={certDef.verification_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border border-green-200 text-green-700 px-4 py-2 text-[11px] uppercase tracking-[0.15em] hover:bg-green-50 transition-all text-center"
                        >
                          Verify
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Admin checklist */}
                  <div className="space-y-2 border-t border-ink/5 pt-5">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium mb-3">Review Checklist</p>
                    {checkItems.map(item => (
                      <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                        <div
                          onClick={() => setCheck(item.key, !checklist[item.key])}
                          className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                            checklist[item.key] ? 'border-accent bg-accent' : 'border-ink/30 group-hover:border-ink/50'
                          }`}
                        >
                          {checklist[item.key] && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm font-light transition-colors ${checklist[item.key] ? 'text-ink' : 'text-ink/50'}`}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-ink/5">
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={certRejectNotes[cert.id] ?? ''}
                        onChange={e => setCertRejectNotes(n => ({ ...n, [cert.id]: e.target.value }))}
                        placeholder="Rejection reason (required if rejecting)…"
                        rows={2}
                        className="w-full border border-ink/10 bg-transparent px-4 py-2.5 text-sm font-light outline-none focus:border-red-300 transition-colors placeholder:text-ink/20 resize-none"
                      />
                    </div>
                    <div className="flex gap-3 sm:flex-col sm:w-36">
                      <button
                        onClick={() => handleCertApprove(cert.id)}
                        disabled={!allChecked || processingCertId === cert.id}
                        className="flex-1 sm:flex-none py-2.5 bg-green-600 text-white text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-green-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {processingCertId === cert.id ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleCertReject(cert.id)}
                        disabled={processingCertId === cert.id}
                        className="flex-1 sm:flex-none py-2.5 border border-red-200 text-red-700 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-red-50 transition-colors disabled:opacity-30"
                      >
                        {processingCertId === cert.id ? '…' : 'Reject'}
                      </button>
                    </div>
                  </div>

                  {!allChecked && (
                    <p className="text-[10px] text-ink/30 italic">
                      Complete all checklist items before approving.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div className="border border-ink/10 p-8 max-w-lg space-y-6">
              <div className="flex items-center gap-3">
                <Settings size={16} strokeWidth={1.5} className="text-ink/40" />
                <p className="text-xs uppercase tracking-[0.25em] font-medium text-ink/40">Platform Fee</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-ink/30">
                  Current: {Math.round(parseFloat(savedFee) * 100)}%
                </p>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="0.5"
                      value={platformFee}
                      onChange={(e) => setPlatformFee(e.target.value)}
                      className="w-full border border-ink/10 px-4 py-3 text-sm text-ink bg-transparent focus:outline-none focus:border-ink/30"
                      placeholder="0.08"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-ink/30 uppercase tracking-widest">
                      {isNaN(parseFloat(platformFee)) ? '' : `${Math.round(parseFloat(platformFee) * 100)}%`}
                    </span>
                  </div>
                  <button
                    onClick={handleSaveFee}
                    disabled={!isDirty || savingFee}
                    className="border border-accent text-accent px-8 py-3 text-[10px] uppercase tracking-[0.2em] font-medium hover:bg-accent hover:text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingFee ? 'Saving…' : 'Save'}
                  </button>
                </div>
                <p className="text-[9px] text-ink/25">Enter as decimal (e.g. 0.08 = 8%). Max 0.5 (50%).</p>
              </div>
            </div>

            {/* System health */}
            <div className="border border-ink/10 p-8 max-w-lg space-y-4">
              <p className="text-xs uppercase tracking-[0.25em] font-medium text-ink/40">System Health</p>
              <div className="space-y-3">
                <HealthRow label="Database" status="operational" />
                <HealthRow label="Edge Functions" status="operational" />
                <HealthRow label="Stripe Connect" status="operational" />
                <HealthRow label="Realtime" status="operational" />
              </div>
            </div>
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <AdminSupportQueue />
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}> = ({ icon, label, value, accent }) => (
  <div className="border border-ink/10 p-8 space-y-4">
    <div className={`${accent ? 'text-accent' : 'text-ink/30'}`}>{icon}</div>
    <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">{label}</p>
    <p className={`text-3xl serif font-light ${accent ? 'text-accent' : 'text-ink'}`}>{value}</p>
  </div>
);

const TierBadge: React.FC<{
  tier: 'free' | 'pro' | 'elite';
  status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'incomplete';
}> = ({ tier, status }) => {
  const isPastDue = status === 'past_due';
  const isTrialing = status === 'trialing';

  let label: string;
  let colorClass: string;

  if (isPastDue) {
    label = `${tier === 'pro' ? 'Pro' : 'Elite'} — Past Due`;
    colorClass = 'text-amber-600';
  } else if (tier === 'free') {
    label = 'Free';
    colorClass = 'text-ink/40';
  } else if (tier === 'pro') {
    label = isTrialing ? 'Pro — Trialing' : 'Pro';
    colorClass = isTrialing ? 'text-accent/70' : 'text-accent';
  } else {
    label = isTrialing ? 'Elite — Trialing' : 'Elite';
    colorClass = isTrialing ? 'text-ink/70' : 'text-ink';
  }

  return (
    <span className={`text-[10px] uppercase tracking-[0.15em] font-medium ${colorClass}`}>
      {label}
    </span>
  );
};

const AuditDiff: React.FC<{
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}> = ({ oldValues, newValues }) => {
  const changes: Array<{ key: string; from: unknown; to: unknown }> = [];
  for (const key of Object.keys(newValues)) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changes.push({ key, from: oldValues[key], to: newValues[key] });
    }
  }

  if (changes.length === 0) return <span className="text-ink/20">No changes</span>;

  // Show at most 3 changed fields to keep rows compact
  const shown = changes.slice(0, 3);
  const remaining = changes.length - shown.length;

  return (
    <div className="space-y-0.5">
      {shown.map((c) => (
        <p key={c.key} className="truncate">
          <span className="font-medium text-ink/50">{c.key}:</span>{' '}
          <span className="text-red-400 line-through">{String(c.from ?? 'null')}</span>{' '}
          <span className="text-green-600">{String(c.to ?? 'null')}</span>
        </p>
      ))}
      {remaining > 0 && (
        <p className="text-ink/25">+{remaining} more field{remaining > 1 ? 's' : ''}</p>
      )}
    </div>
  );
};

const HealthRow: React.FC<{ label: string; status: 'operational' | 'degraded' | 'down' }> = ({ label, status }) => (
  <div className="flex items-center justify-between">
    <p className="text-xs text-ink/60">{label}</p>
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${
        status === 'operational' ? 'bg-green-500' :
        status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
      }`} />
      <p className={`text-[9px] uppercase tracking-widest font-medium ${
        status === 'operational' ? 'text-green-600' :
        status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
      }`}>{status}</p>
    </div>
  </div>
);

export default AdminDashboard;
