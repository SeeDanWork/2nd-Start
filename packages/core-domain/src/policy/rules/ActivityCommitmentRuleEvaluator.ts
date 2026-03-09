import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyRuleEvaluator } from '../registry/PolicyRegistry';
import { ActivityCommitmentParameters } from '../types/parameters';
import { PolicyRuleEvaluationInput, PolicyRuleEvaluationOutput, PolicyViolation, PolicyImpactRecord } from '../types/evaluation';
import { validateActivityCommitmentParameters } from '../types/schemas';

export class ActivityCommitmentRuleEvaluator implements PolicyRuleEvaluator<ActivityCommitmentParameters> {
  supports(ruleType: PolicyRuleType): boolean {
    return ruleType === PolicyRuleType.ACTIVITY_COMMITMENT;
  }

  validateParameters(input: unknown): ActivityCommitmentParameters {
    return validateActivityCommitmentParameters(input);
  }

  evaluate(input: PolicyRuleEvaluationInput<ActivityCommitmentParameters>): PolicyRuleEvaluationOutput {
    const { rule, schedule } = input;
    const params = rule.parameters;
    const violations: PolicyViolation[] = [];
    const impacts: PolicyImpactRecord[] = [];

    if (!params.fixedDates || params.fixedDates.length === 0 || !params.preferredResponsibleParentId) {
      return { violations: [], penalties: [], guidance: [], impacts: [] };
    }

    // Build night lookup: date -> childId -> parentId
    const nightLookup = new Map<string, Map<string, string>>();
    for (const night of schedule.nights) {
      if (!nightLookup.has(night.date)) {
        nightLookup.set(night.date, new Map());
      }
      nightLookup.get(night.date)!.set(night.childId, night.parentId);
    }

    const sortedDates = [...params.fixedDates].sort();

    for (const date of sortedDates) {
      const dateAssignments = nightLookup.get(date);
      if (!dateAssignments) continue;

      // Check if any child on this date is not with the preferred responsible parent
      for (const [childId, parentId] of [...dateAssignments.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (parentId !== params.preferredResponsibleParentId) {
          const v: PolicyViolation = {
            ruleId: rule.id,
            ruleType: rule.ruleType,
            priority: rule.priority,
            childId,
            date,
            code: 'ACTIVITY_PARENT_MISMATCH',
            message: `Activity "${params.activityLabel}" on ${date}: child ${childId} is with wrong parent`,
            data: { activityLabel: params.activityLabel, expectedParentId: params.preferredResponsibleParentId, actualParentId: parentId },
          };
          violations.push(v);
          impacts.push({
            ruleId: rule.id, ruleType: rule.ruleType, priority: rule.priority,
            impactType: 'VIOLATION', childId, date, message: v.message, data: v.data,
          });
        }
      }
    }

    return { violations, penalties: [], guidance: [], impacts };
  }
}
