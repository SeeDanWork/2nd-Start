import { describe, it, expect } from 'vitest';
import { checkConsent } from '../../src/interpreter/consent';
import { ApplyMode, type CanonicalChangeRequest, type StabilityBudgetResult } from '../../src/interpreter/types';
import { ParentRole, RequestType } from '../../src/enums';

function makeReq(overrides: Partial<CanonicalChangeRequest> = {}): CanonicalChangeRequest {
  return {
    id: 'req-1',
    familyId: 'fam-1',
    requestingParent: ParentRole.PARENT_A,
    requestType: RequestType.NEED_COVERAGE,
    dates: ['2026-03-10'],
    childScope: null,
    disruptionEventId: null,
    disruptionEventType: null,
    disruptionDurationHours: null,
    isEmergency: false,
    hasPreConsent: false,
    effectiveDate: '2026-03-08T00:00:00Z',
    createdAt: '2026-03-01T00:00:00Z',
    reasonNote: null,
    ...overrides,
  };
}

const okBudget: StabilityBudgetResult = {
  changedDaysInWindow: 2,
  maxAllowedChanges: 8,
  windowDays: 28,
  budgetExceeded: false,
  remainingBudget: 6,
};

const exceededBudget: StabilityBudgetResult = {
  ...okBudget,
  budgetExceeded: true,
  remainingBudget: -1,
};

describe('checkConsent', () => {
  it('emergency always satisfies consent', () => {
    const req = makeReq({ isEmergency: true });
    const result = checkConsent(req, ApplyMode.PROPOSE_ONLY, okBudget);
    expect(result.satisfied).toBe(true);
    expect(result.reasons[0]).toContain('Emergency');
  });

  it('auto-apply + pre-consent + budget OK → satisfied', () => {
    const req = makeReq({ hasPreConsent: true });
    const result = checkConsent(req, ApplyMode.AUTO_APPLY_OVERLAY, okBudget);
    expect(result.satisfied).toBe(true);
  });

  it('auto-apply + pre-consent + budget exceeded → NOT satisfied', () => {
    const req = makeReq({ hasPreConsent: true });
    const result = checkConsent(req, ApplyMode.AUTO_APPLY_OVERLAY, exceededBudget);
    expect(result.satisfied).toBe(false);
  });

  it('pre-consent in PROPOSE_ONLY mode → satisfied', () => {
    const req = makeReq({ hasPreConsent: true });
    const result = checkConsent(req, ApplyMode.PROPOSE_ONLY, okBudget);
    expect(result.satisfied).toBe(true);
  });

  it('no emergency, no pre-consent → NOT satisfied', () => {
    const req = makeReq();
    const result = checkConsent(req, ApplyMode.PROPOSE_ONLY, okBudget);
    expect(result.satisfied).toBe(false);
    expect(result.reasons[0]).toContain('Explicit consent required');
  });

  it('emergency takes priority over everything', () => {
    const req = makeReq({ isEmergency: true, hasPreConsent: false });
    const result = checkConsent(req, ApplyMode.REGENERATE_BASE, exceededBudget);
    expect(result.satisfied).toBe(true);
  });
});
