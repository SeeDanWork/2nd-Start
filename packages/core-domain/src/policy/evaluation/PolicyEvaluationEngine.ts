import { PolicyPriority } from '../../enums/PolicyPriority';
import { PolicyRegistry } from '../registry/PolicyRegistry';
import { TypedPolicyRule } from '../types/TypedPolicyRule';
import {
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  PolicyRuleEvaluationInput,
  ScheduleSnapshotLike,
  PolicyViolation,
  PolicyPenalty,
  PolicyGuidance,
  PolicyImpactRecord,
} from '../types/evaluation';
import { isPolicyApplicable } from '../applicability/PolicyApplicability';
import { PolicyEvaluationError } from '../errors';

/**
 * Evaluates all applicable policy rules against a schedule snapshot.
 * Aggregates results by priority tier, produces deterministic output.
 */
export function evaluatePolicies(
  rules: TypedPolicyRule[],
  schedule: ScheduleSnapshotLike,
  context: PolicyEvaluationContext,
  registry: PolicyRegistry,
): PolicyEvaluationResult {
  const hardViolations: PolicyViolation[] = [];
  const strongViolations: PolicyViolation[] = [];
  const softViolations: PolicyViolation[] = [];
  const allPenalties: PolicyPenalty[] = [];
  const allGuidance: PolicyGuidance[] = [];
  const allImpacts: PolicyImpactRecord[] = [];

  // Sort rules deterministically: by priority (HARD first), then ruleType, then id
  const priorityOrder: Record<string, number> = { HARD: 0, STRONG: 1, SOFT: 2 };
  const sortedRules = [...rules].sort((a, b) => {
    const po = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
    if (po !== 0) return po;
    const rt = a.ruleType.localeCompare(b.ruleType);
    if (rt !== 0) return rt;
    return a.id.localeCompare(b.id);
  });

  for (const rule of sortedRules) {
    if (!isPolicyApplicable(rule, context)) continue;
    if (!registry.hasEvaluator(rule.ruleType)) continue;

    const evaluator = registry.resolve(rule.ruleType);

    let output;
    try {
      const input: PolicyRuleEvaluationInput = { rule, context, schedule };
      output = evaluator.evaluate(input);
    } catch (err) {
      throw new PolicyEvaluationError(
        `Rule ${rule.id} (${rule.ruleType}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Bucket violations by priority
    for (const v of output.violations) {
      switch (rule.priority) {
        case PolicyPriority.HARD:
          hardViolations.push(v);
          break;
        case PolicyPriority.STRONG:
          strongViolations.push(v);
          break;
        case PolicyPriority.SOFT:
          softViolations.push(v);
          break;
      }
    }

    allPenalties.push(...output.penalties);
    allGuidance.push(...output.guidance);
    allImpacts.push(...output.impacts);
  }

  return {
    isFeasible: hardViolations.length === 0,
    hardViolations,
    strongViolations,
    softViolations,
    penalties: allPenalties,
    guidance: allGuidance,
    impacts: allImpacts,
  };
}
