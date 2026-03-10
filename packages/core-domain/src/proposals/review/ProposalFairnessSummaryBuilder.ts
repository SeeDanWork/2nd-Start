import { ProposalFairnessSummary } from '../types';

/**
 * Builds a fairness summary from proposal schedule metadata.
 */
export function buildFairnessSummary(
  fairnessProjection: Record<string, unknown> | undefined,
): ProposalFairnessSummary | undefined {
  if (!fairnessProjection) return undefined;
  if (Object.keys(fairnessProjection).length === 0) return undefined;

  const result: ProposalFairnessSummary = {};

  if (fairnessProjection.projectedNightDeviationByParentId &&
      typeof fairnessProjection.projectedNightDeviationByParentId === 'object') {
    result.projectedNightDeviationByParentId =
      fairnessProjection.projectedNightDeviationByParentId as Record<string, number>;
  }

  if (fairnessProjection.projectedWeekendDeviationByParentId &&
      typeof fairnessProjection.projectedWeekendDeviationByParentId === 'object') {
    result.projectedWeekendDeviationByParentId =
      fairnessProjection.projectedWeekendDeviationByParentId as Record<string, number>;
  }

  if (fairnessProjection.projectedHolidayDeviationByParentId &&
      typeof fairnessProjection.projectedHolidayDeviationByParentId === 'object') {
    result.projectedHolidayDeviationByParentId =
      fairnessProjection.projectedHolidayDeviationByParentId as Record<string, number>;
  }

  return result;
}
