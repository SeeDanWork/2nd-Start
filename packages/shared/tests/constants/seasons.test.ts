import { describe, it, expect } from 'vitest';
import { SEASON_WEIGHT_MULTIPLIERS } from '../../src/constants';
import { SeasonMode } from '../../src/enums';

describe('SEASON_WEIGHT_MULTIPLIERS', () => {
  it('should have entries for all 3 season modes', () => {
    const modes = Object.values(SeasonMode);
    expect(modes).toHaveLength(3);
    for (const mode of modes) {
      expect(SEASON_WEIGHT_MULTIPLIERS[mode]).toBeDefined();
    }
  });

  it('should have all weight keys in each mode', () => {
    const expectedKeys = [
      'fairnessDeviation',
      'totalTransitions',
      'nonDaycareHandoffs',
      'weekendFragmentation',
      'schoolNightDisruption',
      'handoffLocationPreference',
    ];
    for (const mode of Object.values(SeasonMode)) {
      const keys = Object.keys(SEASON_WEIGHT_MULTIPLIERS[mode]);
      for (const key of expectedKeys) {
        expect(keys).toContain(key);
      }
    }
  });

  it('should have all multipliers > 0', () => {
    for (const [mode, multipliers] of Object.entries(SEASON_WEIGHT_MULTIPLIERS)) {
      for (const [key, value] of Object.entries(multipliers)) {
        expect(value).toBeGreaterThan(0);
      }
    }
  });

  it('school_year should be baseline (~1.0 for most)', () => {
    const sy = SEASON_WEIGHT_MULTIPLIERS[SeasonMode.SCHOOL_YEAR];
    expect(sy.fairnessDeviation).toBe(1.0);
    expect(sy.totalTransitions).toBe(1.0);
    expect(sy.nonDaycareHandoffs).toBe(1.0);
  });

  it('summer should reduce schoolNightDisruption', () => {
    const summer = SEASON_WEIGHT_MULTIPLIERS[SeasonMode.SUMMER];
    expect(summer.schoolNightDisruption).toBeLessThan(1.0);
  });

  it('holiday_period should increase fairnessDeviation', () => {
    const holiday = SEASON_WEIGHT_MULTIPLIERS[SeasonMode.HOLIDAY_PERIOD];
    expect(holiday.fairnessDeviation).toBeGreaterThan(1.0);
  });
});
