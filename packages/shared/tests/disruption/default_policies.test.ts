import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POLICIES,
  getDefaultPolicy,
  resolveIllnessAction,
} from '../../src/disruption/default_policies';
import {
  DisruptionEventType,
  OverlayActionType,
  OverrideStrength,
} from '../../src/enums';

describe('DEFAULT_POLICIES', () => {
  it('covers all 13 event types', () => {
    const allTypes = Object.values(DisruptionEventType);
    expect(allTypes).toHaveLength(13);

    for (const type of allTypes) {
      const policy = DEFAULT_POLICIES.find((p) => p.eventType === type);
      expect(policy, `Missing policy for ${type}`).toBeDefined();
    }
  });

  it('each policy has a valid actionType', () => {
    const validActions = Object.values(OverlayActionType);
    for (const policy of DEFAULT_POLICIES) {
      expect(validActions).toContain(policy.actionType);
    }
  });

  it('each policy has a valid defaultStrength', () => {
    const validStrengths = Object.values(OverrideStrength);
    for (const policy of DEFAULT_POLICIES) {
      expect(validStrengths).toContain(policy.defaultStrength);
    }
  });
});

describe('getDefaultPolicy', () => {
  it('returns correct policy for PUBLIC_HOLIDAY', () => {
    const policy = getDefaultPolicy(DisruptionEventType.PUBLIC_HOLIDAY);
    expect(policy.actionType).toBe(OverlayActionType.LOGISTICS_FALLBACK);
    expect(policy.defaultStrength).toBe(OverrideStrength.LOGISTICS_ONLY);
  });

  it('returns correct policy for CHILD_SICK', () => {
    const policy = getDefaultPolicy(DisruptionEventType.CHILD_SICK);
    expect(policy.actionType).toBe(OverlayActionType.DELAY_EXCHANGE);
    expect(policy.fairnessAccounting.createCompensatory).toBe(true);
  });

  it('returns correct policy for PARENT_TRAVEL', () => {
    const policy = getDefaultPolicy(DisruptionEventType.PARENT_TRAVEL);
    expect(policy.actionType).toBe(OverlayActionType.BLOCK_ASSIGNMENT);
    expect(policy.defaultStrength).toBe(OverrideStrength.HARD);
  });

  it('returns correct policy for SUMMER_PERIOD', () => {
    const policy = getDefaultPolicy(DisruptionEventType.SUMMER_PERIOD);
    expect(policy.actionType).toBe(OverlayActionType.GENERATE_PROPOSALS);
  });

  it('returns NO_OVERRIDE fallback for unknown event type', () => {
    const policy = getDefaultPolicy('unknown_type' as DisruptionEventType);
    expect(policy.actionType).toBe(OverlayActionType.NO_OVERRIDE);
    expect(policy.defaultStrength).toBe(OverrideStrength.NONE);
  });

  it('is deterministic — same input always same output', () => {
    const p1 = getDefaultPolicy(DisruptionEventType.SCHOOL_CLOSED);
    const p2 = getDefaultPolicy(DisruptionEventType.SCHOOL_CLOSED);
    expect(p1).toEqual(p2);
  });
});

describe('resolveIllnessAction', () => {
  it('short illness (≤72h), not exchange day → NO_OVERRIDE', () => {
    expect(resolveIllnessAction(48, false)).toBe(OverlayActionType.NO_OVERRIDE);
  });

  it('short illness (≤72h), exchange day → DELAY_EXCHANGE', () => {
    expect(resolveIllnessAction(48, true)).toBe(OverlayActionType.DELAY_EXCHANGE);
  });

  it('short illness at boundary (72h), exchange day → DELAY_EXCHANGE', () => {
    expect(resolveIllnessAction(72, true)).toBe(OverlayActionType.DELAY_EXCHANGE);
  });

  it('long illness (>72h) → GENERATE_PROPOSALS', () => {
    expect(resolveIllnessAction(96, false)).toBe(OverlayActionType.GENERATE_PROPOSALS);
  });

  it('long illness (>72h), exchange day → GENERATE_PROPOSALS', () => {
    expect(resolveIllnessAction(96, true)).toBe(OverlayActionType.GENERATE_PROPOSALS);
  });
});
