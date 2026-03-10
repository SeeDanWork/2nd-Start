import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { PolicyScopeType } from '../types/PolicyScope';
import { TypedPolicyRule } from '../types/TypedPolicyRule';
import { validateParametersForRuleType } from '../types/schemas';
import { InvalidPolicyParametersError, InvalidPolicyScopeError } from '../errors';

const VALID_SCOPE_TYPES: Set<string> = new Set(['FAMILY', 'CHILD', 'DATE_RANGE', 'CHILD_DATE_RANGE']);
const VALID_PRIORITIES: Set<string> = new Set([PolicyPriority.HARD, PolicyPriority.STRONG, PolicyPriority.SOFT]);
const VALID_RULE_TYPES: Set<string> = new Set(Object.values(PolicyRuleType));

/**
 * Validates a policy rule definition: checks ruleType, priority, scope consistency, and parameters.
 * Returns the validated parameters (coerced to correct types).
 * Throws on validation failure.
 */
export function validateRuleDefinition(rule: TypedPolicyRule): void {
  // Validate ruleType
  if (!VALID_RULE_TYPES.has(rule.ruleType)) {
    throw new InvalidPolicyParametersError(`Unknown rule type: ${rule.ruleType}`);
  }

  // Validate priority
  if (!VALID_PRIORITIES.has(rule.priority)) {
    throw new InvalidPolicyParametersError(`Unknown priority: ${rule.priority}`);
  }

  // Validate scope
  validateScope(rule);

  // Validate parameters
  validateRuleParameters(rule.ruleType, rule.parameters);
}

/**
 * Validates that a rule's scope is internally consistent.
 */
function validateScope(rule: TypedPolicyRule): void {
  const scope = rule.scope;

  if (!VALID_SCOPE_TYPES.has(scope.scopeType)) {
    throw new InvalidPolicyScopeError(`Unknown scope type: ${scope.scopeType}`);
  }

  if (scope.scopeType === 'CHILD' || scope.scopeType === 'CHILD_DATE_RANGE') {
    if (!scope.childId || scope.childId.trim().length === 0) {
      throw new InvalidPolicyScopeError(`Scope type '${scope.scopeType}' requires a childId`);
    }
  }

  if (scope.scopeType === 'DATE_RANGE' || scope.scopeType === 'CHILD_DATE_RANGE') {
    if (!scope.dateStart || !scope.dateEnd) {
      throw new InvalidPolicyScopeError(`Scope type '${scope.scopeType}' requires dateStart and dateEnd`);
    }
    if (scope.dateStart > scope.dateEnd) {
      throw new InvalidPolicyScopeError('dateStart must be <= dateEnd');
    }
  }
}

/**
 * Validates parameters for a given rule type. Returns the validated parameters.
 */
export function validateRuleParameters(ruleType: PolicyRuleType, params: unknown): unknown {
  return validateParametersForRuleType(ruleType, params);
}
