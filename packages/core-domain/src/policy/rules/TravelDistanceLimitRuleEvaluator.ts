import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyRuleEvaluator } from '../registry/PolicyRegistry';
import { TravelDistanceLimitParameters } from '../types/parameters';
import { PolicyRuleEvaluationInput, PolicyRuleEvaluationOutput, PolicyGuidance, PolicyImpactRecord } from '../types/evaluation';
import { validateTravelDistanceLimitParameters } from '../types/schemas';

export class TravelDistanceLimitRuleEvaluator implements PolicyRuleEvaluator<TravelDistanceLimitParameters> {
  supports(ruleType: PolicyRuleType): boolean {
    return ruleType === PolicyRuleType.TRAVEL_DISTANCE_LIMIT;
  }

  validateParameters(input: unknown): TravelDistanceLimitParameters {
    return validateTravelDistanceLimitParameters(input);
  }

  evaluate(input: PolicyRuleEvaluationInput<TravelDistanceLimitParameters>): PolicyRuleEvaluationOutput {
    const { rule, schedule } = input;
    const guidance: PolicyGuidance[] = [];
    const impacts: PolicyImpactRecord[] = [];

    // Travel distance requires external data (geocoding/routing).
    // Without structured travel metadata on exchanges, emit guidance.
    if (schedule.exchanges.length > 0) {
      const g: PolicyGuidance = {
        ruleId: rule.id,
        ruleType: rule.ruleType,
        message: `Travel distance limit of ${rule.parameters.maxMinutes} minutes configured. ${schedule.exchanges.length} exchange(s) present but travel duration data not available for verification.`,
        data: { maxMinutes: rule.parameters.maxMinutes, exchangeCount: schedule.exchanges.length },
      };
      guidance.push(g);
      impacts.push({
        ruleId: rule.id, ruleType: rule.ruleType, priority: rule.priority,
        impactType: 'GUIDANCE', message: g.message, data: g.data,
      });
    }

    return { violations: [], penalties: [], guidance, impacts };
  }
}
