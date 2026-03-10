import { RepairCandidate, RepairArtifact, NormalizedRepairInput, FairnessDriftSummary } from '../types';
import { computeRepairStabilityScore } from '../objectives/StabilityRepairObjective';
import { computeRepairFamilyStructureScore } from '../objectives/FamilyStructureRepairObjective';

/**
 * Builds structured repair artifacts from the selected candidate.
 */
export function buildRepairArtifacts(
  candidates: RepairCandidate[],
  input: NormalizedRepairInput,
  driftSummary: FairnessDriftSummary,
): RepairArtifact[] {
  const artifacts: RepairArtifact[] = [];

  if (candidates.length === 0) return artifacts;

  const selected = candidates[0];

  // 1. Overlay impact summary
  artifacts.push({
    type: 'overlay_impact_summary',
    data: {
      overlayCount: input.overlayImpacts.length,
      impacts: input.overlayImpacts.map(i => ({
        overlayId: i.overlayId,
        childId: i.childId,
        date: i.date,
        fromParentId: i.fromParentId,
        toParentId: i.toParentId,
        type: i.type,
      })),
    },
  });

  // 2. Drift summary
  artifacts.push({
    type: 'drift_summary',
    data: {
      originalDrift: driftSummary.byParentId,
      residualDrift: selected.fairnessDrift.byParentId,
    },
  });

  // 3. Changed-night summary
  const stabilityResult = computeRepairStabilityScore(selected.repairedSchedule, input);
  artifacts.push({
    type: 'changed_night_summary',
    data: {
      changedNights: stabilityResult.changedNights,
      overlayChanges: stabilityResult.overlayChanges,
      additionalChanges: stabilityResult.changedNights - stabilityResult.overlayChanges,
      changedExchanges: stabilityResult.changedExchanges,
    },
  });

  // 4. Restitution summary
  artifacts.push({
    type: 'restitution_summary',
    data: {
      restitutionNightCount: selected.score.breakdown.restitutionNightCount,
      restitutionScore: selected.score.breakdown.fairnessRestitution,
    },
  });

  // 5. Calmness summary
  artifacts.push({
    type: 'calmness_summary',
    data: {
      calmnessScore: selected.score.breakdown.nearTermCalmness,
    },
  });

  // 6. Policy penalty summary
  artifacts.push({
    type: 'policy_penalty_summary',
    data: {
      isFeasible: selected.policyEvaluation.isFeasible,
      hardViolationCount: selected.policyEvaluation.hardViolations.length,
      strongViolationCount: selected.policyEvaluation.strongViolations.length,
      softViolationCount: selected.policyEvaluation.softViolations.length,
      totalPenaltyScore: selected.score.breakdown.penalties,
    },
  });

  return artifacts;
}
