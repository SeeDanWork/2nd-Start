import { describe, it, expect } from 'vitest';
import {
  evaluateForPromotion,
  buildLearnedPolicy,
} from '../../src/disruption/policy_learning';
import type { PolicyDecisionRecord } from '../../src/disruption/types';
import {
  DisruptionEventType,
  OverlayActionType,
  PolicySource,
} from '../../src/enums';

function makeRecord(overrides: Partial<PolicyDecisionRecord> = {}): PolicyDecisionRecord {
  return {
    id: `rec-${Math.random().toString(36).slice(2, 8)}`,
    familyId: 'fam-1',
    disruptionEventId: 'evt-1',
    policyId: 'pol-1',
    actionTaken: OverlayActionType.DELAY_EXCHANGE,
    accepted: true,
    decidedBy: 'user-1',
    metadata: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('evaluateForPromotion', () => {
  it('not eligible with 0 records', () => {
    const result = evaluateForPromotion(DisruptionEventType.CHILD_SICK, []);
    expect(result.eligible).toBe(false);
    expect(result.consecutiveAcceptances).toBe(0);
  });

  it('not eligible with 1 accepted record', () => {
    const records = [makeRecord()];
    const result = evaluateForPromotion(DisruptionEventType.CHILD_SICK, records);
    expect(result.eligible).toBe(false);
    expect(result.consecutiveAcceptances).toBe(1);
  });

  it('eligible with 2 consecutive same-action acceptances', () => {
    const records = [
      makeRecord({ actionTaken: OverlayActionType.DELAY_EXCHANGE }),
      makeRecord({ actionTaken: OverlayActionType.DELAY_EXCHANGE }),
    ];
    const result = evaluateForPromotion(DisruptionEventType.CHILD_SICK, records);
    expect(result.eligible).toBe(true);
    expect(result.actionType).toBe(OverlayActionType.DELAY_EXCHANGE);
    expect(result.consecutiveAcceptances).toBe(2);
  });

  it('not eligible with mixed actions', () => {
    const records = [
      makeRecord({ actionTaken: OverlayActionType.DELAY_EXCHANGE }),
      makeRecord({ actionTaken: OverlayActionType.BLOCK_ASSIGNMENT }),
    ];
    const result = evaluateForPromotion(DisruptionEventType.CHILD_SICK, records);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Mixed');
  });

  it('ignores declined decisions', () => {
    const records = [
      makeRecord({ accepted: false }),
      makeRecord({ accepted: true }),
    ];
    const result = evaluateForPromotion(DisruptionEventType.CHILD_SICK, records);
    expect(result.eligible).toBe(false);
    expect(result.consecutiveAcceptances).toBe(1);
  });

  it('eligible when last 2 accepted are same, even with earlier decline', () => {
    const records = [
      makeRecord({ accepted: false }),
      makeRecord({ actionTaken: OverlayActionType.LOGISTICS_FALLBACK, accepted: true }),
      makeRecord({ actionTaken: OverlayActionType.LOGISTICS_FALLBACK, accepted: true }),
    ];
    const result = evaluateForPromotion(DisruptionEventType.CHILD_SICK, records);
    expect(result.eligible).toBe(true);
    expect(result.actionType).toBe(OverlayActionType.LOGISTICS_FALLBACK);
  });
});

describe('buildLearnedPolicy', () => {
  it('returns null when not eligible', () => {
    const eligibility = evaluateForPromotion(DisruptionEventType.CHILD_SICK, []);
    const result = buildLearnedPolicy('fam-1', eligibility, []);
    expect(result).toBeNull();
  });

  it('builds learned policy draft when eligible', () => {
    const records = [
      makeRecord({ id: 'r1', actionTaken: OverlayActionType.DELAY_EXCHANGE }),
      makeRecord({ id: 'r2', actionTaken: OverlayActionType.DELAY_EXCHANGE }),
    ];
    const eligibility = evaluateForPromotion(DisruptionEventType.CHILD_SICK, records);
    const draft = buildLearnedPolicy('fam-1', eligibility, records);

    expect(draft).not.toBeNull();
    expect(draft!.familyId).toBe('fam-1');
    expect(draft!.appliesToEventType).toBe(DisruptionEventType.CHILD_SICK);
    expect(draft!.actionType).toBe(OverlayActionType.DELAY_EXCHANGE);
    expect(draft!.source).toBe(PolicySource.LEARNED_POLICY);
    expect(draft!.promptingRules.suppressPrompt).toBe(true);
    expect(draft!.basedOnDecisions).toEqual(['r1', 'r2']);
  });
});
