import { describe, it, expect } from 'vitest';
import {
  computeDiscountRecommendations,
  computeOptimizationScore,
  buildIdleCellMap,
} from './slotOptimization';
import type { IdleHeatmapRow } from './slotOptimization';

// --- Test fixtures ---

const ROW_FULLY_IDLE: IdleHeatmapRow = { day_of_week: 2, hour: 9, total_count: 5, booked_count: 0 };
const ROW_MOSTLY_BOOKED: IdleHeatmapRow = { day_of_week: 3, hour: 14, total_count: 4, booked_count: 3 };
const ROW_PARTIALLY_BOOKED: IdleHeatmapRow = { day_of_week: 1, hour: 10, total_count: 6, booked_count: 1 };
const ROW_FULLY_BOOKED: IdleHeatmapRow = { day_of_week: 5, hour: 8, total_count: 3, booked_count: 3 };
const ROW_ZERO_TOTAL: IdleHeatmapRow = { day_of_week: 0, hour: 12, total_count: 0, booked_count: 0 };

// --- computeDiscountRecommendations ---

describe('computeDiscountRecommendations', () => {
  it('returns exactly topN items sorted by idle_count desc', () => {
    const rows = [ROW_FULLY_IDLE, ROW_MOSTLY_BOOKED, ROW_PARTIALLY_BOOKED];
    const result = computeDiscountRecommendations(rows, 2);
    expect(result).toHaveLength(2);
    // First item: idle_count=5 (ROW_FULLY_IDLE), second: idle_count=5 (ROW_PARTIALLY_BOOKED)
    expect(result[0].idle_count).toBe(5);
    expect(result[1].idle_count).toBe(5);
  });

  it('returns empty array when all rows are fully booked', () => {
    const result = computeDiscountRecommendations([ROW_FULLY_BOOKED], 5);
    expect(result).toHaveLength(0);
  });

  it('filters out rows with total_count=0 (no division by zero)', () => {
    const result = computeDiscountRecommendations([ROW_ZERO_TOTAL, ROW_FULLY_IDLE], 5);
    expect(result.every(r => r.day_of_week !== ROW_ZERO_TOTAL.day_of_week || r.hour !== ROW_ZERO_TOTAL.hour)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('assigns tier 25-35 for fill_rate < 20%', () => {
    // fill_rate = round(0/5*100) = 0, which is < 20
    const result = computeDiscountRecommendations([ROW_FULLY_IDLE], 5);
    expect(result[0].suggested_discount_min).toBe(25);
    expect(result[0].suggested_discount_max).toBe(35);
  });

  it('assigns tier 20-30 for fill_rate < 50%', () => {
    // ROW_PARTIALLY_BOOKED: fill_rate = round(1/6*100) = 17 ... actually 16.67 rounds to 17, which is < 20
    // Let's use a row where fill_rate is between 20-49
    const row: IdleHeatmapRow = { day_of_week: 4, hour: 15, total_count: 4, booked_count: 1 };
    // fill_rate = round(1/4*100) = 25, which is >= 20 and < 50
    const result = computeDiscountRecommendations([row], 5);
    expect(result[0].suggested_discount_min).toBe(20);
    expect(result[0].suggested_discount_max).toBe(30);
  });

  it('assigns tier 10-20 for fill_rate >= 50%', () => {
    // fill_rate = round(3/4*100) = 75
    const result = computeDiscountRecommendations([ROW_MOSTLY_BOOKED], 5);
    expect(result[0].suggested_discount_min).toBe(10);
    expect(result[0].suggested_discount_max).toBe(20);
  });

  it('returns fill_rate_pct as 0-100 integer', () => {
    const result = computeDiscountRecommendations([ROW_FULLY_IDLE], 5);
    expect(result[0].fill_rate_pct).toBe(0);
  });

  it('uses default topN of 5 when not provided', () => {
    const manyRows: IdleHeatmapRow[] = Array.from({ length: 10 }, (_, i) => ({
      day_of_week: i % 7,
      hour: i,
      total_count: 5,
      booked_count: 0,
    }));
    const result = computeDiscountRecommendations(manyRows);
    expect(result).toHaveLength(5);
  });
});

// --- computeOptimizationScore ---

describe('computeOptimizationScore', () => {
  it('returns 50 for computeOptimizationScore(50, 100)', () => {
    expect(computeOptimizationScore(50, 100)).toBe(50);
  });

  it('returns 0 for computeOptimizationScore(0, 0) — division by zero guard', () => {
    expect(computeOptimizationScore(0, 0)).toBe(0);
  });

  it('returns 80 for computeOptimizationScore(80, 100)', () => {
    expect(computeOptimizationScore(80, 100)).toBe(80);
  });

  it('returns 0 when bookedCount is 0 and totalCount > 0', () => {
    expect(computeOptimizationScore(0, 10)).toBe(0);
  });

  it('returns 100 when bookedCount equals totalCount', () => {
    expect(computeOptimizationScore(7, 7)).toBe(100);
  });
});

// --- buildIdleCellMap ---

describe('buildIdleCellMap', () => {
  it('returns a Map keyed by "day-hour" format', () => {
    const map = buildIdleCellMap([ROW_FULLY_IDLE]);
    expect(map.has('2-9')).toBe(true);
  });

  it('cell with total_count=0 has idle_intensity=0', () => {
    const map = buildIdleCellMap([ROW_ZERO_TOTAL]);
    const cell = map.get('0-12');
    expect(cell).toBeDefined();
    expect(cell!.idle_intensity).toBe(0);
  });

  it('cell with 4 total, 1 booked has idle_intensity=0.75', () => {
    const row: IdleHeatmapRow = { day_of_week: 1, hour: 5, total_count: 4, booked_count: 1 };
    const map = buildIdleCellMap([row]);
    const cell = map.get('1-5');
    expect(cell).toBeDefined();
    expect(cell!.idle_intensity).toBe(0.75);
  });

  it('cell stores correct total_count, booked_count, idle_count', () => {
    const map = buildIdleCellMap([ROW_FULLY_IDLE]);
    const cell = map.get('2-9');
    expect(cell!.total_count).toBe(5);
    expect(cell!.booked_count).toBe(0);
    expect(cell!.idle_count).toBe(5);
  });

  it('cell with all booked has idle_intensity=0 and idle_count=0', () => {
    const map = buildIdleCellMap([ROW_FULLY_BOOKED]);
    const cell = map.get('5-8');
    expect(cell!.idle_count).toBe(0);
    expect(cell!.idle_intensity).toBe(0);
  });

  it('handles multiple rows and builds correct number of entries', () => {
    const rows = [ROW_FULLY_IDLE, ROW_MOSTLY_BOOKED, ROW_PARTIALLY_BOOKED];
    const map = buildIdleCellMap(rows);
    expect(map.size).toBe(3);
  });
});
