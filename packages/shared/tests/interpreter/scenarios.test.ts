import { describe, it, expect } from 'vitest';
import { interpretChangeRequest } from '../../src/interpreter/interpret';
import { ApplyMode } from '../../src/interpreter/types';
import { ParentRole, RequestType, DisruptionEventType } from '../../src/enums';
import type { RawChangeRequestInput } from '../../src/interpreter/canonicalize';
import type { AssignmentRecord } from '../../src/interpreter/stability_budget';

function makeRaw(overrides: Partial<RawChangeRequestInput> = {}): RawChangeRequestInput {
  return {
    id: 'req-1',
    familyId: 'fam-1',
    requestingParent: ParentRole.PARENT_A,
    requestType: RequestType.NEED_COVERAGE,
    dates: ['2027-04-10', '2027-04-11'],
    createdAt: '2027-04-01T00:00:00Z',
    ...overrides,
  };
}

function makePrevCurr(
  changedCount: number,
  refDate: string = '2027-04-28',
): { prev: AssignmentRecord[]; curr: AssignmentRecord[]; refDate: string } {
  const prev: AssignmentRecord[] = [];
  const curr: AssignmentRecord[] = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date('2027-04-01');
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    prev.push({ date: dateStr, assignedTo: 'parent_a' });
    curr.push({ date: dateStr, assignedTo: i < changedCount ? 'parent_b' : 'parent_a' });
  }
  return { prev, curr, refDate };
}

describe('Interpreter Scenarios', () => {
  it('S1: Simple coverage request → PROPOSE_ONLY, no consent', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw(),
      previousAssignments: [],
      currentAssignments: [],
    });
    expect(result.isValid).toBe(true);
    expect(result.applyMode).toBe(ApplyMode.PROPOSE_ONLY);
    expect(result.consentSatisfied).toBe(false);
  });

  it('S2: Emergency request → consent bypassed', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({ isEmergency: true }),
      previousAssignments: [],
      currentAssignments: [],
    });
    expect(result.consentSatisfied).toBe(true);
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining('Emergency')]));
  });

  it('S3: Short disruption + pre-consent → AUTO_APPLY_OVERLAY', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({
        disruptionEventId: 'evt-1',
        disruptionEventType: DisruptionEventType.CHILD_SICK,
        disruptionDurationHours: 48,
        hasPreConsent: true,
      }),
      previousAssignments: [],
      currentAssignments: [],
    });
    expect(result.applyMode).toBe(ApplyMode.AUTO_APPLY_OVERLAY);
    expect(result.consentSatisfied).toBe(true);
    expect(result.overlayLockDates).toHaveLength(2);
  });

  it('S4: Bonus week → REGENERATE_BASE', () => {
    const dates = [
      '2027-05-05', '2027-05-06', '2027-05-07', '2027-05-08',
      '2027-05-09', '2027-05-10', '2027-05-11',
    ];
    const result = interpretChangeRequest({
      rawRequest: makeRaw({ requestType: RequestType.BONUS_WEEK, dates }),
      previousAssignments: [],
      currentAssignments: [],
    });
    expect(result.applyMode).toBe(ApplyMode.REGENERATE_BASE);
  });

  it('S5: Stability budget exceeded → REGENERATE_BASE', () => {
    const { prev, curr, refDate } = makePrevCurr(10);
    const result = interpretChangeRequest({
      rawRequest: makeRaw(),
      previousAssignments: prev,
      currentAssignments: curr,
      referenceDate: refDate,
    });
    expect(result.stabilityBudget.budgetExceeded).toBe(true);
    expect(result.applyMode).toBe(ApplyMode.REGENERATE_BASE);
  });

  it('S6: Stability budget OK → PROPOSE_ONLY', () => {
    const { prev, curr, refDate } = makePrevCurr(3);
    const result = interpretChangeRequest({
      rawRequest: makeRaw(),
      previousAssignments: prev,
      currentAssignments: curr,
      referenceDate: refDate,
    });
    expect(result.stabilityBudget.budgetExceeded).toBe(false);
    expect(result.applyMode).toBe(ApplyMode.PROPOSE_ONLY);
  });

  it('S7: Invalid swap (1 date) → validation errors, still PROPOSE_ONLY', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({ requestType: RequestType.SWAP_DATE, dates: ['2027-04-10'] }),
      previousAssignments: [],
      currentAssignments: [],
    });
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.some(e => e.code === 'SWAP_REQUIRES_TWO_DATES')).toBe(true);
    expect(result.applyMode).toBe(ApplyMode.PROPOSE_ONLY);
  });

  it('S8: Long disruption (>72h) → PROPOSE_ONLY even with pre-consent', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({
        disruptionEventId: 'evt-1',
        disruptionEventType: DisruptionEventType.PARENT_TRAVEL,
        disruptionDurationHours: 120,
        hasPreConsent: true,
      }),
      previousAssignments: [],
      currentAssignments: [],
    });
    expect(result.applyMode).toBe(ApplyMode.PROPOSE_ONLY);
    expect(result.overlayLockDates).toHaveLength(0);
    expect(result.consentSatisfied).toBe(true);
  });
});
