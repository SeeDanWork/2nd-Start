import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyRuleEvaluator } from '../registry/PolicyRegistry';
import { MinBlockLengthParameters } from '../types/parameters';
import { PolicyRuleEvaluationInput, PolicyRuleEvaluationOutput, PolicyViolation, PolicyImpactRecord } from '../types/evaluation';
import { validateMinBlockLengthParameters } from '../types/schemas';

export class MinBlockLengthRuleEvaluator implements PolicyRuleEvaluator<MinBlockLengthParameters> {
  supports(ruleType: PolicyRuleType): boolean {
    return ruleType === PolicyRuleType.MIN_BLOCK_LENGTH;
  }

  validateParameters(input: unknown): MinBlockLengthParameters {
    return validateMinBlockLengthParameters(input);
  }

  evaluate(input: PolicyRuleEvaluationInput<MinBlockLengthParameters>): PolicyRuleEvaluationOutput {
    const { rule, schedule } = input;
    const minNights = rule.parameters.nights;
    const violations: PolicyViolation[] = [];
    const impacts: PolicyImpactRecord[] = [];

    // Group nights by child, sorted by date
    const childNights = new Map<string, { date: string; parentId: string }[]>();
    for (const night of schedule.nights) {
      if (!childNights.has(night.childId)) {
        childNights.set(night.childId, []);
      }
      childNights.get(night.childId)!.push({ date: night.date, parentId: night.parentId });
    }

    const sortedChildIds = [...childNights.keys()].sort();

    for (const childId of sortedChildIds) {
      const nights = childNights.get(childId)!;
      nights.sort((a, b) => a.date.localeCompare(b.date));

      if (nights.length === 0) continue;

      let blockStart = 0;
      for (let i = 1; i <= nights.length; i++) {
        const isEnd = i === nights.length || nights[i].parentId !== nights[blockStart].parentId;
        if (isEnd) {
          const blockLength = i - blockStart;
          if (blockLength < minNights) {
            const v: PolicyViolation = {
              ruleId: rule.id,
              ruleType: rule.ruleType,
              priority: rule.priority,
              childId,
              date: nights[blockStart].date,
              code: 'SHORT_BLOCK',
              message: `Block of ${blockLength} night(s) starting ${nights[blockStart].date} for child ${childId} is below minimum ${minNights}`,
              data: { blockLength, minNights, startDate: nights[blockStart].date, endDate: nights[i - 1].date },
            };
            violations.push(v);
            impacts.push({
              ruleId: rule.id, ruleType: rule.ruleType, priority: rule.priority,
              impactType: 'VIOLATION', childId, date: nights[blockStart].date,
              message: v.message, data: v.data,
            });
          }
          blockStart = i;
        }
      }
    }

    return { violations, penalties: [], guidance: [], impacts };
  }
}
