/**
 * analytics.ts — Pure TypeScript utilities for Phase 10 earnings analytics.
 *
 * No React imports, no Supabase import. Testable in isolation.
 * Consumed by AnalyticsTab.tsx (trainer) and AdminDashboard.tsx (admin).
 */

// ============================================================
// Types
// ============================================================

/** Time range selector values used throughout the analytics UI. */
export type TimeRange = 'week' | 'month' | 'quarter' | 'year';

/** A single row in the earnings CSV export. */
export interface EarningRow {
  date: string;
  client: string;
  gross: number;
  net: number;
  status: string;
}

// ============================================================
// getDateBounds
// ============================================================

/**
 * Computes ISO timestamp boundaries for a given time range.
 * Both start and end are relative to the current moment.
 *
 * - week:    7 days ago → now
 * - month:   1 month ago → now
 * - quarter: 3 months ago → now
 * - year:    1 year ago → now
 *
 * @returns { start: string; end: string } — ISO strings for p_start / p_end RPC params
 */
export function getDateBounds(range: TimeRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  if (range === 'week') {
    start.setDate(start.getDate() - 7);
  } else if (range === 'month') {
    start.setMonth(start.getMonth() - 1);
  } else if (range === 'quarter') {
    start.setMonth(start.getMonth() - 3);
  } else {
    // year
    start.setFullYear(start.getFullYear() - 1);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

// ============================================================
// getBucketParam
// ============================================================

/**
 * Maps a TimeRange to the p_bucket granularity parameter for the RPC function.
 *
 * - week    → 'day'   (7 data points)
 * - month   → 'day'   (30 data points)
 * - quarter → 'week'  (13 data points)
 * - year    → 'month' (12 data points)
 */
export function getBucketParam(range: TimeRange): 'day' | 'week' | 'month' {
  if (range === 'week' || range === 'month') return 'day';
  if (range === 'quarter') return 'week';
  return 'month'; // year
}

// ============================================================
// formatBucketLabel
// ============================================================

/**
 * Converts an ISO bucket timestamp from the RPC trend array to a human-readable label.
 *
 * - 'day' buckets   → "Mar 14"
 * - 'week' buckets  → "Mar 9"  (start of week)
 * - 'month' buckets → "Mar 2026"
 */
export function formatBucketLabel(bucket: string, range: TimeRange): string {
  const date = new Date(bucket);
  const bucketParam = getBucketParam(range);

  if (bucketParam === 'month') {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  // 'day' or 'week' buckets → "Mar 14"
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================
// exportEarningsCSV
// ============================================================

/**
 * Generates an RFC 4180-compliant CSV from EarningRow data and triggers a browser download.
 *
 * - BOM prefix (\uFEFF) for Excel UTF-8 compatibility
 * - All fields wrapped in double quotes
 * - Embedded double quotes escaped as "" per RFC 4180
 * - Filename: fitrush-earnings-{range}-{YYYY-MM-DD}.csv
 *
 * @param rows    Array of EarningRow objects to export
 * @param range   Time range used to build the filename
 */
export function exportEarningsCSV(rows: EarningRow[], range: TimeRange): void {
  const header = 'Date,Client,Gross,Net,Status';

  const lines = rows.map((r) => [
    `"${r.date.replace(/"/g, '""')}"`,
    `"${r.client.replace(/"/g, '""')}"`,
    `"${r.gross.toFixed(2)}"`,
    `"${r.net.toFixed(2)}"`,
    `"${r.status.replace(/"/g, '""')}"`,
  ].join(','));

  const csvContent = '\uFEFF' + [header, ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `fitrush-earnings-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
