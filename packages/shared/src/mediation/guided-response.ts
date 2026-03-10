import { ProposalOption } from '../types';
import { GuidedProposalResponse } from './types';
import { labelCalendarDiffs } from './compensation';
import { explainProposal } from './explain';

/**
 * Builds a guided proposal response with fairness explanation and labeled diffs.
 */
export function buildGuidedResponse(
  option: ProposalOption,
  requestDates: string[],
): GuidedProposalResponse {
  const labeledDiffs = labelCalendarDiffs(option.calendarDiff, requestDates);
  const explanation = explainProposal(
    option.fairnessImpact,
    option.stabilityImpact,
    option.handoffImpact,
    labeledDiffs,
  );

  return {
    optionId: option.id,
    rank: option.rank,
    label: option.label || `Option ${option.rank}`,
    explanation,
    labeledDiffs,
    isAutoApprovable: option.isAutoApprovable,
    penaltyScore: option.penaltyScore,
  };
}

/**
 * Builds guided responses for all options in a bundle, sorted by rank.
 */
export function buildGuidedBundle(
  options: ProposalOption[],
  requestDates: string[],
): GuidedProposalResponse[] {
  return options
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((opt) => buildGuidedResponse(opt, requestDates));
}
