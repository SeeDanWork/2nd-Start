import { describe, it, expect } from 'vitest';
import {
  selectScoringMode,
  groupChildren,
  aggregateMultiChildWeights,
  computeMultiChildScoring,
} from '../../src/recommendations/multi_child';
import { MultiChildScoringMode } from '../../src/enums';
import { DEFAULT_SOLVER_WEIGHTS } from '../../src/constants';
import type { AgeBandV2 } from '../../src/recommendations/age_baselines';

// ─── selectScoringMode ──────────────────────────────────────────────

describe('selectScoringMode', () => {
  it('returns INDIVIDUAL for 1 child', () => {
    expect(selectScoringMode(1)).toBe(MultiChildScoringMode.INDIVIDUAL);
  });

  it('returns INDIVIDUAL for 4 children', () => {
    expect(selectScoringMode(4)).toBe(MultiChildScoringMode.INDIVIDUAL);
  });

  it('returns GROUPED for 5 children', () => {
    expect(selectScoringMode(5)).toBe(MultiChildScoringMode.GROUPED);
  });

  it('returns GROUPED for 8 children', () => {
    expect(selectScoringMode(8)).toBe(MultiChildScoringMode.GROUPED);
  });
});

// ─── groupChildren ──────────────────────────────────────────────────

describe('groupChildren', () => {
  it('collapses to 3 meta-groups for diverse ages', () => {
    const children = [
      { childId: '1', ageBand: '0-6m' as AgeBandV2, maxConsecutive: 1, maxAway: 1 },
      { childId: '2', ageBand: '1-2y' as AgeBandV2, maxConsecutive: 2, maxAway: 3 },
      { childId: '3', ageBand: '5-7y' as AgeBandV2, maxConsecutive: 5, maxAway: 5 },
      { childId: '4', ageBand: '8-10y' as AgeBandV2, maxConsecutive: 7, maxAway: 7 },
      { childId: '5', ageBand: '14-17y' as AgeBandV2, maxConsecutive: 7, maxAway: 7 },
    ];

    const groups = groupChildren(children);
    expect(groups).toHaveLength(3);

    const groupNames = groups.map((g) => g.group).sort();
    expect(groupNames).toEqual(['school', 'teen', 'young']);

    // Young group representative is youngest (0-6m)
    const young = groups.find((g) => g.group === 'young')!;
    expect(young.childCount).toBe(2);
    expect(young.representative.ageBand).toBe('0-6m');
  });

  it('produces single group for all same-age children', () => {
    const children = Array.from({ length: 5 }, (_, i) => ({
      childId: String(i),
      ageBand: '8-10y' as AgeBandV2,
      maxConsecutive: 7,
      maxAway: 7,
    }));

    const groups = groupChildren(children);
    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe('school');
    expect(groups[0].childCount).toBe(5);
  });
});

// ─── aggregateMultiChildWeights ─────────────────────────────────────

describe('aggregateMultiChildWeights', () => {
  const baseWeights: Record<string, number> = {
    fairnessDeviation: 100,
    totalTransitions: 50,
    nonDaycareHandoffs: 30,
    weekendFragmentation: 40,
    schoolNightDisruption: 60,
  };

  it('returns base weights for empty contributors', () => {
    const { weights } = aggregateMultiChildWeights([], baseWeights);
    expect(weights).toEqual(baseWeights);
  });

  it('deterministic: same inputs always produce same outputs', () => {
    const contributors = [
      { band: '0-6m' as AgeBandV2, weight: 1 },
      { band: '8-10y' as AgeBandV2, weight: 1 },
    ];
    const r1 = aggregateMultiChildWeights(contributors, baseWeights);
    const r2 = aggregateMultiChildWeights(contributors, baseWeights);
    expect(r1).toEqual(r2);
  });

  it('stability uses MAX across children (infant vs school-age)', () => {
    const contributors = [
      { band: '0-6m' as AgeBandV2, weight: 1 },  // infant: transitions 2.0×
      { band: '8-10y' as AgeBandV2, weight: 1 },  // school: transitions 1.0×
    ];
    const { weights } = aggregateMultiChildWeights(contributors, baseWeights);
    // Infant totalTransitions = 50 * 2.0 = 100
    // School totalTransitions = 50 * 1.0 = 50
    // MAX = 100
    expect(weights.totalTransitions).toBe(100);
  });

  it('fairness uses weighted average (school-age + teen, no cap)', () => {
    // Use school-age + teen (no young child) to avoid stability cap
    const contributors = [
      { band: '8-10y' as AgeBandV2, weight: 1 },   // school: fairness 1.0×, contribution 1.0×
      { band: '14-17y' as AgeBandV2, weight: 1 },   // teen: fairness 1.5×, contribution 1.5×
    ];
    const { weights, fairnessCapped } = aggregateMultiChildWeights(contributors, baseWeights);
    // school fairness = round(100 * 1.0) = 100, teen fairness = round(100 * 1.5) = 150
    // weighted avg = (100 * 1.0 + 150 * 1.5) / (1.0 + 1.5) = (100 + 225) / 2.5 = 130
    expect(weights.fairnessDeviation).toBe(130);
    expect(fairnessCapped).toBe(false);
  });

  it('caps fairness at max stability when young child present', () => {
    const contributors = [
      { band: '0-6m' as AgeBandV2, weight: 1 },
      { band: '14-17y' as AgeBandV2, weight: 1 },
    ];
    const { weights, fairnessCapped } = aggregateMultiChildWeights(contributors, baseWeights);
    // Max stability across transitions, school-night, weekend-frag
    const maxStab = Math.max(
      weights.totalTransitions,
      weights.schoolNightDisruption,
      weights.weekendFragmentation,
    );
    expect(weights.fairnessDeviation).toBeLessThanOrEqual(maxStab);
    // In this case fairness 130 > max stability 100 (transitions), so it should be capped
    expect(fairnessCapped).toBe(true);
    expect(weights.fairnessDeviation).toBe(maxStab);
  });

  it('does NOT cap fairness when no young children', () => {
    const contributors = [
      { band: '8-10y' as AgeBandV2, weight: 1 },
      { band: '14-17y' as AgeBandV2, weight: 1 },
    ];
    const { fairnessCapped } = aggregateMultiChildWeights(contributors, baseWeights);
    expect(fairnessCapped).toBe(false);
  });
});

// ─── computeMultiChildScoring ───────────────────────────────────────

describe('computeMultiChildScoring', () => {
  it('returns school-age fallback for empty children', () => {
    const result = computeMultiChildScoring([]);
    expect(result.scoringMode).toBe(MultiChildScoringMode.INDIVIDUAL);
    expect(result.hardConstraintFloors.maxConsecutive).toBe(5);
  });

  it('single child returns INDIVIDUAL mode', () => {
    const result = computeMultiChildScoring([
      { childId: '1', ageBand: '0-6m', maxConsecutive: 1, maxAway: 1 },
    ]);
    expect(result.scoringMode).toBe(MultiChildScoringMode.INDIVIDUAL);
  });

  it('hard constraints use MIN across children', () => {
    const result = computeMultiChildScoring([
      { childId: '1', ageBand: '0-6m', maxConsecutive: 1, maxAway: 1 },
      { childId: '2', ageBand: '14-17y', maxConsecutive: 7, maxAway: 7 },
    ]);
    expect(result.hardConstraintFloors.maxConsecutive).toBe(1);
    expect(result.hardConstraintFloors.maxAway).toBe(1);
  });

  it('5+ children uses GROUPED mode with meta-groups', () => {
    const children = [
      { childId: '1', ageBand: '0-6m' as AgeBandV2, maxConsecutive: 1, maxAway: 1 },
      { childId: '2', ageBand: '1-2y' as AgeBandV2, maxConsecutive: 2, maxAway: 3 },
      { childId: '3', ageBand: '5-7y' as AgeBandV2, maxConsecutive: 5, maxAway: 5 },
      { childId: '4', ageBand: '8-10y' as AgeBandV2, maxConsecutive: 7, maxAway: 7 },
      { childId: '5', ageBand: '14-17y' as AgeBandV2, maxConsecutive: 7, maxAway: 7 },
    ];
    const result = computeMultiChildScoring(children);
    expect(result.scoringMode).toBe(MultiChildScoringMode.GROUPED);
    expect(result.metaGroups).toHaveLength(3);
    // Hard constraints still MIN across all
    expect(result.hardConstraintFloors.maxConsecutive).toBe(1);
  });

  it('grouped mode: each meta-group contributes once (no headcount multiplication)', () => {
    // 3 young + 3 school = 6 children, GROUPED mode
    const children = [
      { childId: '1', ageBand: '0-6m' as AgeBandV2, maxConsecutive: 1, maxAway: 1 },
      { childId: '2', ageBand: '1-2y' as AgeBandV2, maxConsecutive: 2, maxAway: 3 },
      { childId: '3', ageBand: '3-5y' as AgeBandV2, maxConsecutive: 4, maxAway: 4 },
      { childId: '4', ageBand: '5-7y' as AgeBandV2, maxConsecutive: 5, maxAway: 5 },
      { childId: '5', ageBand: '8-10y' as AgeBandV2, maxConsecutive: 7, maxAway: 7 },
      { childId: '6', ageBand: '8-10y' as AgeBandV2, maxConsecutive: 7, maxAway: 7 },
    ];
    const r1 = computeMultiChildScoring(children);

    // Same 2 meta-groups but different child counts shouldn't change weights
    const children2 = [
      { childId: '1', ageBand: '0-6m' as AgeBandV2, maxConsecutive: 1, maxAway: 1 },
      { childId: '2', ageBand: '1-2y' as AgeBandV2, maxConsecutive: 2, maxAway: 3 },
      { childId: '3', ageBand: '3-5y' as AgeBandV2, maxConsecutive: 4, maxAway: 4 },
      { childId: '4', ageBand: '3-5y' as AgeBandV2, maxConsecutive: 4, maxAway: 4 },
      { childId: '5', ageBand: '5-7y' as AgeBandV2, maxConsecutive: 5, maxAway: 5 },
      { childId: '6', ageBand: '5-7y' as AgeBandV2, maxConsecutive: 5, maxAway: 5 },
    ];
    const r2 = computeMultiChildScoring(children2);

    // Same meta-groups (young rep=0-6m, school rep=5-7y) → same aggregated weights
    expect(r1.aggregatedWeights).toEqual(r2.aggregatedWeights);
  });

  it('is deterministic', () => {
    const children = [
      { childId: '1', ageBand: '0-6m' as AgeBandV2, maxConsecutive: 1, maxAway: 1 },
      { childId: '2', ageBand: '8-10y' as AgeBandV2, maxConsecutive: 7, maxAway: 7 },
      { childId: '3', ageBand: '14-17y' as AgeBandV2, maxConsecutive: 7, maxAway: 7 },
    ];
    const r1 = computeMultiChildScoring(children);
    const r2 = computeMultiChildScoring(children);
    expect(r1).toEqual(r2);
  });
});
