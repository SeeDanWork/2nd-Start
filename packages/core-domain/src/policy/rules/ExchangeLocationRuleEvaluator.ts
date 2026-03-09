import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyRuleEvaluator } from '../registry/PolicyRegistry';
import { ExchangeLocationParameters } from '../types/parameters';
import { PolicyRuleEvaluationInput, PolicyRuleEvaluationOutput, PolicyViolation, PolicyPenalty, PolicyImpactRecord } from '../types/evaluation';
import { validateExchangeLocationParameters } from '../types/schemas';

export class ExchangeLocationRuleEvaluator implements PolicyRuleEvaluator<ExchangeLocationParameters> {
  supports(ruleType: PolicyRuleType): boolean {
    return ruleType === PolicyRuleType.EXCHANGE_LOCATION;
  }

  validateParameters(input: unknown): ExchangeLocationParameters {
    return validateExchangeLocationParameters(input);
  }

  evaluate(input: PolicyRuleEvaluationInput<ExchangeLocationParameters>): PolicyRuleEvaluationOutput {
    const { rule, schedule } = input;
    const params = rule.parameters;
    const violations: PolicyViolation[] = [];
    const penalties: PolicyPenalty[] = [];
    const impacts: PolicyImpactRecord[] = [];

    const allowedSet = params.allowedLocations
      ? new Set(params.allowedLocations.map(l => l.toLowerCase()))
      : null;

    const sortedExchanges = [...schedule.exchanges].sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : a.childId.localeCompare(b.childId);
    });

    for (const exchange of sortedExchanges) {
      const loc = exchange.location.toLowerCase();
      const preferred = params.preferredLocation.toLowerCase();

      if (allowedSet && !allowedSet.has(loc)) {
        // Location not in allowed list — violation
        const v: PolicyViolation = {
          ruleId: rule.id,
          ruleType: rule.ruleType,
          priority: rule.priority,
          childId: exchange.childId,
          date: exchange.date,
          code: 'DISALLOWED_LOCATION',
          message: `Exchange on ${exchange.date} uses disallowed location "${exchange.location}"`,
          data: { location: exchange.location, allowedLocations: params.allowedLocations },
        };
        violations.push(v);
        impacts.push({
          ruleId: rule.id, ruleType: rule.ruleType, priority: rule.priority,
          impactType: 'VIOLATION', childId: exchange.childId, date: exchange.date,
          message: v.message, data: v.data,
        });
      } else if (loc !== preferred) {
        // Location allowed but not preferred — penalty
        const p: PolicyPenalty = {
          ruleId: rule.id,
          ruleType: rule.ruleType,
          priority: rule.priority,
          scoreImpact: -5,
          message: `Exchange on ${exchange.date} uses "${exchange.location}" instead of preferred "${params.preferredLocation}"`,
          data: { location: exchange.location, preferredLocation: params.preferredLocation },
        };
        penalties.push(p);
        impacts.push({
          ruleId: rule.id, ruleType: rule.ruleType, priority: rule.priority,
          impactType: 'PENALTY', childId: exchange.childId, date: exchange.date,
          message: p.message, data: p.data,
        });
      }
    }

    return { violations, penalties, guidance: [], impacts };
  }
}
