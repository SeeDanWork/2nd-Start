import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { BasePolicyParameters } from '../types/BasePolicyParameters';
import { PolicyRuleEvaluationInput, PolicyRuleEvaluationOutput } from '../types/evaluation';
import { UnsupportedPolicyRuleTypeError } from '../errors';

export interface PolicyRuleEvaluator<TParams extends BasePolicyParameters = BasePolicyParameters> {
  supports(ruleType: PolicyRuleType): boolean;
  validateParameters(input: unknown): TParams;
  evaluate(input: PolicyRuleEvaluationInput<TParams>): PolicyRuleEvaluationOutput;
}

export class PolicyRegistry {
  private evaluators: Map<PolicyRuleType, PolicyRuleEvaluator> = new Map();

  register(ruleType: PolicyRuleType, evaluator: PolicyRuleEvaluator): void {
    this.evaluators.set(ruleType, evaluator);
  }

  resolve(ruleType: PolicyRuleType): PolicyRuleEvaluator {
    const evaluator = this.evaluators.get(ruleType);
    if (!evaluator) {
      throw new UnsupportedPolicyRuleTypeError(ruleType);
    }
    return evaluator;
  }

  hasEvaluator(ruleType: PolicyRuleType): boolean {
    return this.evaluators.has(ruleType);
  }

  supportedTypes(): PolicyRuleType[] {
    return [...this.evaluators.keys()].sort();
  }
}
