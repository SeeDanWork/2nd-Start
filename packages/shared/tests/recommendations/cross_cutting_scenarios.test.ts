import { describe, it, expect } from 'vitest';
import {
  recommendBaselineV2,
  type BaselineRecommendationInputV2,
} from '../../src/recommendations/scoring';

// ─── Helpers ──────────────────────────────────────────────────────

function makeInput(
  overrides: Partial<BaselineRecommendationInputV2> = {},
): BaselineRecommendationInputV2 {
  return {
    children: [{ childId: 'c1', ageBand: '5-7y' }],
    anchor: { type: 'none' },
    exchangePreference: 'unknown',
    goals: {
      stabilityFirst: false,
      minimizeSeparation: false,
      fairnessStrict: false,
    },
    aggregationMode: 'youngest_child_rules',
    ...overrides,
  };
}

// ─── Scenario 1: Infant + Primary + Minimize Separation ─────────

describe('scenario: infant + primary + minimize separation', () => {
  const input = makeInput({
    children: [{ childId: 'baby', ageBand: '0-6m' }],
    anchor: { type: 'daycare' },
    exchangePreference: 'prefer_anchor',
    goals: {
      stabilityFirst: false,
      minimizeSeparation: true,
      fairnessStrict: false,
    },
  });

  it('top template is 223_daytime or 223', () => {
    const result = recommendBaselineV2(input);
    const topId = result.aggregate.recommendedTemplates[0].templateId;
    expect(['223_daytime', '223']).toContain(topId);
  });

  it('maxConsecutive = 1 (infant base 1, minSep -1, floor 1)', () => {
    const result = recommendBaselineV2(input);
    expect(result.aggregate.defaults.maxConsecutive).toBe(1);
  });

  it('per-child band is 0-6m', () => {
    const result = recommendBaselineV2(input);
    expect(result.perChild['baby'].ageBand).toBe('0-6m');
  });
});

// ─── Scenario 2: School-age + Shared + 50/50 + School ──────────

describe('scenario: school-age + shared + fairness + school', () => {
  const input = makeInput({
    children: [{ childId: 'kid', ageBand: '5-7y' }],
    anchor: { type: 'school' },
    exchangePreference: 'prefer_anchor',
    goals: {
      stabilityFirst: false,
      minimizeSeparation: false,
      fairnessStrict: true,
    },
  });

  it('top template has equal nights (50/50)', () => {
    const result = recommendBaselineV2(input);
    const topId = result.aggregate.recommendedTemplates[0].templateId;
    // All 50/50 templates
    const equalTemplates = ['223', '3443', '2255', '7on7off', '7on7off_midweek', '2week_blocks'];
    expect(equalTemplates).toContain(topId);
  });

  it('maxConsecutive = 5 (base for 5-7y)', () => {
    const result = recommendBaselineV2(input);
    expect(result.aggregate.defaults.maxConsecutive).toBe(5);
  });

  it('asymmetric templates penalized in goalFit', () => {
    const result = recommendBaselineV2(input);
    const breakdown = result.debug!.scoreBreakdown;
    // primary_weekends is asymmetric → goalFit=0.3
    expect(breakdown['primary_weekends'].goalFit).toBe(0.3);
    // 7on7off is symmetric → goalFit=1.0
    expect(breakdown['7on7off'].goalFit).toBe(1.0);
  });
});

// ─── Scenario 3: Mixed Ages (1y + 10y) ─────────────────────────

describe('scenario: mixed ages 1y + 10y, youngest-child-rules', () => {
  const input = makeInput({
    children: [
      { childId: 'toddler', ageBand: '1-2y' },
      { childId: 'older', ageBand: '8-10y' },
    ],
    aggregationMode: 'youngest_child_rules',
  });

  it('youngest band drives aggregate defaults', () => {
    const result = recommendBaselineV2(input);
    // 1-2y maxConsecutive=2 (no goal adjustment)
    expect(result.aggregate.defaults.maxConsecutive).toBe(2);
  });

  it('per-child defaults reflect each child age', () => {
    const result = recommendBaselineV2(input);
    expect(result.perChild['toddler'].ageBand).toBe('1-2y');
    expect(result.perChild['older'].ageBand).toBe('8-10y');
    expect(result.perChild['toddler'].defaults.maxConsecutive).toBe(2);
    expect(result.perChild['older'].defaults.maxConsecutive).toBe(7);
  });

  it('weighted aggregation produces different result', () => {
    const weighted = recommendBaselineV2({
      ...input,
      aggregationMode: 'weighted_children',
    });
    // weighted: (2+7)/2 = 4.5 → floor 4
    expect(weighted.aggregate.defaults.maxConsecutive).toBe(4);
  });
});

// ─── Scenario 4: Teen + Long Distance ──────────────────────────

describe('scenario: teen + long distance (91 min)', () => {
  const input = makeInput({
    children: [{ childId: 'teen', ageBand: '14-17y' }],
    distanceBetweenHomesMinutes: 91,
  });

  it('low-handoff templates get logistics bonus', () => {
    const result = recommendBaselineV2(input);
    const breakdown = result.debug!.scoreBreakdown;
    // 7on7off has 2 handoffs and gets >90 bonus
    expect(breakdown['7on7off'].logisticsFit).toBeGreaterThan(0.5);
  });

  it('high-handoff templates get distance penalty', () => {
    const result = recommendBaselineV2(input);
    const breakdown = result.debug!.scoreBreakdown;
    // primary_plus_midweek has 8 handoffs → penalty
    expect(breakdown['primary_plus_midweek'].logisticsFit).toBeLessThan(0.5);
  });

  it('maxConsecutive = 14 for teen', () => {
    const result = recommendBaselineV2(input);
    expect(result.aggregate.defaults.maxConsecutive).toBe(14);
  });
});

// ─── Scenario 5: Shift Work + No In-Person + School ────────────

describe('scenario: shift work + no in-person + school', () => {
  const input = makeInput({
    children: [{ childId: 'kid', ageBand: '8-10y' }],
    anchor: { type: 'school' },
    exchangePreference: 'ok_in_person',
    constraintsSummary: {
      shiftWorkLikelyA: true,
      noInPersonExchange: true,
    },
  });

  it('schoolAligned templates get constraint bonus', () => {
    const result = recommendBaselineV2(input);
    const breakdown = result.debug!.scoreBreakdown;
    // 3443 is schoolAligned
    expect(breakdown['3443'].constraintFit).toBeGreaterThan(0.5);
  });

  it('long-block templates get shift work bonus', () => {
    const result = recommendBaselineV2(input);
    const breakdown = result.debug!.scoreBreakdown;
    // 7on7off has maxBlock=7 ≥ 5 → shift bonus
    expect(breakdown['7on7off'].constraintFit).toBeGreaterThan(0.5);
  });
});

// ─── Scenario 6: Locked Nights + Fairness ──────────────────────

describe('scenario: 4 locked nights + fairness', () => {
  const input = makeInput({
    children: [{ childId: 'kid', ageBand: '5-7y' }],
    constraintsSummary: {
      lockedNightsCountA: 4,
    },
    goals: {
      stabilityFirst: false,
      minimizeSeparation: false,
      fairnessStrict: true,
    },
  });

  it('high-handoff templates penalized by constraints', () => {
    const result = recommendBaselineV2(input);
    const breakdown = result.debug!.scoreBreakdown;
    // 223 has 6 handoffs → locked nights penalty
    expect(breakdown['223'].constraintFit).toBeLessThan(0.5);
  });

  it('symmetric templates favored by fairness', () => {
    const result = recommendBaselineV2(input);
    const breakdown = result.debug!.scoreBreakdown;
    expect(breakdown['7on7off'].goalFit).toBe(1.0);
    expect(breakdown['primary_weekends'].goalFit).toBe(0.3);
  });
});

// ─── Scenario 7: Stability + Close Distance ────────────────────

describe('scenario: stability + close distance (15 min)', () => {
  const input = makeInput({
    children: [{ childId: 'kid', ageBand: '5-7y' }],
    distanceBetweenHomesMinutes: 15,
    goals: {
      stabilityFirst: true,
      minimizeSeparation: false,
      fairnessStrict: false,
    },
  });

  it('low-handoff templates favored by stability', () => {
    const result = recommendBaselineV2(input);
    const breakdown = result.debug!.scoreBreakdown;
    // 7on7off: 2 handoffs → goalFit ~0.857
    expect(breakdown['7on7off'].goalFit).toBeGreaterThan(0.8);
    // 223: 6 handoffs → goalFit ~0.286
    expect(breakdown['223'].goalFit).toBeLessThan(0.4);
  });

  it('close distance penalizes long blocks in logistics', () => {
    const result = recommendBaselineV2(input);
    const breakdown = result.debug!.scoreBreakdown;
    // dist ≤ 30 && handoffs ≤ 4 → penalty for not leveraging proximity
    expect(breakdown['7on7off'].logisticsFit).toBeLessThanOrEqual(0.5);
  });
});

// ─── Output Shape Verification ──────────────────────────────────

describe('output shape across all scenarios', () => {
  const scenarios: [string, BaselineRecommendationInputV2][] = [
    ['infant', makeInput({ children: [{ childId: 'c1', ageBand: '0-6m' }] })],
    ['toddler', makeInput({ children: [{ childId: 'c1', ageBand: '2-3y' }] })],
    ['preschool', makeInput({ children: [{ childId: 'c1', ageBand: '3-5y' }] })],
    ['school', makeInput({ children: [{ childId: 'c1', ageBand: '8-10y' }] })],
    ['teen', makeInput({ children: [{ childId: 'c1', ageBand: '14-17y' }] })],
  ];

  it.each(scenarios)('%s: returns 5 recommended templates', (label, input) => {
    const result = recommendBaselineV2(input);
    expect(result.aggregate.recommendedTemplates).toHaveLength(5);
  });

  it.each(scenarios)('%s: all scores are between 0 and 1', (label, input) => {
    const result = recommendBaselineV2(input);
    for (const t of result.aggregate.recommendedTemplates) {
      expect(t.score).toBeGreaterThanOrEqual(0);
      expect(t.score).toBeLessThanOrEqual(1);
    }
  });

  it.each(scenarios)('%s: has rationale bullets', (label, input) => {
    const result = recommendBaselineV2(input);
    expect(result.aggregate.rationaleBullets.length).toBeGreaterThanOrEqual(2);
  });

  it.each(scenarios)('%s: has disclaimers', (label, input) => {
    const result = recommendBaselineV2(input);
    expect(result.disclaimers.length).toBeGreaterThanOrEqual(2);
  });
});
