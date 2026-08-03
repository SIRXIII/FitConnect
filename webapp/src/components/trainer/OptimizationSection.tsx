import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getDateBounds } from '@/lib/analytics';
import {
  IdleHeatmapRow,
  DiscountRecommendation,
  computeDiscountRecommendations,
  computeOptimizationScore,
  buildIdleCellMap,
} from '@/lib/slotOptimization';

// ============================================================
// Constants
// ============================================================

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CIRCUMFERENCE = 2 * Math.PI * 36; // ~226.2
// Hours 6-22 inclusive = 17 hours
const VISIBLE_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

// ============================================================
// Props
// ============================================================

interface OptimizationSectionProps {
  trainerId: string;
}

// ============================================================
// Component
// ============================================================

const OptimizationSection: React.FC<OptimizationSectionProps> = ({ trainerId }) => {
  const [, setSearchParams] = useSearchParams();

  const [idleRows, setIdleRows] = useState<IdleHeatmapRow[]>([]);
  const [utilization, setUtilization] = useState<{ total_count: number; booked_count: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // ----------------------------------------------------------
  // Data fetch — fixed 4-week window, independent of range selector
  // ----------------------------------------------------------

  const fetchData = async () => {
    setLoading(true);
    const bounds = getDateBounds('month');

    try {
      const [heatmapResult, utilResult] = await Promise.all([
        (supabase as any).rpc('get_trainer_idle_heatmap', {
          p_trainer_id: trainerId,
          p_start: bounds.start,
          p_end: bounds.end,
        }),
        (supabase as any).rpc('get_trainer_slot_utilization', {
          p_trainer_id: trainerId,
          p_start: bounds.start,
          p_end: bounds.end,
        }),
      ]);

      if (heatmapResult.error || utilResult.error) {
        toast.error('Failed to load optimization data');
        setLoading(false);
        return;
      }

      setIdleRows((heatmapResult.data as IdleHeatmapRow[] | null) ?? []);
      setUtilization(
        (utilResult.data as { total_count: number; booked_count: number } | null) ?? null
      );
    } catch {
      toast.error('Failed to load optimization data');
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId]);

  // ----------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------

  if (loading) {
    return (
      <div className="border border-ink/10 p-6 animate-pulse space-y-4">
        <div className="h-3 w-24 bg-ink/5" />
        <div className="h-24 bg-ink/5" />
        <div className="h-32 bg-ink/5" />
      </div>
    );
  }

  // ----------------------------------------------------------
  // Minimum data threshold
  // ----------------------------------------------------------

  const totalCount = utilization?.total_count ?? 0;
  const bookedCount = utilization?.booked_count ?? 0;

  if (totalCount < 10) {
    return (
      <div className="border border-ink/10 p-6 space-y-3">
        <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Optimization</p>
        <div className="py-8 text-center space-y-2">
          <p className="text-sm text-ink/40">Not enough data</p>
          <p className="text-[10px] text-ink/30">
            Complete at least 10 scheduled slots to see idle patterns and discount recommendations.
          </p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Derived data
  // ----------------------------------------------------------

  const score = computeOptimizationScore(bookedCount, totalCount);
  const cellMap = buildIdleCellMap(idleRows);
  const recommendations: DiscountRecommendation[] = computeDiscountRecommendations(idleRows, 5);

  const strokeOffset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
  const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

  const fillRateColor = (pct: number) =>
    pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="border border-ink/10 p-6 space-y-6">
      <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Optimization</p>

      {/* ---- Sub-section F1: Score Gauge ---- */}
      <div className="flex flex-col items-center gap-2">
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <svg viewBox="0 0 88 88" width="88" height="88" className="block">
            {/* Background track */}
            <circle
              cx="44"
              cy="44"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-ink/10"
            />
            {/* Progress arc */}
            <circle
              cx="44"
              cy="44"
              r="36"
              fill="none"
              stroke={scoreColor}
              strokeWidth="6"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '44px 44px', transition: 'stroke-dashoffset 0.7s ease' }}
            />
            {/* Center text */}
            <text
              x="44"
              y="49"
              textAnchor="middle"
              fontSize="16"
              fontWeight="300"
              fill="currentColor"
              className="text-ink"
            >
              {score}
            </text>
          </svg>
          <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40">Slot Utilization</p>
        </motion.div>
      </div>

      {/* ---- Sub-section F2: Idle Slot Heatmap ---- */}
      <div className="space-y-3">
        <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Idle Slot Patterns</p>

        <div className="overflow-x-auto">
          <div className="flex gap-2" style={{ minWidth: 500 }}>
            {/* Day labels */}
            <div className="flex flex-col gap-[2px] justify-around" style={{ minWidth: 28 }}>
              {DAYS.map((day) => (
                <span
                  key={day}
                  className="text-[8px] text-ink/40 text-right pr-1 leading-none"
                  style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
                >
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
                      gridTemplateColumns: `repeat(${VISIBLE_HOURS.length}, 1fr)`,
                      gap: 2,
                      marginBottom: 2,
                    }}
                  >
                    {VISIBLE_HOURS.map((hour) => {
                      const key = `${dayIdx}-${hour}`;
                      const cell = cellMap.get(key);
                      const idleCount = cell?.idle_count ?? 0;
                      const totalSlots = cell?.total_count ?? 0;
                      const intensity = cell?.idle_intensity ?? 0;

                      return (
                        <div
                          key={hour}
                          title={`${DAYS[dayIdx]} ${hour}:00 — ${idleCount} idle / ${totalSlots} total`}
                          onClick={() => console.log(`Clicked: ${DAYS[dayIdx]} ${hour}:00`, cell)}
                          style={{
                            height: 16,
                            backgroundColor: cell
                              ? `rgba(220, 80, 60, ${(intensity * 0.85).toFixed(2)})`
                              : 'rgba(0,0,0,0.03)',
                            minWidth: 0,
                            cursor: 'pointer',
                          }}
                          className="border border-ink/5"
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Hour labels — every 2nd hour for readability */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${VISIBLE_HOURS.length}, 1fr)`,
                  gap: 2,
                }}
              >
                {VISIBLE_HOURS.map((hour, idx) => (
                  <span
                    key={hour}
                    className="text-[7px] text-ink/30 text-center"
                    style={{ minWidth: 0 }}
                  >
                    {idx % 2 === 0 ? hour : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Sub-section F3: Discount Recommendation Cards ---- */}
      <div className="space-y-3">
        <p className="text-[9px] uppercase tracking-[0.2em] text-ink/40 font-medium">Discount Recommendations</p>

        {recommendations.length === 0 ? (
          <p className="text-sm text-ink/40 py-2">All slots are well-utilized.</p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="border border-ink/10 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={14} strokeWidth={1.5} className="text-ink/40 shrink-0 mt-0.5" />
                    <p className="text-sm text-ink">
                      {rec.idle_count} idle {DAYS[rec.day_of_week]} {rec.hour}:00 slots in 4 weeks
                    </p>
                  </div>
                  <span
                    className="text-[9px] uppercase tracking-[0.15em] shrink-0"
                    style={{ color: fillRateColor(rec.fill_rate_pct) }}
                  >
                    {rec.fill_rate_pct}% filled
                  </span>
                </div>

                <p className="text-xs text-ink/60">
                  Try {rec.suggested_discount_min}–{rec.suggested_discount_max}% off
                </p>

                <button
                  onClick={() => setSearchParams({ tab: 'overview' })}
                  className="text-[10px] uppercase tracking-[0.15em] border border-ink/20 px-3 py-1 hover:border-ink/40 transition-colors text-ink/60 hover:text-ink"
                >
                  Set Discount
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizationSection;
