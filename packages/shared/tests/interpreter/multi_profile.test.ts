import { describe, it, expect } from 'vitest';
import { interpretChangeRequest } from '../../src/interpreter/interpret';
import { ApplyMode } from '../../src/interpreter/types';
import { ParentRole, RequestType, DisruptionEventType } from '../../src/enums';
import type { RawChangeRequestInput } from '../../src/interpreter/canonicalize';
import type { AssignmentRecord } from '../../src/interpreter/stability_budget';

function makeRaw(overrides: Partial<RawChangeRequestInput> = {}): RawChangeRequestInput {
  return {
    id: 'req-mp-1',
    familyId: 'fam-1',
    requestingParent: ParentRole.PARENT_A,
    requestType: RequestType.NEED_COVERAGE,
    dates: ['2027-03-15', '2027-03-16'],
    createdAt: '2027-03-01T00:00:00Z',
    ...overrides,
  };
}

const emptyAssignments: AssignmentRecord[] = [];

// Build a 28-day assignment schedule alternating weekly
function buildAlternatingAssignments(startDate: string, days: number): AssignmentRecord[] {
  const assignments: AssignmentRecord[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    // Alternate weekly: week 0 = parent_a, week 1 = parent_b, etc.
    const week = Math.floor(i / 7);
    assignments.push({ date: iso, assignedTo: week % 2 === 0 ? 'parent_a' : 'parent_b' });
  }
  return assignments;
}

describe('Interpreter — Multi-Profile Consistency', () => {
  it('produces consistent results for NEED_COVERAGE across different scenarios', () => {
    const r1 = interpretChangeRequest({
      rawRequest: makeRaw({ dates: ['2027-03-15'] }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    const r2 = interpretChangeRequest({
      rawRequest: makeRaw({ dates: ['2027-03-15', '2027-03-16', '2027-03-17'] }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });

    // Both should be valid and PROPOSE_ONLY
    expect(r1.isValid).toBe(true);
    expect(r2.isValid).toBe(true);
    expect(r1.applyMode).toBe(ApplyMode.PROPOSE_ONLY);
    expect(r2.applyMode).toBe(ApplyMode.PROPOSE_ONLY);
  });

  it('AUTO_APPLY_OVERLAY path produces expected structure', () => {
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
    expect(result.consentSatisfied).toBe(true);
    expect(result.reasons.some(r => r.includes('auto-apply'))).toBe(true);
  });

  it('PROPOSE_ONLY path produces expected structure', () => {
    const result = interpretChangeRequest({
      rawRequest: makeRaw(),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });

    expect(result.applyMode).toBe(ApplyMode.PROPOSE_ONLY);
    expect(result.overlayLockDates).toEqual([]);
    expect(result.canonical.dates.length).toBe(2);
  });

  it('REGENERATE_BASE path produces expected structure', () => {
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
    expect(result.reasons.some(r => r.includes('regeneration'))).toBe(true);
  });

  it('stability budget interacts correctly with mode selection', () => {
    // Build assignments with many changes to exceed budget
    const prev = Array.from({ length: 10 }, (_, i) => {
      const d = new Date('2027-03-05');
      d.setDate(d.getDate() + i);
      return { date: d.toISOString().slice(0, 10), assignedTo: 'parent_a' };
    });
    const curr = prev.map(a => ({ ...a, assignedTo: 'parent_b' }));

    const result = interpretChangeRequest({
      rawRequest: makeRaw(),
      previousAssignments: prev,
      currentAssignments: curr,
      referenceDate: '2027-03-28',
    });

    expect(result.stabilityBudget.budgetExceeded).toBe(true);
    expect(result.applyMode).toBe(ApplyMode.REGENERATE_BASE);
    expect(result.reasons.some(r => r.includes('Stability budget'))).toBe(true);
  });

  it('different request types produce distinct canonical forms', () => {
    const coverage = interpretChangeRequest({
      rawRequest: makeRaw({ requestType: RequestType.NEED_COVERAGE }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });
    const wantTime = interpretChangeRequest({
      rawRequest: makeRaw({ requestType: RequestType.WANT_TIME }),
      previousAssignments: emptyAssignments,
      currentAssignments: emptyAssignments,
    });

    expect(coverage.canonical.requestType).toBe(RequestType.NEED_COVERAGE);
    expect(wantTime.canonical.requestType).toBe(RequestType.WANT_TIME);
    // Both valid
    expect(coverage.isValid).toBe(true);
    expect(wantTime.isValid).toBe(true);
  });
});
