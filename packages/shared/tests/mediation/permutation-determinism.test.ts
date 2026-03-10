/**
 * Permutation Determinism Tests
 *
 * Verify that input ordering does not affect output.
 * Shuffles every list-type input across 100 permutations per function
 * and asserts identical JSON output.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  computeFeedbackDelta,
  applyFeedbackToWeights,
  accumulateDeltas,
  emptyWeightDelta,
} from '../../src/mediation/feedback-weights';
import { labelCalendarDiffs } from '../../src/mediation/compensation';
import { runPreConflictChecks } from '../../src/mediation/preconflict';
import { buildGuidedBundle } from '../../src/mediation/guided-response';
import { FeedbackCategory } from '../../src/mediation/types';
import { ParentRole } from '../../src/enums';
import { DEFAULT_SOLVER_WEIGHTS } from '../../src/constants';
import type { ProposalOption, CalendarDiffEntry } from '../../src/types';
import type { StructuredFeedback, WeightDelta } from '../../src/mediation/types';

const PERMUTATION_RUNS = 100;

// ── Helpers ──────────────────────────────────────────────────────────

/** Seeded PRNG (xorshift32) for reproducible shuffles without Math.random. */
function createRng(seed: number) {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

/** Fisher-Yates shuffle using seeded RNG. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hashJson(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

// ── Test Data ────────────────────────────────────────────────────────

const feedbacks: StructuredFeedback[] = [
  { category: FeedbackCategory.FAIRNESS, severity: 3 },
  { category: FeedbackCategory.TRANSITIONS, severity: 2 },
  { category: FeedbackCategory.ROUTINE, severity: 1 },
  { category: FeedbackCategory.INCONVENIENCE, severity: 2 },
  { category: FeedbackCategory.TIMING, severity: 1 },
];

const calendarDiffs: CalendarDiffEntry[] = [
  { date: '2026-03-05', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
  { date: '2026-03-06', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
  { date: '2026-03-10', oldParent: ParentRole.PARENT_B, newParent: ParentRole.PARENT_A },
  { date: '2026-03-11', oldParent: ParentRole.PARENT_B, newParent: ParentRole.PARENT_A },
  { date: '2026-03-14', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
];

const requestDates = ['2026-03-05', '2026-03-06'];

const proposalOptions: ProposalOption[] = [
  {
    id: 'opt-1',
    bundleId: 'bundle-1',
    rank: 1,
    label: 'Minimal change',
    calendarDiff: [
      { date: '2026-03-05', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
      { date: '2026-03-10', oldParent: ParentRole.PARENT_B, newParent: ParentRole.PARENT_A },
    ],
    fairnessImpact: { overnightDelta: 0, weekendDelta: 0, windowWeeks: 8 },
    stabilityImpact: { transitionsDelta: 0, maxStreakChange: 0, schoolNightChanges: 0 },
    handoffImpact: { newHandoffs: 1, removedHandoffs: 1, nonDaycareHandoffs: 0 },
    penaltyScore: 3.0,
    isAutoApprovable: true,
  },
  {
    id: 'opt-2',
    bundleId: 'bundle-1',
    rank: 2,
    label: 'Extended stay',
    calendarDiff: [
      { date: '2026-03-05', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
      { date: '2026-03-06', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
      { date: '2026-03-14', oldParent: ParentRole.PARENT_B, newParent: ParentRole.PARENT_A },
      { date: '2026-03-15', oldParent: ParentRole.PARENT_B, newParent: ParentRole.PARENT_A },
    ],
    fairnessImpact: { overnightDelta: 0, weekendDelta: 1, windowWeeks: 8 },
    stabilityImpact: { transitionsDelta: 1, maxStreakChange: 1, schoolNightChanges: 1 },
    handoffImpact: { newHandoffs: 2, removedHandoffs: 0, nonDaycareHandoffs: 1 },
    penaltyScore: 8.0,
    isAutoApprovable: false,
  },
  {
    id: 'opt-3',
    bundleId: 'bundle-1',
    rank: 3,
    label: 'Keep original',
    calendarDiff: [],
    fairnessImpact: { overnightDelta: 0, weekendDelta: 0, windowWeeks: 8 },
    stabilityImpact: { transitionsDelta: 0, maxStreakChange: 0, schoolNightChanges: 0 },
    handoffImpact: { newHandoffs: 0, removedHandoffs: 0, nonDaycareHandoffs: 0 },
    penaltyScore: 0,
    isAutoApprovable: true,
  },
];

// ── Tests ────────────────────────────────────────────────────────────

describe('permutation determinism', () => {
  describe('computeFeedbackDelta: feedback order independence', () => {
    it(`${PERMUTATION_RUNS} permutations produce identical deltas`, () => {
      const baseline = computeFeedbackDelta(feedbacks);
      const baselineHash = hashJson(baseline);
      const rng = createRng(42);
      const hashes = new Set<string>([baselineHash]);

      for (let i = 0; i < PERMUTATION_RUNS; i++) {
        const permuted = shuffle(feedbacks, rng);
        const result = computeFeedbackDelta(permuted);
        hashes.add(hashJson(result));
      }

      expect(hashes.size).toBe(1);
    });
  });

  describe('applyFeedbackToWeights: delta key order independence', () => {
    it(`${PERMUTATION_RUNS} permutations with shuffled delta keys produce identical weights`, () => {
      const delta: WeightDelta = {
        fairnessDeviation: 20,
        totalTransitions: 8,
        nonDaycareHandoffs: 0,
        weekendFragmentation: 5,
        schoolNightDisruption: 3,
      };
      const baseline = applyFeedbackToWeights({ ...DEFAULT_SOLVER_WEIGHTS }, delta);
      const baselineHash = hashJson(baseline);
      const rng = createRng(43);
      const hashes = new Set<string>([baselineHash]);

      for (let i = 0; i < PERMUTATION_RUNS; i++) {
        // Reconstruct delta with shuffled key insertion order
        const keys = shuffle(Object.keys(delta) as (keyof WeightDelta)[], rng);
        const permutedDelta = {} as WeightDelta;
        for (const k of keys) {
          permutedDelta[k] = delta[k];
        }
        const result = applyFeedbackToWeights({ ...DEFAULT_SOLVER_WEIGHTS }, permutedDelta);
        hashes.add(hashJson(result));
      }

      expect(hashes.size).toBe(1);
    });
  });

  describe('accumulateDeltas: operand order independence', () => {
    it('accumulating A+B equals B+A', () => {
      const a: WeightDelta = { fairnessDeviation: 10, totalTransitions: 5, nonDaycareHandoffs: 3, weekendFragmentation: 0, schoolNightDisruption: 7 };
      const b: WeightDelta = { fairnessDeviation: 8, totalTransitions: 12, nonDaycareHandoffs: 0, weekendFragmentation: 4, schoolNightDisruption: 2 };
      const ab = accumulateDeltas(a, b);
      const ba = accumulateDeltas(b, a);
      expect(ab).toEqual(ba);
    });

    it(`${PERMUTATION_RUNS} permutations of multi-delta accumulation produce identical results`, () => {
      const deltas: WeightDelta[] = [
        { fairnessDeviation: 5, totalTransitions: 3, nonDaycareHandoffs: 1, weekendFragmentation: 2, schoolNightDisruption: 4 },
        { fairnessDeviation: 10, totalTransitions: 0, nonDaycareHandoffs: 5, weekendFragmentation: 3, schoolNightDisruption: 1 },
        { fairnessDeviation: 2, totalTransitions: 8, nonDaycareHandoffs: 0, weekendFragmentation: 6, schoolNightDisruption: 3 },
        { fairnessDeviation: 7, totalTransitions: 4, nonDaycareHandoffs: 2, weekendFragmentation: 1, schoolNightDisruption: 5 },
      ];

      const baselineResult = deltas.reduce((acc, d) => accumulateDeltas(acc, d), emptyWeightDelta());
      const baselineHash = hashJson(baselineResult);
      const rng = createRng(44);
      const hashes = new Set<string>([baselineHash]);

      for (let i = 0; i < PERMUTATION_RUNS; i++) {
        const permuted = shuffle(deltas, rng);
        const result = permuted.reduce((acc, d) => accumulateDeltas(acc, d), emptyWeightDelta());
        hashes.add(hashJson(result));
      }

      expect(hashes.size).toBe(1);
    });
  });

  describe('labelCalendarDiffs: diff order independence', () => {
    it(`${PERMUTATION_RUNS} permutations of diff ordering produce identical labeled output`, () => {
      const baseline = labelCalendarDiffs(calendarDiffs, requestDates);
      // Sort by date for stable comparison since input order may differ
      const sortedBaseline = [...baseline].sort((a, b) => a.date.localeCompare(b.date));
      const baselineHash = hashJson(sortedBaseline);
      const rng = createRng(45);
      const hashes = new Set<string>([baselineHash]);

      for (let i = 0; i < PERMUTATION_RUNS; i++) {
        const permuted = shuffle(calendarDiffs, rng);
        const result = labelCalendarDiffs(permuted, requestDates);
        const sorted = [...result].sort((a, b) => a.date.localeCompare(b.date));
        hashes.add(hashJson(sorted));
      }

      expect(hashes.size).toBe(1);
    });

    it(`${PERMUTATION_RUNS} permutations of requestDates ordering produce identical output`, () => {
      const moreDates = ['2026-03-05', '2026-03-06', '2026-03-14'];
      const baseline = labelCalendarDiffs(calendarDiffs, moreDates);
      const sortedBaseline = [...baseline].sort((a, b) => a.date.localeCompare(b.date));
      const baselineHash = hashJson(sortedBaseline);
      const rng = createRng(46);
      const hashes = new Set<string>([baselineHash]);

      for (let i = 0; i < PERMUTATION_RUNS; i++) {
        const permutedDates = shuffle(moreDates, rng);
        const result = labelCalendarDiffs(calendarDiffs, permutedDates);
        const sorted = [...result].sort((a, b) => a.date.localeCompare(b.date));
        hashes.add(hashJson(sorted));
      }

      expect(hashes.size).toBe(1);
    });
  });

  describe('buildGuidedBundle: option order independence', () => {
    it(`${PERMUTATION_RUNS} permutations of option ordering produce identical ranked output`, () => {
      const baseline = buildGuidedBundle(proposalOptions, requestDates);
      const baselineHash = hashJson(baseline);
      const rng = createRng(47);
      const hashes = new Set<string>([baselineHash]);

      for (let i = 0; i < PERMUTATION_RUNS; i++) {
        const permuted = shuffle(proposalOptions, rng);
        const result = buildGuidedBundle(permuted, requestDates);
        hashes.add(hashJson(result));
      }

      expect(hashes.size).toBe(1);
    });
  });

  describe('runPreConflictChecks: parameter stability', () => {
    it('identical parameters always produce identical alerts regardless of call count', () => {
      const params = {
        familyId: 'fam-1',
        referenceDate: '2026-03-05',
        parentANights: 34,
        parentBNights: 28,
        windowWeeks: 8,
        maxOvernightDelta: 8,
        maxConsecutiveCurrent: 4,
        maxConsecutiveAllowed: 5,
        budgetUsed: 3,
        budgetLimit: 4,
      };

      const baseline = runPreConflictChecks(params);
      const baselineHash = hashJson(baseline);
      const hashes = new Set<string>([baselineHash]);

      for (let i = 0; i < PERMUTATION_RUNS; i++) {
        const result = runPreConflictChecks({ ...params });
        hashes.add(hashJson(result));
      }

      expect(hashes.size).toBe(1);
    });
  });

  describe('cross-function pipeline: feedback -> weights -> explanation', () => {
    it(`${PERMUTATION_RUNS} permutations of feedback order produce identical adjusted weights`, () => {
      const baseline = computeFeedbackDelta(feedbacks);
      const baselineWeights = applyFeedbackToWeights({ ...DEFAULT_SOLVER_WEIGHTS }, baseline);
      const baselineHash = hashJson(baselineWeights);
      const rng = createRng(48);
      const hashes = new Set<string>([baselineHash]);

      for (let i = 0; i < PERMUTATION_RUNS; i++) {
        const permuted = shuffle(feedbacks, rng);
        const delta = computeFeedbackDelta(permuted);
        const weights = applyFeedbackToWeights({ ...DEFAULT_SOLVER_WEIGHTS }, delta);
        hashes.add(hashJson(weights));
      }

      expect(hashes.size).toBe(1);
    });
  });
});
