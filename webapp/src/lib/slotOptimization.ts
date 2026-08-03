// slotOptimization.ts — Pure deterministic business logic for AI Discount Analytics.
// Phase 26-01: No external APIs, fill-rate math only, fully testable in isolation.

// ============================================================
// Types
// ============================================================

/** Matches the output shape of the get_trainer_idle_heatmap RPC. */
export interface IdleHeatmapRow {
  day_of_week: number;  // 0-6 (Sun=0, Sat=6)
  hour: number;         // 0-23
  total_count: number;
  booked_count: number;
}

/** A single discount recommendation for an idle time slot. */
export interface DiscountRecommendation {
  day_of_week: number;
  hour: number;
  idle_count: number;
  fill_rate_pct: number;           // 0-100 integer
  suggested_discount_min: number;  // e.g. 10, 20, or 25
  suggested_discount_max: number;  // min + 10
}

/** Enriched cell data for heatmap rendering. */
export interface IdleCell {
  total_count: number;
  booked_count: number;
  idle_count: number;
  idle_intensity: number;  // 0-1 (proportion idle)
}

// ============================================================
// computeDiscountRecommendations
// ============================================================

/**
 * Derive discount recommendations from idle heatmap rows.
 *
 * Discount tiers (based on fill_rate_pct):
 *   < 20%  → 25–35%  off  (high idle — aggressive discount)
 *   < 50%  → 20–30%  off  (moderate idle)
 *   >= 50% → 10–20%  off  (light idle)
 *
 * @param rows  IdleHeatmapRow[] from get_trainer_idle_heatmap RPC
 * @param topN  Maximum results to return (default 5)
 * @returns     DiscountRecommendation[] sorted by idle_count desc, sliced to topN
 */
export function computeDiscountRecommendations(
  rows: IdleHeatmapRow[],
  topN = 5
): DiscountRecommendation[] {
  return rows
    .filter(r => r.total_count > 0)
    .map(r => {
      const idle_count = r.total_count - r.booked_count;
      const fill_rate_pct = Math.round((r.booked_count / r.total_count) * 100);

      let suggested_discount_min: number;
      if (fill_rate_pct < 20) {
        suggested_discount_min = 25;
      } else if (fill_rate_pct < 50) {
        suggested_discount_min = 20;
      } else {
        suggested_discount_min = 10;
      }

      return {
        day_of_week: r.day_of_week,
        hour: r.hour,
        idle_count,
        fill_rate_pct,
        suggested_discount_min,
        suggested_discount_max: suggested_discount_min + 10,
      };
    })
    .filter(rec => rec.idle_count > 0)
    .sort((a, b) => b.idle_count - a.idle_count)
    .slice(0, topN);
}

// ============================================================
// computeOptimizationScore
// ============================================================

/**
 * Compute a 0-100 integer utilization score.
 *
 * Guards against division by zero: returns 0 when totalCount is 0.
 *
 * @param bookedCount  Number of booked slots
 * @param totalCount   Total slots available
 * @returns            Integer 0-100
 */
export function computeOptimizationScore(
  bookedCount: number,
  totalCount: number
): number {
  if (totalCount === 0) return 0;
  return Math.round((bookedCount / totalCount) * 100);
}

// ============================================================
// buildIdleCellMap
// ============================================================

/**
 * Build a lookup Map from IdleHeatmapRow data for heatmap rendering.
 *
 * Key format: `${day_of_week}-${hour}` (e.g. "2-9")
 * idle_intensity: proportion of slots that are idle (0-1)
 *
 * @param rows  IdleHeatmapRow[] from get_trainer_idle_heatmap RPC
 * @returns     Map<string, IdleCell>
 */
export function buildIdleCellMap(rows: IdleHeatmapRow[]): Map<string, IdleCell> {
  const map = new Map<string, IdleCell>();

  for (const r of rows) {
    const key = `${r.day_of_week}-${r.hour}`;
    const idle_count = r.total_count - r.booked_count;
    const idle_intensity = r.total_count > 0 ? idle_count / r.total_count : 0;

    map.set(key, {
      total_count: r.total_count,
      booked_count: r.booked_count,
      idle_count,
      idle_intensity,
    });
  }

  return map;
}
