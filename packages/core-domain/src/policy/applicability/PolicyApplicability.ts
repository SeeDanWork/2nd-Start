import { TypedPolicyRule } from '../types/TypedPolicyRule';
import { PolicyEvaluationContext } from '../types/evaluation';

/**
 * Checks whether a policy rule is applicable given the evaluation context.
 * Filters by: active status, family match, and scope (child/date range).
 */
export function isPolicyApplicable(
  rule: TypedPolicyRule,
  context: PolicyEvaluationContext,
): boolean {
  if (!rule.active) return false;
  if (rule.familyId !== context.familyId) return false;

  const scope = rule.scope;

  switch (scope.scopeType) {
    case 'FAMILY':
      return true;

    case 'CHILD':
      // Child-scoped rules are always applicable at the schedule level;
      // the evaluator itself filters by childId.
      return true;

    case 'DATE_RANGE':
      return doesScopeOverlapSchedule(scope.dateStart, scope.dateEnd, context);

    case 'CHILD_DATE_RANGE':
      return doesScopeOverlapSchedule(scope.dateStart, scope.dateEnd, context);

    default:
      return false;
  }
}

/**
 * Checks whether a rule's date-range scope overlaps the schedule window.
 */
function doesScopeOverlapSchedule(
  scopeStart: string | undefined,
  scopeEnd: string | undefined,
  context: PolicyEvaluationContext,
): boolean {
  if (!scopeStart || !scopeEnd) return true; // missing bounds = always applicable
  // Overlap: scopeStart <= scheduleEnd AND scopeEnd >= scheduleStart
  return scopeStart <= context.scheduleEndDate && scopeEnd >= context.scheduleStartDate;
}

/**
 * Checks whether a specific date falls within a rule's date scope.
 */
export function doesPolicyScopeMatchDate(rule: TypedPolicyRule, date: string): boolean {
  const scope = rule.scope;
  if (scope.scopeType === 'FAMILY' || scope.scopeType === 'CHILD') return true;
  if (!scope.dateStart || !scope.dateEnd) return true;
  return date >= scope.dateStart && date <= scope.dateEnd;
}

/**
 * Checks whether a child falls within a rule's child scope.
 */
export function doesPolicyScopeMatchChild(rule: TypedPolicyRule, childId: string): boolean {
  const scope = rule.scope;
  if (scope.scopeType === 'FAMILY' || scope.scopeType === 'DATE_RANGE') return true;
  if (!scope.childId) return true;
  return scope.childId === childId;
}
