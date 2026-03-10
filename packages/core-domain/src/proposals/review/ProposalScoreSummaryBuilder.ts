import { ProposalScoreSummary } from '../types';

/**
 * Builds a score summary from proposal schedule metadata.
 */
export function buildScoreSummary(
  scoreBreakdown: Record<string, unknown> | undefined,
): ProposalScoreSummary {
  if (!scoreBreakdown) return {};

  return {
    totalScore: typeof scoreBreakdown.totalScore === 'number' ? scoreBreakdown.totalScore : undefined,
    primaryScore: typeof scoreBreakdown.primaryScore === 'number' ? scoreBreakdown.primaryScore : undefined,
    secondaryScore: typeof scoreBreakdown.secondaryScore === 'number' ? scoreBreakdown.secondaryScore : undefined,
    breakdown: scoreBreakdown,
    penalties: typeof scoreBreakdown.penalties === 'number' ? scoreBreakdown.penalties : undefined,
  };
}
