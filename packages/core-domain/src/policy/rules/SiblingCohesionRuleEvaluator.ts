import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyRuleEvaluator } from '../registry/PolicyRegistry';
import { SiblingCohesionParameters } from '../types/parameters';
import { PolicyRuleEvaluationInput, PolicyRuleEvaluationOutput, PolicyViolation, PolicyImpactRecord } from '../types/evaluation';
import { validateSiblingCohesionParameters } from '../types/schemas';

export class SiblingCohesionRuleEvaluator implements PolicyRuleEvaluator<SiblingCohesionParameters> {
  supports(ruleType: PolicyRuleType): boolean {
    return ruleType === PolicyRuleType.SIBLING_COHESION;
  }

  validateParameters(input: unknown): SiblingCohesionParameters {
    return validateSiblingCohesionParameters(input);
  }

  evaluate(input: PolicyRuleEvaluationInput<SiblingCohesionParameters>): PolicyRuleEvaluationOutput {
    const { rule, schedule } = input;
    const params = rule.parameters;
    const violations: PolicyViolation[] = [];
    const impacts: PolicyImpactRecord[] = [];

    // Group nights by date
    const nightsByDate = new Map<string, Map<string, string>>();
    for (const night of schedule.nights) {
      if (!nightsByDate.has(night.date)) {
        nightsByDate.set(night.date, new Map());
      }
      nightsByDate.get(night.date)!.set(night.childId, night.parentId);
    }

    // Find dates where children are with different parents (split nights)
    let splitNightCount = 0;
    const sortedDates = [...nightsByDate.keys()].sort();

    for (const date of sortedDates) {
      const childAssignments = nightsByDate.get(date)!;
      const parentIds = new Set(childAssignments.values());

      if (parentIds.size > 1) {
        splitNightCount++;
        const childIds = [...childAssignments.keys()].sort();

        if (!params.allowDivergence) {
          const v: PolicyViolation = {
            ruleId: rule.id,
            ruleType: rule.ruleType,
            priority: rule.priority,
            date,
            code: 'SIBLING_SPLIT',
            message: `Siblings are split on ${date}`,
            data: { childAssignments: Object.fromEntries(childAssignments) },
          };
          violations.push(v);
          impacts.push({
            ruleId: rule.id, ruleType: rule.ruleType, priority: rule.priority,
            impactType: 'VIOLATION', date, message: v.message, data: v.data,
          });
        } else if (params.maxSplitNights !== undefined && splitNightCount > params.maxSplitNights) {
          const v: PolicyViolation = {
            ruleId: rule.id,
            ruleType: rule.ruleType,
            priority: rule.priority,
            date,
            code: 'SIBLING_SPLIT_EXCEEDED',
            message: `Split night count ${splitNightCount} exceeds max ${params.maxSplitNights} on ${date}`,
            data: { splitNightCount, maxSplitNights: params.maxSplitNights },
          };
          violations.push(v);
          impacts.push({
            ruleId: rule.id, ruleType: rule.ruleType, priority: rule.priority,
            impactType: 'VIOLATION', date, message: v.message, data: v.data,
          });
        }
      }
    }

    return { violations, penalties: [], guidance: [], impacts };
  }
}
