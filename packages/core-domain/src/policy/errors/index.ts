export class UnsupportedPolicyRuleTypeError extends Error {
  constructor(ruleType: string) {
    super(`Unsupported policy rule type: ${ruleType}`);
    this.name = 'UnsupportedPolicyRuleTypeError';
  }
}

export class InvalidPolicyParametersError extends Error {
  constructor(message: string) {
    super(`Invalid policy parameters: ${message}`);
    this.name = 'InvalidPolicyParametersError';
  }
}

export class InvalidPolicyScopeError extends Error {
  constructor(message: string) {
    super(`Invalid policy scope: ${message}`);
    this.name = 'InvalidPolicyScopeError';
  }
}

export class PolicyEvaluationError extends Error {
  constructor(message: string) {
    super(`Policy evaluation error: ${message}`);
    this.name = 'PolicyEvaluationError';
  }
}

export class PolicyRegistryError extends Error {
  constructor(message: string) {
    super(`Policy registry error: ${message}`);
    this.name = 'PolicyRegistryError';
  }
}
