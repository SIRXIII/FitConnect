import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import {
  TimeRange,
  getDateBounds,
  getBucketParam,
  formatBucketLabel,
  EarningRow,
  exportEarningsCSV,
} from '@/lib/analytics';

// ============================================================
// Constants
// ============================================================

const chartColors = {
  stroke: '#2d2d2d',
  fill: 'rgba(45,45,45,0.07)',
  grid: 'rgba(0,0,0,0.05)',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============================================================
// Types
// ============================================================

interface Metrics {
  gross_earnings: number;
  net_earnings: number;
  booking_count: number;
  avg_price: number;
  discount_adoption_pct: number;
}

interface TrendPoint {
  label: string;
  revenue: number;
  net: number;
  bookings: number;
}

interface HeatmapPoint {
  day_of_week: number;
  hour: number;
  count: number;
}

// ============================================================
// Component
// ============================================================

const AnalyticsTab: React.FC = () => {
  const { trainerProfile } = useAuthStore();

  const [range, setRange] = useState<TimeRange>('month');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
  const [earningRows, setEarningRows] = useState<EarningRow[]>([]);

  // ----------------------------------------------------------
  // Data fetch
  // ----------------------------------------------------------

  useEffect(() => {
    if (!trainerProfile) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      const bounds = getDateBounds(range);

      const [analyticsResult, peakResult] = await Promise.all([
        supabase.rpc('get_trainer_analytics', {
          p_trainer_id: trainerProfile.id,
          p_start: bounds.start,
          p_end: bounds.end,
          p_bucket: getBucketParam(range),
        }),
        supabase.rpc('get_trainer_peak_hours', {
          p_trainer_id: trainerProfile.id,
          p_start: bounds.start,
          p_end: bounds.end,
        }),
      ]);

      if (analyticsResult.error || peakResult.error) {
        toast.error('Failed to load analytics');
        setLoading(false);
        return;
      }

      const analyticsData = analyticsResult.data as {
        metrics: Metrics;
        trend: Array<{ bucket: string; gross: string; net: string; count: string }>;
      };
      const peakData = peakResult.data as HeatmapPoint[];

      setMetrics(analyticsData.metrics);

      setTrendData(
        (analyticsData.trend ?? []).map((d) => ({
          label: formatBucketLabel(d.bucket, range),
          revenue: Number(d.gross),
          net: Number(d.net),
          bookings: Number(d.count),
        }))
      );

      setHeatmapData(peakData ?? []);

      // Build earning rows for CSV export
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, created_at, rate_charged, trainer_payout, status, profiles!client_id(full_name)')
        .eq('trainer_id', trainerProfile.id)
        .eq('status', 'completed')
        .gte('created_at', bounds.start)
        .lte('created_at', bounds.end);

      if (!bookingsError && bookingsData) {
        setEarningRows(
          bookingsData.map((b: any) => ({
            date: (b.created_at as string).slice(0, 10),
            client: b.profiles?.full_name ?? 'Unknown',
            gross: Number(b.rate_charged),
            net: Number(b.trainer_payout),
            status: b.status,
          }))
        );
      }

      setLoading(false);
    };

    fetchAnalytics();
  }, [range, trainerProfile?.id]);

  // ----------------------------------------------------------
  // Loading skeleton
  // ----------------------------------------------------------

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 py-8">
        <div className="h-24 bg-ink/5" />
        <div className="h-4 w-1/2 bg-ink/5" />
        <div className="h-64 bg-ink/5" />
      </div>
    );
  }

  // ----------------------------------------------------------
  // Heatmap helpers
  // ----------------------------------------------------------

  const maxCount = Math.max(...heatmapData.map((d) => d.count), 1);

  const getHeatCell = (day: number, hour: number) => {
    const entry = heatmapData.find((d) => d.day_of_week === day && d.hour === hour);
    return entry?.count ?? 0;
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="space-y-10 py-6">

      {/* ---- Section A: Range selector ---- */}
      <div className="flex gap-0 border-b border-ink/10">
        {(['week', 'month', 'quarter', 'year'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-6 py-2 text-[10px] uppercase tracking-[0.2em] font-medium transition-colors ${
              range === r
                ? 'border-b-2 border-ink text-ink -mb-px'
                : 'text-ink/40 hover:text-ink'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* ---- Section B: Metric cards ---- */}
      {metrics ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="border border-ink/10 p-6 space-y-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Gross Earnings</p>
            <p className="text-2xl serif font-light text-ink">${metrics.gross_earnings.toFixed(2)}</p>
          </div>
          <div className="border border-ink/10 p-6 space-y-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Net Earnings</p>
            <p className="text-2xl serif font-light text-ink">${metrics.net_earnings.toFixed(2)}</p>
          </div>
          <div className="border border-ink/10 p-6 space-y-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Bookings</p>
            <p className="text-2xl serif font-light text-ink">{metrics.booking_count}</p>
          </div>
          <div className="border border-ink/10 p-6 space-y-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Avg Price</p>
            <p className="text-2xl serif font-light text-ink">${metrics.avg_price.toFixed(2)}</p>
          </div>
          <div className="border border-ink/10 p-6 space-y-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Discount Adoption</p>
            <p className="text-2xl serif font-light text-ink">{metrics.discount_adoption_pct}%</p>
            <p className="text-[8px] text-ink/30">bookings with active discount</p>
          </div>
        </div>
      ) : (
        <div className="border border-ink/10 p-8 text-center">
          <p className="text-sm text-ink/40">No bookings in this period.</p>
        </div>
      )}

      {/* ---- Section C: Charts ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="border border-ink/10 p-6 space-y-3">
          <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Revenue Trend</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${v}`}
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={chartColors.stroke}
                fill={chartColors.fill}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Booking Count */}
        <div className="border border-ink/10 p-6 space-y-3">
          <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Booking Count</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData}>
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip formatter={(v: number) => [v, 'Bookings']} />
              <Bar dataKey="bookings" fill={chartColors.stroke} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---- Section D: Peak Hours Heatmap ---- */}
      <div className="border border-ink/10 p-6 space-y-4">
        <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Peak Booking Hours</p>

        <div className="overflow-x-auto">
          <div className="flex gap-2" style={{ minWidth: 600 }}>
            {/* Day labels */}
            <div className="flex flex-col gap-[2px] justify-around" style={{ minWidth: 28 }}>
              {DAYS.map((day) => (
                <span key={day} className="text-[8px] text-ink/40 text-right pr-1 leading-none" style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {day}
                </span>
              ))}
            </div>

            {/* Grid + hour labels */}
            <div className="flex-1 space-y-1">
              {/* Heatmap grid */}
              <div>
                {DAYS.map((_, dayIdx) => (
                  <div
                    key={dayIdx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(24, 1fr)',
                      gap: 2,
                      marginBottom: 2,
                    }}
                  >
                    {Array.from({ length: 24 }, (_, hour) => {
                      const count = getHeatCell(dayIdx, hour);
                      const intensity = count / maxCount;
                      return (
                        <div
                          key={hour}
                          title={`${DAYS[dayIdx]} ${hour}:00 — ${count} bookings`}
                          style={{
                            height: 16,
                            backgroundColor: `rgba(45,45,45,${intensity.toFixed(2)})`,
                            minWidth: 0,
                          }}
                          className="border border-ink/5"
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Hour labels */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(24, 1fr)',
                  gap: 2,
                }}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <span
                    key={hour}
                    className="text-[7px] text-ink/30 text-center"
                    style={{ minWidth: 0 }}
                  >
                    {[0, 6, 12, 18, 23].includes(hour) ? hour : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Section E: Export CSV ---- */}
      <div className="flex justify-end">
        <button
          onClick={() => exportEarningsCSV(earningRows, range)}
          className="flex items-center gap-2 px-4 py-2 border border-ink/20 text-xs uppercase tracking-[0.15em] text-ink/60 hover:text-ink hover:border-ink/40 transition-colors"
        >
          <Download size={12} strokeWidth={1.5} />
          Export CSV
        </button>
      </div>

    </div>
  );
};

export default AnalyticsTab;
