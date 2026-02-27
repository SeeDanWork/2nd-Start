import { describe, it, expect } from 'vitest';
import {
  type AgeBandV2,
  type AgeBandV1,
  type ChildInput,
  AGE_BAND_ORDER_V2,
  AGE_BAND_DEFAULTS,
  ageInMonths,
  birthdateToAgeBand,
  resolveChildAgeBand,
  getChildDefaults,
  youngestBand,
  adjustMaxConsecutive,
  aggregateDefaults,
  mapV1toV2,
  mapV2toV1,
} from '../../src/recommendations/age_baselines';

// ─── 1. birthdateToAgeBand: each of 9 bands with boundary dates ──

describe('birthdateToAgeBand', () => {
  const REF = '2026-01-15';

  it('newborn (0 months) → 0-6m', () => {
    expect(birthdateToAgeBand('2026-01-10', REF)).toBe('0-6m');
  });

  it('3 months → 0-6m', () => {
    expect(birthdateToAgeBand('2025-10-15', REF)).toBe('0-6m');
  });

  it('5 months 29 days → 0-6m', () => {
    expect(birthdateToAgeBand('2025-07-16', REF)).toBe('0-6m');
  });

  it('exactly 6 months → 6-12m', () => {
    expect(birthdateToAgeBand('2025-07-15', REF)).toBe('6-12m');
  });

  it('9 months → 6-12m', () => {
    expect(birthdateToAgeBand('2025-04-15', REF)).toBe('6-12m');
  });

  it('exactly 12 months → 1-2y', () => {
    expect(birthdateToAgeBand('2025-01-15', REF)).toBe('1-2y');
  });

  it('18 months → 1-2y', () => {
    expect(birthdateToAgeBand('2024-07-15', REF)).toBe('1-2y');
  });

  it('exactly 24 months → 2-3y', () => {
    expect(birthdateToAgeBand('2024-01-15', REF)).toBe('2-3y');
  });

  it('30 months → 2-3y', () => {
    expect(birthdateToAgeBand('2023-07-15', REF)).toBe('2-3y');
  });

  it('exactly 36 months → 3-5y', () => {
    expect(birthdateToAgeBand('2023-01-15', REF)).toBe('3-5y');
  });

  it('48 months → 3-5y', () => {
    expect(birthdateToAgeBand('2022-01-15', REF)).toBe('3-5y');
  });

  it('exactly 60 months → 5-7y', () => {
    expect(birthdateToAgeBand('2021-01-15', REF)).toBe('5-7y');
  });

  it('72 months → 5-7y', () => {
    expect(birthdateToAgeBand('2020-01-15', REF)).toBe('5-7y');
  });

  it('exactly 84 months → 8-10y', () => {
    expect(birthdateToAgeBand('2019-01-15', REF)).toBe('8-10y');
  });

  it('120 months → 8-10y', () => {
    expect(birthdateToAgeBand('2016-01-15', REF)).toBe('8-10y');
  });

  it('exactly 132 months → 11-13y', () => {
    expect(birthdateToAgeBand('2015-01-15', REF)).toBe('11-13y');
  });

  it('150 months → 11-13y', () => {
    expect(birthdateToAgeBand('2013-07-15', REF)).toBe('11-13y');
  });

  it('exactly 168 months → 14-17y', () => {
    expect(birthdateToAgeBand('2012-01-15', REF)).toBe('14-17y');
  });

  it('200 months (16+ years) → 14-17y', () => {
    expect(birthdateToAgeBand('2009-05-15', REF)).toBe('14-17y');
  });

  it('day-of-month edge: born Jan 20, ref Jan 15 → not yet 1 month', () => {
    // Born 2025-12-20, ref 2026-01-15 → 0 full months
    expect(birthdateToAgeBand('2025-12-20', REF)).toBe('0-6m');
  });
});

// ─── 2. ageInMonths ──────────────────────────────────────────────

describe('ageInMonths', () => {
  it('same date → 0 months', () => {
    expect(ageInMonths('2026-01-15', '2026-01-15')).toBe(0);
  });

  it('exactly one month', () => {
    expect(ageInMonths('2025-12-15', '2026-01-15')).toBe(1);
  });

  it('partial month (day not reached) → floors down', () => {
    expect(ageInMonths('2025-12-20', '2026-01-15')).toBe(0);
  });

  it('12 months = 1 year', () => {
    expect(ageInMonths('2025-01-15', '2026-01-15')).toBe(12);
  });
});

// ─── 3. resolveChildAgeBand ──────────────────────────────────────

describe('resolveChildAgeBand', () => {
  it('birthdate takes precedence over ageBand', () => {
    const child: ChildInput = {
      childId: 'c1',
      ageBand: '14-17y',
      birthdate: '2025-10-15', // 3 months old
    };
    expect(resolveChildAgeBand(child, '2026-01-15')).toBe('0-6m');
  });

  it('falls back to ageBand when no birthdate', () => {
    const child: ChildInput = { childId: 'c1', ageBand: '5-7y' };
    expect(resolveChildAgeBand(child)).toBe('5-7y');
  });

  it('throws when neither birthdate nor ageBand', () => {
    const child: ChildInput = { childId: 'c1' };
    expect(() => resolveChildAgeBand(child)).toThrow('neither birthdate nor ageBand');
  });
});

// ─── 4. youngestBand ─────────────────────────────────────────────

describe('youngestBand', () => {
  it('single band returns itself', () => {
    expect(youngestBand(['8-10y'])).toBe('8-10y');
  });

  it('mixed bands returns youngest', () => {
    expect(youngestBand(['8-10y', '2-3y', '14-17y'])).toBe('2-3y');
  });

  it('all same → returns that band', () => {
    expect(youngestBand(['5-7y', '5-7y'])).toBe('5-7y');
  });

  it('throws on empty array', () => {
    expect(() => youngestBand([])).toThrow();
  });
});

// ─── 5. adjustMaxConsecutive ─────────────────────────────────────

describe('adjustMaxConsecutive', () => {
  it('stabilityFirst adds 1', () => {
    expect(
      adjustMaxConsecutive(5, { stabilityFirst: true, minimizeSeparation: false }, '5-7y'),
    ).toBe(6);
  });

  it('minimizeSeparation subtracts 1', () => {
    expect(
      adjustMaxConsecutive(5, { stabilityFirst: false, minimizeSeparation: true }, '5-7y'),
    ).toBe(4);
  });

  it('both goals cancel out', () => {
    expect(
      adjustMaxConsecutive(5, { stabilityFirst: true, minimizeSeparation: true }, '5-7y'),
    ).toBe(5);
  });

  it('floors at 1', () => {
    expect(
      adjustMaxConsecutive(1, { stabilityFirst: false, minimizeSeparation: true }, '0-6m'),
    ).toBe(1);
  });

  it('caps at 7 for non-teen band', () => {
    expect(
      adjustMaxConsecutive(7, { stabilityFirst: true, minimizeSeparation: false }, '11-13y'),
    ).toBe(7);
  });

  it('caps at 14 for 14-17y', () => {
    expect(
      adjustMaxConsecutive(7, { stabilityFirst: true, minimizeSeparation: false }, '14-17y'),
    ).toBe(8);
  });
});

// ─── 6. aggregateDefaults ────────────────────────────────────────

describe('aggregateDefaults', () => {
  it('youngest_child_rules uses youngest band defaults', () => {
    const perChild = [
      { childId: 'c1', ageBand: '0-6m' as AgeBandV2, defaults: AGE_BAND_DEFAULTS['0-6m'] },
      { childId: 'c2', ageBand: '8-10y' as AgeBandV2, defaults: AGE_BAND_DEFAULTS['8-10y'] },
    ];
    const result = aggregateDefaults(perChild, 'youngest_child_rules');
    expect(result.derivedFrom).toBe('youngest_child_rules');
    expect(result.maxConsecutive).toBe(1); // 0-6m
    expect(result.maxAway).toBe(1);
  });

  it('weighted_children averages and floors', () => {
    const perChild = [
      { childId: 'c1', ageBand: '0-6m' as AgeBandV2, defaults: AGE_BAND_DEFAULTS['0-6m'] },
      { childId: 'c2', ageBand: '8-10y' as AgeBandV2, defaults: AGE_BAND_DEFAULTS['8-10y'] },
    ];
    const result = aggregateDefaults(perChild, 'weighted_children');
    expect(result.derivedFrom).toBe('weighted_children');
    // (1 + 7) / 2 = 4
    expect(result.maxConsecutive).toBe(4);
    expect(result.maxAway).toBe(4);
  });

  it('single child: both modes give same result', () => {
    const perChild = [
      { childId: 'c1', ageBand: '3-5y' as AgeBandV2, defaults: AGE_BAND_DEFAULTS['3-5y'] },
    ];
    const youngest = aggregateDefaults(perChild, 'youngest_child_rules');
    const weighted = aggregateDefaults(perChild, 'weighted_children');
    expect(youngest.maxConsecutive).toBe(weighted.maxConsecutive);
    expect(youngest.maxAway).toBe(weighted.maxAway);
  });

  it('three children with weighted average floors down', () => {
    const perChild = [
      { childId: 'c1', ageBand: '2-3y' as AgeBandV2, defaults: AGE_BAND_DEFAULTS['2-3y'] },
      { childId: 'c2', ageBand: '5-7y' as AgeBandV2, defaults: AGE_BAND_DEFAULTS['5-7y'] },
      { childId: 'c3', ageBand: '8-10y' as AgeBandV2, defaults: AGE_BAND_DEFAULTS['8-10y'] },
    ];
    const result = aggregateDefaults(perChild, 'weighted_children');
    // (3 + 5 + 7) / 3 = 5.0 → 5
    expect(result.maxConsecutive).toBe(5);
  });
});

// ─── 7. mapV1toV2 / mapV2toV1 round-trips ───────────────────────

describe('V1 ↔ V2 mapping', () => {
  it('V1 0-2 → V2 1-2y', () => {
    expect(mapV1toV2('0-2')).toBe('1-2y');
  });

  it('V1 3-4 → V2 3-5y', () => {
    expect(mapV1toV2('3-4')).toBe('3-5y');
  });

  it('V1 5-10 → V2 8-10y', () => {
    expect(mapV1toV2('5-10')).toBe('8-10y');
  });

  it('V1 11-17 → V2 14-17y', () => {
    expect(mapV1toV2('11-17')).toBe('14-17y');
  });

  it('V2 → V1 maps back to the correct coarse band', () => {
    const v2Bands: AgeBandV2[] = ['0-6m', '6-12m', '1-2y', '2-3y'];
    for (const band of v2Bands) {
      expect(mapV2toV1(band)).toBe('0-2');
    }
    expect(mapV2toV1('3-5y')).toBe('3-4');
    expect(mapV2toV1('5-7y')).toBe('5-10');
    expect(mapV2toV1('8-10y')).toBe('5-10');
    expect(mapV2toV1('11-13y')).toBe('11-17');
    expect(mapV2toV1('14-17y')).toBe('11-17');
  });

  it('round-trip V1→V2→V1 preserves V1 band', () => {
    const v1Bands: AgeBandV1[] = ['0-2', '3-4', '5-10', '11-17'];
    for (const band of v1Bands) {
      expect(mapV2toV1(mapV1toV2(band))).toBe(band);
    }
  });
});

// ─── 8. Band defaults table sanity ───────────────────────────────

describe('AGE_BAND_DEFAULTS sanity', () => {
  it('all 9 bands are defined', () => {
    expect(Object.keys(AGE_BAND_DEFAULTS)).toHaveLength(9);
  });

  it('maxConsecutive is non-decreasing across bands', () => {
    let prev = 0;
    for (const band of AGE_BAND_ORDER_V2) {
      expect(AGE_BAND_DEFAULTS[band].maxConsecutive).toBeGreaterThanOrEqual(prev);
      prev = AGE_BAND_DEFAULTS[band].maxConsecutive;
    }
  });

  it('each band has at least 2 preferred templates', () => {
    for (const band of AGE_BAND_ORDER_V2) {
      expect(AGE_BAND_DEFAULTS[band].preferredTemplates.length).toBeGreaterThanOrEqual(2);
    }
  });
});
