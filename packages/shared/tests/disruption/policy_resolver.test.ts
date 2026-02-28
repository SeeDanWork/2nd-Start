import { describe, it, expect } from 'vitest';
import { resolvePolicy, safeFallback } from '../../src/disruption/policy_resolver';
import type { OverlayPolicy } from '../../src/disruption/types';
import {
  DisruptionEventType,
  OverlayActionType,
  OverrideStrength,
  PolicySource,
} from '../../src/enums';

function makePolicy(overrides: Partial<OverlayPolicy>): OverlayPolicy {
  return {
    id: 'policy-1',
    familyId: 'family-1',
    appliesToEventType: DisruptionEventType.CHILD_SICK,
    actionType: OverlayActionType.DELAY_EXCHANGE,
    defaultStrength: OverrideStrength.SOFT,
    promptingRules: { leadTimeHours: 24, suppressPrompt: false, maxAutoApply: 0 },
    fairnessAccounting: { countsTowardFairness: true, createCompensatory: false, maxCompensatoryDays: 0 },
    source: PolicySource.FAMILY_SPECIFIC,
    isActive: true,
    ...overrides,
  };
}

describe('resolvePolicy', () => {
  it('returns family-specific over learned over global', () => {
    const policies = [
      makePolicy({ id: 'learned', source: PolicySource.LEARNED_POLICY, actionType: OverlayActionType.NO_OVERRIDE }),
      makePolicy({ id: 'family', source: PolicySource.FAMILY_SPECIFIC, actionType: OverlayActionType.BLOCK_ASSIGNMENT }),
    ];
    const result = resolvePolicy(DisruptionEventType.CHILD_SICK, policies);
    expect(result.source).toBe(PolicySource.FAMILY_SPECIFIC);
    expect(result.actionType).toBe(OverlayActionType.BLOCK_ASSIGNMENT);
    expect(result.policyId).toBe('family');
  });

  it('returns learned when no family-specific exists', () => {
    const policies = [
      makePolicy({ id: 'learned', source: PolicySource.LEARNED_POLICY, actionType: OverlayActionType.LOGISTICS_FALLBACK }),
    ];
    const result = resolvePolicy(DisruptionEventType.CHILD_SICK, policies);
    expect(result.source).toBe(PolicySource.LEARNED_POLICY);
    expect(result.actionType).toBe(OverlayActionType.LOGISTICS_FALLBACK);
  });

  it('falls back to global default when no family/learned policies', () => {
    const result = resolvePolicy(DisruptionEventType.PUBLIC_HOLIDAY, []);
    expect(result.source).toBe(PolicySource.GLOBAL_DEFAULT);
    expect(result.actionType).toBe(OverlayActionType.LOGISTICS_FALLBACK);
    expect(result.policyId).toBeNull();
  });

  it('ignores inactive policies', () => {
    const policies = [
      makePolicy({ id: 'inactive', source: PolicySource.FAMILY_SPECIFIC, isActive: false }),
    ];
    const result = resolvePolicy(DisruptionEventType.CHILD_SICK, policies);
    // Falls through to global default
    expect(result.source).toBe(PolicySource.GLOBAL_DEFAULT);
  });

  it('ignores policies for different event types', () => {
    const policies = [
      makePolicy({
        id: 'wrong-type',
        source: PolicySource.FAMILY_SPECIFIC,
        appliesToEventType: DisruptionEventType.PARENT_TRAVEL,
      }),
    ];
    const result = resolvePolicy(DisruptionEventType.CHILD_SICK, policies);
    expect(result.source).toBe(PolicySource.GLOBAL_DEFAULT);
  });
});

describe('safeFallback', () => {
  it('always returns NO_OVERRIDE', () => {
    const fb = safeFallback();
    expect(fb.actionType).toBe(OverlayActionType.NO_OVERRIDE);
    expect(fb.strength).toBe(OverrideStrength.NONE);
    expect(fb.source).toBe(PolicySource.GLOBAL_DEFAULT);
    expect(fb.policyId).toBeNull();
  });

  it('returns new object each time', () => {
    const a = safeFallback();
    const b = safeFallback();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
