import { describe, it, expect } from 'vitest';
import { PolicyExplanationBuilder } from '../builders/PolicyExplanationBuilder';
import { TARGET_ID, CREATED_AT, makePolicyEvaluation, makePolicyViolation } from './helpers';

describe('PolicyExplanationBuilder', () => {
  const builder = new PolicyExplanationBuilder();

  it('explains sibling cohesion policy impact', () => {
    const records = builder.buildPolicyExplanations({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      policyEvaluation: makePolicyEvaluation({
        hardViolations: [
          makePolicyViolation({
            ruleType: 'SIBLING_COHESION' as any,
            date: '2026-03-10',
            childId: 'child-1',
          }),
        ],
      }),
      createdAt: CREATED_AT,
    });

    expect(records.length).toBeGreaterThan(0);
    const sibling = records.find(r => r.code === 'POLICY_SIBLING_COHESION');
    expect(sibling).toBeDefined();
    expect(sibling!.importance).toBe('PRIMARY');
    expect(sibling!.date).toBe('2026-03-10');
  });

  it('explains school-night routine protection', () => {
    const records = builder.buildPolicyExplanations({
      targetType: 'PROPOSAL',
      targetId: TARGET_ID,
      policyEvaluation: makePolicyEvaluation({
        strongViolations: [
          makePolicyViolation({
            ruleType: 'SCHOOL_NIGHT_ROUTINE' as any,
            priority: 'STRONG' as any,
            date: '2026-03-11',
          }),
        ],
      }),
      createdAt: CREATED_AT,
    });

    const school = records.find(r => r.code === 'POLICY_SCHOOL_NIGHT_ROUTINE');
    expect(school).toBeDefined();
    expect(school!.importance).toBe('SECONDARY');
  });

  it('ignores unsupported policy outcomes cleanly', () => {
    const records = builder.buildPolicyExplanations({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      createdAt: CREATED_AT,
    });

    expect(records).toHaveLength(0);
  });

  it('includes penalties as supporting context', () => {
    const records = builder.buildPolicyExplanations({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      policyEvaluation: makePolicyEvaluation({
        penalties: [{
          ruleId: 'rule-002',
          ruleType: 'MIN_BLOCK_LENGTH' as any,
          priority: 'STRONG' as any,
          scoreImpact: -5,
          message: 'Block too short',
        }],
      }),
      createdAt: CREATED_AT,
    });

    const penalty = records.find(r => r.code === 'POLICY_PENALTY');
    expect(penalty).toBeDefined();
    expect(penalty!.importance).toBe('SUPPORTING');
  });
});
