import { FeedbackCategory, StructuredFeedback, WeightDelta } from './types';
import { MAX_FEEDBACK_DELTA_PER_WEIGHT } from '../constants';

/**
 * Deterministic mapping: FeedbackCategory + severity → weight delta.
 */
const FEEDBACK_WEIGHT_MAP: Record<FeedbackCategory, {
  targetWeight: keyof WeightDelta;
  severityDeltas: Record<1 | 2 | 3, number>;
}> = {
  [FeedbackCategory.FAIRNESS]: {
    targetWeight: 'fairnessDeviation',
    severityDeltas: { 1: 5, 2: 10, 3: 20 },
  },
  [FeedbackCategory.TRANSITIONS]: {
    targetWeight: 'totalTransitions',
    severityDeltas: { 1: 4, 2: 8, 3: 15 },
  },
  [FeedbackCategory.ROUTINE]: {
    targetWeight: 'schoolNightDisruption',
    severityDeltas: { 1: 3, 2: 6, 3: 12 },
  },
  [FeedbackCategory.INCONVENIENCE]: {
    targetWeight: 'weekendFragmentation',
    severityDeltas: { 1: 3, 2: 5, 3: 10 },
  },
  [FeedbackCategory.TIMING]: {
    targetWeight: 'fairnessDeviation', // metadata only — no weight change
    severityDeltas: { 1: 0, 2: 0, 3: 0 },
  },
};

/**
 * Empty weight delta — all zeros.
 */
export function emptyWeightDelta(): WeightDelta {
  return {
    fairnessDeviation: 0,
    totalTransitions: 0,
    nonDaycareHandoffs: 0,
    weekendFragmentation: 0,
    schoolNightDisruption: 0,
  };
}

/**
 * Computes the aggregate weight delta from a set of feedback items.
 * Each dimension is capped at MAX_FEEDBACK_DELTA_PER_WEIGHT.
 */
export function computeFeedbackDelta(feedbacks: StructuredFeedback[]): WeightDelta {
  const delta = emptyWeightDelta();

  for (const fb of feedbacks) {
    const mapping = FEEDBACK_WEIGHT_MAP[fb.category];
    if (!mapping) continue;

    const increment = mapping.severityDeltas[fb.severity] || 0;
    delta[mapping.targetWeight] += increment;
  }

  // Cap each dimension
  for (const key of Object.keys(delta) as (keyof WeightDelta)[]) {
    delta[key] = Math.min(delta[key], MAX_FEEDBACK_DELTA_PER_WEIGHT);
  }

  return delta;
}

/**
 * Applies a feedback weight delta to base solver weights.
 * Result is clamped to [0, 500] per dimension.
 */
export function applyFeedbackToWeights(
  baseWeights: Record<string, number>,
  delta: WeightDelta,
): Record<string, number> {
  const result = { ...baseWeights };

  for (const key of Object.keys(delta) as (keyof WeightDelta)[]) {
    if (key in result) {
      result[key] = Math.max(0, Math.min(500, result[key] + delta[key]));
    }
  }

  return result;
}

/**
 * Accumulates a new delta into an existing accumulated delta.
 * Each dimension is capped at MAX_FEEDBACK_DELTA_PER_WEIGHT.
 */
export function accumulateDeltas(
  existing: WeightDelta,
  incoming: WeightDelta,
): WeightDelta {
  const result = { ...existing };

  for (const key of Object.keys(incoming) as (keyof WeightDelta)[]) {
    result[key] = Math.min(
      result[key] + incoming[key],
      MAX_FEEDBACK_DELTA_PER_WEIGHT,
    );
  }

  return result;
}
