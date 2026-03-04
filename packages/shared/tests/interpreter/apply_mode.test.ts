import { describe, it, expect } from 'vitest';
import { selectApplyMode } from '../../src/interpreter/apply_mode';
import { ApplyMode, type CanonicalChangeRequest, type StabilityBudgetResult } from '../../src/interpreter/types';
import { ParentRole, RequestType, DisruptionEventType } from '../../src/enums';

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
  changedDaysInWindow: 9,
  maxAllowedChanges: 8,
  windowDays: 28,
  budgetExceeded: true,
  remainingBudget: -1,
};

describe('selectApplyMode', () => {
  it('BONUS_WEEK → REGENERATE_BASE', () => {
    const req = makeReq({ requestType: RequestType.BONUS_WEEK });
    expect(selectApplyMode(req, okBudget)).toBe(ApplyMode.REGENERATE_BASE);
  });

  it('stability budget exceeded → REGENERATE_BASE', () => {
    const req = makeReq();
    expect(selectApplyMode(req, exceededBudget)).toBe(ApplyMode.REGENERATE_BASE);
  });

  it('short disruption (≤72h) → AUTO_APPLY_OVERLAY', () => {
    const req = makeReq({
      disruptionEventId: 'evt-1',
      disruptionEventType: DisruptionEventType.CHILD_SICK,
      disruptionDurationHours: 48,
    });
    expect(selectApplyMode(req, okBudget)).toBe(ApplyMode.AUTO_APPLY_OVERLAY);
  });

  it('boundary: exactly 72h disruption → AUTO_APPLY_OVERLAY', () => {
    const req = makeReq({
      disruptionEventId: 'evt-1',
      disruptionEventType: DisruptionEventType.CHILD_SICK,
      disruptionDurationHours: 72,
    });
    expect(selectApplyMode(req, okBudget)).toBe(ApplyMode.AUTO_APPLY_OVERLAY);
  });

  it('long disruption (>72h) → PROPOSE_ONLY', () => {
    const req = makeReq({
      disruptionEventId: 'evt-1',
      disruptionEventType: DisruptionEventType.PARENT_TRAVEL,
      disruptionDurationHours: 120,
    });
    expect(selectApplyMode(req, okBudget)).toBe(ApplyMode.PROPOSE_ONLY);
  });

  it('no disruption, normal request → PROPOSE_ONLY', () => {
    const req = makeReq();
    expect(selectApplyMode(req, okBudget)).toBe(ApplyMode.PROPOSE_ONLY);
  });

  it('BONUS_WEEK takes precedence over budget OK', () => {
    const req = makeReq({ requestType: RequestType.BONUS_WEEK });
    expect(selectApplyMode(req, okBudget)).toBe(ApplyMode.REGENERATE_BASE);
  });
});
