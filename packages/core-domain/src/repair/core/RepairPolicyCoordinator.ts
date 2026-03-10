import { PolicyRegistry } from '../../policy/registry/PolicyRegistry';
import { evaluatePolicies } from '../../policy/evaluation/PolicyEvaluationEngine';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';
import {
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  ScheduleSnapshotLike,
} from '../../policy/types/evaluation';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { NormalizedRepairInput } from '../types';

export interface RepairPolicyResult {
  evaluation: PolicyEvaluationResult;
  isFeasible: boolean;
  penaltyScore: number;
}

/**
 * Evaluates a repaired schedule against active policies.
 */
export function evaluateRepairPolicies(
  repairedSchedule: ScheduleSnapshot,
  input: NormalizedRepairInput,
  registry: PolicyRegistry,
): RepairPolicyResult {
  const snapshot: ScheduleSnapshotLike = {
    familyId: input.familyId,
    startDate: input.repairWindow.startDate,
    endDate: input.repairWindow.endDate,
    nights: repairedSchedule.nights
      .filter(n => n.date >= input.repairWindow.startDate && n.date <= input.repairWindow.endDate)
      .map(n => ({
        date: n.date,
        childId: n.childId,
        parentId: n.parentId,
      })),
    exchanges: repairedSchedule.exchanges
      .filter(e => e.date >= input.repairWindow.startDate && e.date <= input.repairWindow.endDate)
      .map(e => ({
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
    scheduleStartDate: input.repairWindow.startDate,
    scheduleEndDate: input.repairWindow.endDate,
  };

  const evaluation = evaluatePolicies(
    input.activePolicies as TypedPolicyRule[],
    snapshot,
    context,
    registry,
  );

  let penaltyScore = 0;
  penaltyScore += evaluation.strongViolations.length * 10;
  penaltyScore += evaluation.softViolations.length * 3;
  for (const p of evaluation.penalties) {
    penaltyScore += Math.abs(p.scoreImpact);
  }

  return { evaluation, isFeasible: evaluation.isFeasible, penaltyScore };
}
