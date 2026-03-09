import {
  SolverCandidate,
  SolverArtifact,
  NormalizedSolverInput,
} from '../types';
import { computeStabilityScore } from '../objectives/StabilityObjective';
import { computeFamilyStructureScore } from '../objectives/FamilyStructureObjective';

/**
 * Builds structured solver artifacts from the selected candidate and full result.
 * Artifacts contain technical summaries — no narrative generation.
 */
export function buildArtifacts(
  candidates: SolverCandidate[],
  input: NormalizedSolverInput,
): SolverArtifact[] {
  const artifacts: SolverArtifact[] = [];

  if (candidates.length === 0) return artifacts;

  const selected = candidates[0];

  // 1. Score breakdown
  artifacts.push({
    type: 'score_breakdown',
    data: {
      candidateId: selected.candidateId,
      score: selected.score,
    },
  });

  // 2. Changed-night summary
  const stabilityResult = computeStabilityScore(selected.nights, selected.exchanges, input);
  artifacts.push({
    type: 'changed_night_summary',
    data: {
      changedNights: stabilityResult.changedNights,
      changedExchanges: stabilityResult.changedExchanges,
      totalNights: selected.nights.length,
      stabilityScore: stabilityResult.score,
    },
  });

  // 3. Sibling split summary
  const structureResult = computeFamilyStructureScore(selected.nights, input);
  artifacts.push({
    type: 'sibling_split_summary',
    data: {
      splitNights: structureResult.splitNights,
      totalSiblingOpportunities: structureResult.totalSiblingOpportunities,
      cohesionScore: structureResult.score,
    },
  });

  // 4. Fairness summary
  const nightCountsByParent: Record<string, number> = {};
  const weekendCountsByParent: Record<string, number> = {};
  const weekendDates = new Set(input.days.filter(d => d.isWeekend).map(d => d.date));

  for (const parentId of input.parentIds) {
    nightCountsByParent[parentId] = 0;
    weekendCountsByParent[parentId] = 0;
  }
  for (const n of selected.nights) {
    nightCountsByParent[n.parentId] = (nightCountsByParent[n.parentId] ?? 0) + 1;
    if (weekendDates.has(n.date)) {
      weekendCountsByParent[n.parentId] = (weekendCountsByParent[n.parentId] ?? 0) + 1;
    }
  }

  artifacts.push({
    type: 'fairness_summary',
    data: {
      nightCountsByParent,
      weekendCountsByParent,
      fairnessBreakdown: selected.score.breakdown.fairness,
    },
  });

  // 5. Policy penalty summary
  artifacts.push({
    type: 'policy_penalty_summary',
    data: {
      isFeasible: selected.policyEvaluation.isFeasible,
      hardViolationCount: selected.policyEvaluation.hardViolations.length,
      strongViolationCount: selected.policyEvaluation.strongViolations.length,
      softViolationCount: selected.policyEvaluation.softViolations.length,
      penaltyCount: selected.policyEvaluation.penalties.length,
      guidanceCount: selected.policyEvaluation.guidance.length,
      totalPenaltyScore: selected.score.breakdown.penalties,
    },
  });

  return artifacts;
}
