import { PolicyPriority } from '../../enums/PolicyPriority';
import { PolicyRegistry } from '../../policy/registry/PolicyRegistry';
import { evaluatePolicies } from '../../policy/evaluation/PolicyEvaluationEngine';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';
import {
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  ScheduleSnapshotLike,
} from '../../policy/types/evaluation';
import { CandidateNight, CandidateExchange, NormalizedSolverInput } from '../types';

export interface PolicyCoordinationResult {
  evaluation: PolicyEvaluationResult;
  isFeasible: boolean;
  penaltyScore: number;
}

/**
 * Coordinates policy evaluation for solver candidates.
 *
 * - Converts candidate into ScheduleSnapshotLike
 * - Runs policy evaluation
 * - Rejects candidates with HARD violations
 * - Computes penalty score from STRONG/SOFT violations
 */
export function evaluateCandidatePolicies(
  nights: CandidateNight[],
  exchanges: CandidateExchange[],
  input: NormalizedSolverInput,
  registry: PolicyRegistry,
): PolicyCoordinationResult {
  // Build snapshot-like from candidate
  const snapshot: ScheduleSnapshotLike = {
    familyId: input.familyId,
    startDate: input.window.startDate,
    endDate: input.window.endDate,
    nights: nights.map(n => ({
      date: n.date,
      childId: n.childId,
      parentId: n.parentId,
    })),
    exchanges: exchanges.map(e => ({
      date: e.date,
      childId: e.childId,
      fromParentId: e.fromParentId,
      toParentId: e.toParentId,
      time: e.time ?? '',
      location: e.location ?? '',
    })),
  };

  const context: PolicyEvaluationContext = {
    familyId: input.familyId,
    scheduleStartDate: input.window.startDate,
    scheduleEndDate: input.window.endDate,
  };

  const evaluation = evaluatePolicies(
    input.activePolicies as TypedPolicyRule[],
    snapshot,
    context,
    registry,
  );

  // Compute penalty score from STRONG/SOFT violations and penalties
  let penaltyScore = 0;

  // STRONG violations: -10 per violation
  penaltyScore += evaluation.strongViolations.length * 10;

  // SOFT violations: -3 per violation
  penaltyScore += evaluation.softViolations.length * 3;

  // Policy penalties (already have scoreImpact)
  for (const p of evaluation.penalties) {
    penaltyScore += Math.abs(p.scoreImpact);
  }

  return {
    evaluation,
    isFeasible: evaluation.isFeasible,
    penaltyScore,
  };
}
