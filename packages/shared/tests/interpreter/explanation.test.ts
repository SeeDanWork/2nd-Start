import { describe, it, expect } from 'vitest';
import { interpretChangeRequest } from '../../src/interpreter/interpret';
import { ApplyMode } from '../../src/interpreter/types';
import { ParentRole, RequestType, DisruptionEventType } from '../../src/enums';
import type { RawChangeRequestInput } from '../../src/interpreter/canonicalize';
import type { AssignmentRecord } from '../../src/interpreter/stability_budget';

function makeRaw(overrides: Partial<RawChangeRequestInput> = {}): RawChangeRequestInput {
  return {
    id: 'req-exp-1',
    familyId: 'fam-1',
    requestingParent: ParentRole.PARENT_A,
    requestType: RequestType.NEED_COVERAGE,
    dates: ['2027-03-15', '2027-03-16'],
    createdAt: '2027-03-01T00:00:00Z',
    ...overrides,
  };
}

const emptyAssignments: AssignmentRecord[] = [];

describe('Interpreter — Explanation-Relevant Fields', () => {
  it('reasons array is populated for standard requests', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw(),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    // Should have at least consent-related reasons
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('emergency requests include "Emergency" in reasons', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({ isEmergency: true }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    const hasEmergencyReason = result.reasons.some(
      (r) => r.toLowerCase().includes('emergency'),
    );
    expect(hasEmergencyReason).toBe(true);
  });

  it('disruption requests include disruption context in overlay dates', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({
        disruptionEventId: 'evt-1',
        disruptionEventType: DisruptionEventType.CHILD_SICK,
        disruptionDurationHours: 24,
        hasPreConsent: true,
      }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.applyMode).toBe(ApplyMode.AUTO_APPLY_OVERLAY);
    expect(result.overlayLockDates.length).toBeGreaterThan(0);
    expect(result.reasons.some((r) => r.includes('auto-apply'))).toBe(true);
  });

  it('budget-exceeded requests explain the budget in reasons', () => {
    const prev = Array.from({ length: 10 }, (_, i) => {
      const d = new Date('2027-03-05');
      d.setDate(d.getDate() + i);
      return { date: d.toISOString().slice(0, 10), assignedTo: 'parent_a' };
    });
    const curr = prev.map((a) => ({ ...a, assignedTo: 'parent_b' }));

    const result = interpretChangeRequest({
      rawRequest: makeRaw(),
      previousAssignments: prev,
      currentAssignments: curr,
      referenceDate: '2027-03-28',
    });
    expect(result.reasons.some((r) => r.includes('Stability budget'))).toBe(true);
    expect(result.reasons.some((r) => r.includes('regeneration'))).toBe(true);
  });

  it('validation errors are populated for invalid requests', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({
        requestType: RequestType.SWAP_DATE,
        dates: ['2027-03-10'], // swap needs 2+ dates
      }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.length).toBeGreaterThan(0);
    expect(result.validationErrors[0].field).toBeDefined();
    expect(result.validationErrors[0].message).toBeDefined();
  });

  it('consent reason differs between emergency and normal', () => {
    const emergency = interpretChangeRequest({
      rawRequest: makeRaw({ isEmergency: true }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    const normal = interpretChangeRequest({
      rawRequest: makeRaw({ isEmergency: false }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });

    expect(emergency.consentSatisfied).toBe(true);
    expect(normal.consentSatisfied).toBe(false);
    // Reasons should differ
    expect(emergency.reasons).not.toEqual(normal.reasons);
  });

  it('pre-consent satisfies consent for non-emergency', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({ hasPreConsent: true }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.consentSatisfied).toBe(true);
  });

  it('computed effective date is present in result', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw(),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.computedEffectiveDate).toBeDefined();
    expect(typeof result.computedEffectiveDate).toBe('string');
  });
});
