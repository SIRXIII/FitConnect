import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, UserX, UserCheck, Settings, Users, DollarSign, BarChart2, TrendingUp, Flag, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/supabase';
import { type TimeRange, getDateBounds, getBucketParam } from '@/lib/analytics';

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
  role: 'trainer' | 'client' | null;
  is_suspended: boolean;
  created_at: string;
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
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'reviews' | 'settings'>('analytics');
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [flaggedReviews, setFlaggedReviews] = useState<FlaggedReview[]>([]);
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
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, role, is_suspended, created_at')
        .in('role', ['trainer', 'client'])
        .order('created_at', { ascending: false });

      if (search.trim()) {
        query = query.ilike('full_name', `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers((data ?? []) as UserRow[]);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [search]);

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

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchFlaggedReviews(); }, [fetchFlaggedReviews]);

  useEffect(() => {
    const fetchAdminAnalytics = async () => {
      setLoadingAdminAnalytics(true);
      const bounds = getDateBounds(adminRange);
      const { data, error } = await supabase.rpc('get_admin_analytics', {
        p_start: bounds.start,
        p_end: bounds.end,
        p_bucket: getBucketParam(adminRange),
      });
      if (error) {
        toast.error('Failed to load platform analytics');
        setLoadingAdminAnalytics(false);
        return;
      }
      setAdminTotals({
        total_revenue: Number(data.totals.total_revenue),
        total_platform_fee: Number(data.totals.total_platform_fee),
        total_payouts: Number(data.totals.total_payouts),
        booking_volume: Number(data.totals.booking_volume),
        mrr: Number(data.totals.mrr ?? 0),
        pro_subscriber_count: Number(data.totals.pro_subscriber_count ?? 0),
        elite_subscriber_count: Number(data.totals.elite_subscriber_count ?? 0),
        active_trial_count: Number(data.totals.active_trial_count ?? 0),
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
        <div className="flex border-b border-ink/10">
          {(['analytics', 'users', 'reviews', 'settings'] as const).map((tab) => (
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

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="relative max-w-sm">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                type="text"
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-ink/10 bg-transparent text-sm text-ink placeholder-ink/25 focus:outline-none focus:border-ink/30"
              />
            </div>

            <div className="border border-ink/10">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_120px_120px] gap-4 px-6 py-3 border-b border-ink/10 bg-ink/2">
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Name</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Role</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Joined</p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Status</p>
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
                    className="grid grid-cols-[1fr_100px_120px_120px] gap-4 px-6 py-4 border-b border-ink/5 items-center hover:bg-ink/2 transition-colors"
                  >
                    <div>
                      <p className={`text-sm font-medium ${user.is_suspended ? 'text-ink/30 line-through' : 'text-ink'}`}>
                        {user.full_name || '—'}
                      </p>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-ink/50">{user.role}</p>
                    <p className="text-[10px] text-ink/40">
                      {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
