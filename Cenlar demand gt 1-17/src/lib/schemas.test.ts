import { describe, it, expect } from 'vitest';
import {
  healthConditionsSchema,
  intensityPreferenceSchema,
  goalsRankedSchema,
} from './schemas';

describe('Phase 23.1 schemas', () => {
  describe('healthConditionsSchema', () => {
    it('accepts empty array', () => {
      expect(healthConditionsSchema.parse([])).toEqual([]);
    });
    it('accepts valid condition strings', () => {
      expect(healthConditionsSchema.parse(['back_pain', 'asthma'])).toEqual(['back_pain', 'asthma']);
    });
    it('defaults to empty array when undefined', () => {
      expect(healthConditionsSchema.parse(undefined)).toEqual([]);
    });
  });

  describe('intensityPreferenceSchema', () => {
    it('accepts light', () => {
      expect(intensityPreferenceSchema.parse('light')).toBe('light');
    });
    it('accepts moderate', () => {
      expect(intensityPreferenceSchema.parse('moderate')).toBe('moderate');
    });
    it('accepts intense', () => {
      expect(intensityPreferenceSchema.parse('intense')).toBe('intense');
    });
    it('rejects invalid value', () => {
      expect(() => intensityPreferenceSchema.parse('extreme')).toThrow();
    });
    it('accepts undefined (optional)', () => {
      expect(intensityPreferenceSchema.parse(undefined)).toBeUndefined();
    });
  });

  describe('goalsRankedSchema', () => {
    it('accepts up to 3 goals', () => {
      expect(goalsRankedSchema.parse(['weight_loss', 'endurance'])).toEqual(['weight_loss', 'endurance']);
    });
    it('rejects more than 3 goals', () => {
      expect(() => goalsRankedSchema.parse(['a', 'b', 'c', 'd'])).toThrow();
    });
    it('defaults to empty array', () => {
      expect(goalsRankedSchema.parse(undefined)).toEqual([]);
    });
  });
});
