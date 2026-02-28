// ─── Multi-Child Scoring ──────────────────────────────────────────────
//
// Dual-mode scoring for multi-child families:
// - INDIVIDUAL (≤4 children): Each child's age band contributes separately
// - GROUPED (5+): Collapse to up to 3 meta-groups (Young/School/Teen)
//
// Aggregation rules:
// - Hard constraints (max_consecutive, max_away): MIN across all children
// - Stability weights (transitions, school-night, max streak): MAX — most sensitive child
// - Fairness weights (fairness deviation, weekend parity): Weighted average
//   under-5 at 0.5×, 11+ at 1.5×, each child/group contributes once
// - Stability > fairness precedence: fairness capped at stability for families with child <5

import { MultiChildScoringMode } from '../enums';
import {
  MULTI_CHILD_THRESHOLD,
  MULTI_CHILD_FAIRNESS_YOUNG_FACTOR,
  MULTI_CHILD_FAIRNESS_TEEN_FACTOR,
  DEFAULT_SOLVER_WEIGHTS,
} from '../constants';
import type { AgeBandV2 } from './age_baselines';
import { AGE_BAND_DEFAULTS, AGE_BAND_ORDER_V2 } from './age_baselines';
import type { SolverWeightProfile } from './context';

// ─── Types ────────────────────────────────────────────────────────────

export type MetaGroup = 'young' | 'school' | 'teen';

export interface ChildScoreInput {
  childId: string;
  ageBand: AgeBandV2;
  maxConsecutive: number;
  maxAway: number;
}

export interface MultiChildResult {
  scoringMode: MultiChildScoringMode;
  /** MIN across all children — strictest child governs safety */
  hardConstraintFloors: {
    maxConsecutive: number;
    maxAway: number;
  };
  /** Aggregated soft-constraint weights */
  aggregatedWeights: Record<string, number>;
  /** Whether fairness was capped at stability */
  fairnessCapped: boolean;
  /** Meta-group breakdown (only meaningful for GROUPED mode) */
  metaGroups?: Array<{ group: MetaGroup; bands: AgeBandV2[]; childCount: number }>;
}

// ─── Scoring Mode Selection ──────────────────────────────────────────

export function selectScoringMode(childCount: number): MultiChildScoringMode {
  return childCount <= MULTI_CHILD_THRESHOLD
    ? MultiChildScoringMode.INDIVIDUAL
    : MultiChildScoringMode.GROUPED;
}

// ─── Meta-Group Classification ───────────────────────────────────────

const BAND_TO_META: Record<AgeBandV2, MetaGroup> = {
  '0-6m': 'young',
  '6-12m': 'young',
  '1-2y': 'young',
  '2-3y': 'young',
  '3-5y': 'young',
  '5-7y': 'school',
  '8-10y': 'school',
  '11-13y': 'teen',
  '14-17y': 'teen',
};

/**
 * Collapse children into up to 3 meta-groups for GROUPED mode.
 * Each group is represented by its youngest member's band.
 */
export function groupChildren(
  children: ChildScoreInput[],
): Array<{ group: MetaGroup; bands: AgeBandV2[]; childCount: number; representative: ChildScoreInput }> {
  const groups = new Map<MetaGroup, { bands: AgeBandV2[]; children: ChildScoreInput[] }>();

  for (const child of children) {
    const meta = BAND_TO_META[child.ageBand];
    if (!groups.has(meta)) {
      groups.set(meta, { bands: [], children: [] });
    }
    const g = groups.get(meta)!;
    g.bands.push(child.ageBand);
    g.children.push(child);
  }

  const result: Array<{ group: MetaGroup; bands: AgeBandV2[]; childCount: number; representative: ChildScoreInput }> = [];
  for (const [group, data] of groups) {
    // Representative = youngest band in this group (most restrictive)
    const sorted = [...data.children].sort(
      (a, b) => AGE_BAND_ORDER_V2.indexOf(a.ageBand) - AGE_BAND_ORDER_V2.indexOf(b.ageBand),
    );
    result.push({
      group,
      bands: data.bands,
      childCount: data.children.length,
      representative: sorted[0],
    });
  }

  return result;
}

// ─── Band Classification Helpers ─────────────────────────────────────

function isYoungBand(band: AgeBandV2): boolean {
  return BAND_TO_META[band] === 'young';
}

function isTeenBand(band: AgeBandV2): boolean {
  return BAND_TO_META[band] === 'teen';
}

function bandToWeightProfile(band: AgeBandV2): SolverWeightProfile {
  const idx = AGE_BAND_ORDER_V2.indexOf(band);
  if (idx <= 1) return 'infant';
  if (idx <= 4) return 'young_child';
  if (idx <= 6) return 'school_age';
  return 'teen';
}

function hasAnyYoungChild(children: ChildScoreInput[]): boolean {
  return children.some((c) => isYoungBand(c.ageBand));
}

// ─── Weight Aggregation ──────────────────────────────────────────────

/** Stability categories use MAX — most sensitive child defines weight */
const STABILITY_KEYS = ['totalTransitions', 'schoolNightDisruption', 'weekendFragmentation'] as const;

/** Fairness categories use weighted average */
const FAIRNESS_KEYS = ['fairnessDeviation'] as const;

/** Other keys pass through with MAX */
const OTHER_KEYS = ['nonDaycareHandoffs'] as const;

function fairnessWeightForBand(band: AgeBandV2): number {
  if (isYoungBand(band)) return MULTI_CHILD_FAIRNESS_YOUNG_FACTOR;
  if (isTeenBand(band)) return MULTI_CHILD_FAIRNESS_TEEN_FACTOR;
  return 1.0;
}

import { AGE_WEIGHT_MULTIPLIERS } from '../constants';

/**
 * Compute per-child solver weights from base weights + age multipliers.
 */
function childWeights(
  band: AgeBandV2,
  baseWeights: Record<string, number>,
): Record<string, number> {
  const profile = bandToWeightProfile(band);
  const mult = AGE_WEIGHT_MULTIPLIERS[profile] ?? AGE_WEIGHT_MULTIPLIERS['school_age'];
  const result: Record<string, number> = {};
  for (const key of Object.keys(baseWeights)) {
    result[key] = Math.round(baseWeights[key] * (mult[key] ?? 1));
  }
  return result;
}

/**
 * Aggregate weights across multiple children/groups.
 *
 * - Stability: MAX across contributors
 * - Fairness: Weighted average (young 0.5×, teen 1.5×, each contributes once)
 * - Other: MAX
 * - Post-cap: if any child <5, fairness weight ≤ stability weight
 */
export function aggregateMultiChildWeights(
  contributors: Array<{ band: AgeBandV2; weight: number }>,
  baseWeights: Record<string, number> = DEFAULT_SOLVER_WEIGHTS as unknown as Record<string, number>,
): { weights: Record<string, number>; fairnessCapped: boolean } {
  if (contributors.length === 0) {
    return { weights: { ...baseWeights }, fairnessCapped: false };
  }

  // Compute per-contributor weights
  const allWeights = contributors.map((c) => ({
    ...c,
    computed: childWeights(c.band, baseWeights),
  }));

  const result: Record<string, number> = {};

  // Stability: MAX
  for (const key of STABILITY_KEYS) {
    result[key] = Math.max(...allWeights.map((w) => w.computed[key] ?? 0));
  }

  // Other: MAX
  for (const key of OTHER_KEYS) {
    result[key] = Math.max(...allWeights.map((w) => w.computed[key] ?? 0));
  }

  // Fairness: weighted average
  for (const key of FAIRNESS_KEYS) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const cw of allWeights) {
      const fw = fairnessWeightForBand(cw.band) * cw.weight;
      weightedSum += (cw.computed[key] ?? 0) * fw;
      totalWeight += fw;
    }
    result[key] = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  // Stability > fairness precedence: cap fairness at max stability weight
  let fairnessCapped = false;
  const hasYoung = contributors.some((c) => isYoungBand(c.band));
  if (hasYoung) {
    const maxStability = Math.max(
      result['totalTransitions'] ?? 0,
      result['schoolNightDisruption'] ?? 0,
      result['weekendFragmentation'] ?? 0,
    );
    for (const key of FAIRNESS_KEYS) {
      if (result[key] > maxStability) {
        result[key] = maxStability;
        fairnessCapped = true;
      }
    }
  }

  return { weights: result, fairnessCapped };
}

// ─── Main Scoring Function ───────────────────────────────────────────

/**
 * Compute multi-child scoring result from per-child data.
 */
export function computeMultiChildScoring(
  children: ChildScoreInput[],
  baseWeights?: Record<string, number>,
): MultiChildResult {
  if (children.length === 0) {
    return {
      scoringMode: MultiChildScoringMode.INDIVIDUAL,
      hardConstraintFloors: {
        maxConsecutive: AGE_BAND_DEFAULTS['5-7y'].maxConsecutive,
        maxAway: AGE_BAND_DEFAULTS['5-7y'].maxAway,
      },
      aggregatedWeights: { ...DEFAULT_SOLVER_WEIGHTS },
      fairnessCapped: false,
    };
  }

  const mode = selectScoringMode(children.length);

  // Hard constraints: MIN across all children (strictest governs)
  const hardConstraintFloors = {
    maxConsecutive: Math.min(...children.map((c) => c.maxConsecutive)),
    maxAway: Math.min(...children.map((c) => c.maxAway)),
  };

  let contributors: Array<{ band: AgeBandV2; weight: number }>;
  let metaGroups: MultiChildResult['metaGroups'];

  if (mode === MultiChildScoringMode.INDIVIDUAL) {
    // Each child contributes once with equal weight
    contributors = children.map((c) => ({ band: c.ageBand, weight: 1 }));
  } else {
    // GROUPED: collapse to meta-groups, each contributes once
    const groups = groupChildren(children);
    contributors = groups.map((g) => ({
      band: g.representative.ageBand,
      weight: 1, // Each group contributes once — no headcount multiplication
    }));
    metaGroups = groups.map((g) => ({
      group: g.group,
      bands: g.bands,
      childCount: g.childCount,
    }));
  }

  const { weights, fairnessCapped } = aggregateMultiChildWeights(contributors, baseWeights);

  return {
    scoringMode: mode,
    hardConstraintFloors,
    aggregatedWeights: weights,
    fairnessCapped,
    metaGroups,
  };
}
