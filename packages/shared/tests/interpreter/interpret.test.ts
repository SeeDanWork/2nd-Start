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
    dates: ['2027-03-15', '2027-03-10'],
    createdAt: '2027-03-01T00:00:00Z',
    ...overrides,
  };
}

const emptyAssignments: AssignmentRecord[] = [];

describe('interpretChangeRequest — end-to-end', () => {
  it('Scenario 1: simple need_coverage → PROPOSE_ONLY, consent required', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw(),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.isValid).toBe(true);
    expect(result.applyMode).toBe(ApplyMode.PROPOSE_ONLY);
    expect(result.consentSatisfied).toBe(false);
    expect(result.canonical.dates).toEqual(['2027-03-10', '2027-03-15']); // sorted
  });

  it('Scenario 2: short disruption with pre-consent → AUTO_APPLY_OVERLAY', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({
        disruptionEventId: 'evt-1',
        disruptionEventType: DisruptionEventType.CHILD_SICK,
        disruptionDurationHours: 48,
        hasPreConsent: true,
      }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.applyMode).toBe(ApplyMode.AUTO_APPLY_OVERLAY);
    expect(result.consentSatisfied).toBe(true);
    expect(result.overlayLockDates).toEqual(['2027-03-10', '2027-03-15']);
  });

  it('Scenario 3: long disruption → PROPOSE_ONLY', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({
        disruptionEventId: 'evt-1',
        disruptionEventType: DisruptionEventType.PARENT_TRAVEL,
        disruptionDurationHours: 120,
      }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.applyMode).toBe(ApplyMode.PROPOSE_ONLY);
    expect(result.overlayLockDates).toEqual([]);
  });

  it('Scenario 4: bonus_week → REGENERATE_BASE', () => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date('2027-04-07');
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const result = interpretChangeRequest({
      rawRequest: makeRaw({ requestType: RequestType.BONUS_WEEK, dates }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.applyMode).toBe(ApplyMode.REGENERATE_BASE);
  });

  it('Scenario 5: emergency bypasses consent', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({ isEmergency: true }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.consentSatisfied).toBe(true);
  });

  it('Scenario 6: stability budget exceeded → REGENERATE_BASE', () => {
    const dates = Array.from({ length: 10 }, (_, i) => {
      const d = new Date('2027-03-05');
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const prev = dates.map(d => ({ date: d, assignedTo: 'parent_a' }));
    const curr = dates.map(d => ({ date: d, assignedTo: 'parent_b' }));

    const result = interpretChangeRequest({
      rawRequest: makeRaw(),
      previousAssignments: prev,
      currentAssignments: curr,
      referenceDate: '2027-03-28',
    });
    expect(result.stabilityBudget.budgetExceeded).toBe(true);
    expect(result.applyMode).toBe(ApplyMode.REGENERATE_BASE);
  });

  it('Scenario 7: invalid request (swap with 1 date) → isValid false', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({ requestType: RequestType.SWAP_DATE, dates: ['2027-03-10'] }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.length).toBeGreaterThan(0);
  });

  it('Scenario 8: invalid request still returns PROPOSE_ONLY (not auto-apply)', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw({
        requestType: RequestType.SWAP_DATE,
        dates: ['2027-03-10'],
        disruptionEventId: 'evt-1',
        disruptionDurationHours: 24,
      }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    expect(result.isValid).toBe(false);
    // Invalid requests default to PROPOSE_ONLY, not AUTO_APPLY
    expect(result.applyMode).toBe(ApplyMode.PROPOSE_ONLY);
  });
});
