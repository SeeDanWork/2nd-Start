import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  ageFit,
  goalFit,
  logisticsFit,
  constraintFit,
  recommendBaselineV2,
  BaselineRecommendationInputSchema,
  type BaselineRecommendationInputV2,
} from '../../src/recommendations/scoring';
import { AGE_BAND_DEFAULTS } from '../../src/recommendations/age_baselines';
import { TEMPLATES_V2, type TemplateDefV2 } from '../../src/recommendations/templates';

// ─── Helpers ──────────────────────────────────────────────────────

function getTemplate(id: string): TemplateDefV2 {
  return TEMPLATES_V2.find((t) => t.id === id)!;
}

function makeInput(
  overrides: Partial<BaselineRecommendationInputV2> = {},
): BaselineRecommendationInputV2 {
  return {
    children: [{ childId: 'c1', ageBand: '5-7y' }],
    anchor: { type: 'school' },
    exchangePreference: 'ok_in_person',
    goals: {
      stabilityFirst: false,
      minimizeSeparation: false,
      fairnessStrict: false,
    },
    aggregationMode: 'youngest_child_rules',
    ...overrides,
  };
}

// ─── 1. ageFit component ─────────────────────────────────────────

describe('ageFit', () => {
  it('1st preferred → 1.0', () => {
    const defs = AGE_BAND_DEFAULTS['5-7y']; // preferred: 7on7off_midweek, 2255, 3443, 43
    expect(ageFit(getTemplate('7on7off_midweek'), defs)).toBe(1.0);
  });

  it('2nd preferred → 0.85', () => {
    const defs = AGE_BAND_DEFAULTS['5-7y'];
    expect(ageFit(getTemplate('2255'), defs)).toBe(0.85);
  });

  it('3rd preferred → 0.70', () => {
    const defs = AGE_BAND_DEFAULTS['5-7y'];
    expect(ageFit(getTemplate('3443'), defs)).toBe(0.70);
  });

  it('4th preferred → 0.55', () => {
    const defs = AGE_BAND_DEFAULTS['5-7y'];
    expect(ageFit(getTemplate('43'), defs)).toBe(0.55);
  });

  it('not in preferred list → ~0.25 baseline', () => {
    const defs = AGE_BAND_DEFAULTS['0-6m']; // preferred: 223_daytime, 223
    const score = ageFit(getTemplate('7on7off'), defs);
    expect(score).toBeLessThan(0.25); // maxBlock(7) > maxConsecutive(1), penalized
  });

  it('not preferred but maxBlock ≤ maxConsecutive → 0.25', () => {
    const defs = AGE_BAND_DEFAULTS['8-10y']; // maxConsecutive=7, preferred: 7on7off, 7on7off_midweek, 2255, 3443
    const score = ageFit(getTemplate('223'), defs); // maxBlock=3 ≤ 7
    expect(score).toBe(0.25);
  });

  it('minAgeMonths penalty when child is too young', () => {
    const defs = AGE_BAND_DEFAULTS['0-6m'];
    // 7on7off requires minAgeMonths=72, passing a 3-month-old should get hard penalty
    const score = ageFit(getTemplate('7on7off'), defs, 3);
    expect(score).toBe(0.05);
  });
});

// ─── 2. goalFit component ────────────────────────────────────────

describe('goalFit', () => {
  it('no goals → 0.5', () => {
    const goals = { stabilityFirst: false, minimizeSeparation: false, fairnessStrict: false };
    expect(goalFit(getTemplate('223'), goals)).toBe(0.5);
  });

  it('stabilityFirst: low handoffs → high score', () => {
    const goals = { stabilityFirst: true, minimizeSeparation: false, fairnessStrict: false };
    const low = goalFit(getTemplate('7on7off'), goals); // 2 handoffs
    const high = goalFit(getTemplate('223'), goals); // 6 handoffs
    expect(low).toBeGreaterThan(high);
  });

  it('minimizeSeparation: low maxBlock → high score', () => {
    const goals = { stabilityFirst: false, minimizeSeparation: true, fairnessStrict: false };
    const short = goalFit(getTemplate('223'), goals); // maxBlock=3
    const long = goalFit(getTemplate('7on7off'), goals); // maxBlock=7
    expect(short).toBeGreaterThan(long);
  });

  it('fairnessStrict: symmetric → 1.0, asymmetric → 0.3', () => {
    const goals = { stabilityFirst: false, minimizeSeparation: false, fairnessStrict: true };
    expect(goalFit(getTemplate('7on7off'), goals)).toBe(1.0); // 7/7
    expect(goalFit(getTemplate('primary_weekends'), goals)).toBe(0.3); // 10/4
  });

  it('multiple goals are averaged', () => {
    const goals = { stabilityFirst: true, minimizeSeparation: true, fairnessStrict: false };
    const score = goalFit(getTemplate('223'), goals);
    // stability: (1 - (6-1)/7) ≈ 0.286, minSep: (1 - (3-1)/13) ≈ 0.846
    // avg ≈ 0.566
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(0.7);
  });
});

// ─── 3. logisticsFit component ───────────────────────────────────

describe('logisticsFit', () => {
  it('base case → 0.5', () => {
    expect(
      logisticsFit(getTemplate('223'), { type: 'none' }, 'unknown'),
    ).toBe(0.5);
  });

  it('school + prefer_anchor + schoolAligned → +0.25', () => {
    const score = logisticsFit(
      getTemplate('3443'), // schoolAligned, 4 handoffs
      { type: 'school' },
      'prefer_anchor',
      35, // > 30 to avoid close-distance penalty
    );
    expect(score).toBe(0.75);
  });

  it('distance >45 + high handoffs → penalty', () => {
    const score = logisticsFit(
      getTemplate('primary_plus_midweek'), // 8 handoffs
      { type: 'none' },
      'unknown',
      60,
    );
    expect(score).toBeLessThan(0.5);
  });

  it('distance >90 + low-handoff template → bonus', () => {
    const score = logisticsFit(
      getTemplate('7on7off'), // 2 handoffs
      { type: 'none' },
      'unknown',
      100,
    );
    expect(score).toBeGreaterThan(0.5);
  });
});

// ─── 4. constraintFit component ──────────────────────────────────

describe('constraintFit', () => {
  it('no constraints → 0.5', () => {
    expect(constraintFit(getTemplate('223'))).toBe(0.5);
  });

  it('locked nights ≥3 + high handoffs → penalty', () => {
    const score = constraintFit(getTemplate('223'), { // 6 handoffs
      lockedNightsCountA: 4,
    });
    expect(score).toBeLessThan(0.5);
  });

  it('shift work + long blocks → bonus', () => {
    const score = constraintFit(getTemplate('7on7off'), { // maxBlock=7
      shiftWorkLikelyA: true,
    });
    expect(score).toBeGreaterThan(0.5);
  });

  it('noInPersonExchange + schoolAligned → bonus', () => {
    const score = constraintFit(getTemplate('3443'), { // schoolAligned
      noInPersonExchange: true,
    });
    expect(score).toBeGreaterThan(0.5);
  });
});

// ─── 5. Integration: infant → 223 ───────────────────────────────

describe('scoreTemplates integration', () => {
  it('infant (0-6m) → 223_daytime or 223 ranked first', () => {
    const result = recommendBaselineV2(
      makeInput({
        children: [{ childId: 'c1', ageBand: '0-6m' }],
        anchor: { type: 'none' },
      }),
    );
    const topId = result.aggregate.recommendedTemplates[0].templateId;
    expect(['223_daytime', '223']).toContain(topId);
  });

  it('teen + stability → 7on7off or 2week_blocks first', () => {
    const result = recommendBaselineV2(
      makeInput({
        children: [{ childId: 'c1', ageBand: '14-17y' }],
        goals: {
          stabilityFirst: true,
          minimizeSeparation: false,
          fairnessStrict: false,
        },
      }),
    );
    const topId = result.aggregate.recommendedTemplates[0].templateId;
    expect(['7on7off', '2week_blocks']).toContain(topId);
  });
});

// ─── 6. recommendBaselineV2 full pipeline ────────────────────────

describe('recommendBaselineV2 output shape', () => {
  it('returns correct structure', () => {
    const result = recommendBaselineV2(makeInput());

    // perChild
    expect(result.perChild).toHaveProperty('c1');
    expect(result.perChild['c1'].ageBand).toBe('5-7y');
    expect(result.perChild['c1'].defaults.maxConsecutive).toBeGreaterThanOrEqual(1);
    expect(result.perChild['c1'].templateRanks.length).toBeLessThanOrEqual(5);

    // aggregate
    expect(result.aggregate.derivedFrom).toBe('youngest_child_rules');
    expect(result.aggregate.defaults.maxConsecutive).toBeGreaterThanOrEqual(1);
    expect(result.aggregate.recommendedTemplates.length).toBe(5);
    expect(result.aggregate.rationaleBullets.length).toBeGreaterThanOrEqual(2);

    // each template score
    const first = result.aggregate.recommendedTemplates[0];
    expect(first.templateId).toBeTruthy();
    expect(first.name).toBeTruthy();
    expect(first.patternSummary).toMatch(/^[AB]{7}( [AB]{7})*$/);
    expect(first.score).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(first.confidence);
    expect(first.suggestedWhen.length).toBeGreaterThanOrEqual(2);
    expect(first.tradeoffs.length).toBeGreaterThanOrEqual(2);

    // disclaimers
    expect(result.disclaimers.length).toBeGreaterThanOrEqual(2);

    // debug
    expect(result.debug).toBeDefined();
    expect(result.debug!.scoreBreakdown).toBeDefined();
  });

  it('sorted by score descending', () => {
    const result = recommendBaselineV2(makeInput());
    const scores = result.aggregate.recommendedTemplates.map((t) => t.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});

// ─── 7. Determinism ──────────────────────────────────────────────

describe('determinism', () => {
  it('same input → deep-equal output', () => {
    const input = makeInput({
      children: [
        { childId: 'c1', ageBand: '3-5y' },
        { childId: 'c2', ageBand: '8-10y' },
      ],
      distanceBetweenHomesMinutes: 30,
      goals: {
        stabilityFirst: true,
        minimizeSeparation: false,
        fairnessStrict: true,
      },
    });

    const result1 = recommendBaselineV2(input);
    const result2 = recommendBaselineV2(input);

    expect(result1).toEqual(result2);
  });
});

// ─── 8. Zod validation ───────────────────────────────────────────

describe('Zod validation', () => {
  it('rejects empty children array', () => {
    expect(() =>
      recommendBaselineV2(
        makeInput({ children: [] as any }),
      ),
    ).toThrow(ZodError);
  });

  it('rejects child without ageBand or birthdate', () => {
    expect(() =>
      recommendBaselineV2(
        makeInput({ children: [{ childId: 'c1' }] }),
      ),
    ).toThrow(ZodError);
  });

  it('rejects invalid birthdate format', () => {
    expect(() =>
      recommendBaselineV2(
        makeInput({
          children: [{ childId: 'c1', birthdate: '01-15-2020' }],
        }),
      ),
    ).toThrow(ZodError);
  });

  it('accepts valid birthdate', () => {
    expect(() =>
      recommendBaselineV2(
        makeInput({
          children: [{ childId: 'c1', birthdate: '2020-01-15' }],
        }),
      ),
    ).not.toThrow();
  });
});

// ─── 9. Example I/O Fixtures ─────────────────────────────────────

describe('example I/O fixtures', () => {
  it('fixture 1: 0-6m + daycare + minimizeSeparation → 223_daytime first, maxConsecutive=1', () => {
    const result = recommendBaselineV2({
      children: [{ childId: 'baby', birthdate: '2025-10-15' }],
      anchor: { type: 'daycare' },
      exchangePreference: 'prefer_anchor',
      goals: {
        stabilityFirst: false,
        minimizeSeparation: true,
        fairnessStrict: false,
      },
      aggregationMode: 'youngest_child_rules',
    });

    // The top template for a 0-6m with minimizeSeparation should be 223_daytime
    const topId = result.aggregate.recommendedTemplates[0].templateId;
    expect(['223_daytime', '223']).toContain(topId);
    // MinSep adjusts down by 1, floor 1
    expect(result.aggregate.defaults.maxConsecutive).toBe(1);
  });

  it('fixture 2: 5-7y + school + stabilityFirst + commute=35 → maxConsecutive=6', () => {
    const result = recommendBaselineV2({
      children: [{ childId: 'kid', ageBand: '5-7y' }],
      anchor: { type: 'school' },
      exchangePreference: 'prefer_anchor',
      distanceBetweenHomesMinutes: 35,
      goals: {
        stabilityFirst: true,
        minimizeSeparation: false,
        fairnessStrict: false,
      },
      aggregationMode: 'youngest_child_rules',
    });

    expect(result.aggregate.defaults.maxConsecutive).toBe(6); // 5+1
    const topId = result.aggregate.recommendedTemplates[0].templateId;
    expect(['2255', '3443', '43', '7on7off', '7on7off_midweek']).toContain(topId);
  });

  it('fixture 3: 11-13y + shiftWork + ok_in_person → 7on7off first, maxConsecutive=7', () => {
    const result = recommendBaselineV2({
      children: [{ childId: 'tween', ageBand: '11-13y' }],
      anchor: { type: 'school' },
      exchangePreference: 'ok_in_person',
      constraintsSummary: {
        shiftWorkLikelyA: true,
      },
      goals: {
        stabilityFirst: false,
        minimizeSeparation: false,
        fairnessStrict: false,
      },
      aggregationMode: 'youngest_child_rules',
    });

    expect(result.aggregate.defaults.maxConsecutive).toBe(7);
    expect(result.aggregate.recommendedTemplates[0].templateId).toBe('7on7off');
  });

  it('fixture 4: mixed 2-3y + 8-10y, youngest_child_rules vs weighted_children', () => {
    const base = {
      children: [
        { childId: 'young', ageBand: '2-3y' as const },
        { childId: 'old', ageBand: '8-10y' as const },
      ],
      anchor: { type: 'school' as const },
      exchangePreference: 'ok_in_person' as const,
      goals: {
        stabilityFirst: false,
        minimizeSeparation: false,
        fairnessStrict: false,
      },
    };

    const youngest = recommendBaselineV2({
      ...base,
      aggregationMode: 'youngest_child_rules',
    });
    const weighted = recommendBaselineV2({
      ...base,
      aggregationMode: 'weighted_children',
    });

    // youngest_child_rules: 2-3y → maxConsecutive=3
    expect(youngest.aggregate.defaults.maxConsecutive).toBe(3);
    // weighted_children: (3+7)/2 = 5
    expect(weighted.aggregate.defaults.maxConsecutive).toBe(5);
    // Different aggregation modes produce different values
    expect(youngest.aggregate.defaults.maxConsecutive).not.toBe(
      weighted.aggregate.defaults.maxConsecutive,
    );
  });
});
