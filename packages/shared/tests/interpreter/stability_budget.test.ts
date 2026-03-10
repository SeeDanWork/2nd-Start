import { describe, it, expect } from 'vitest';
import { computeStabilityBudget, type AssignmentRecord } from '../../src/interpreter/stability_budget';

function makeAssignments(parent: string, dates: string[]): AssignmentRecord[] {
  return dates.map(date => ({ date, assignedTo: parent }));
}

describe('computeStabilityBudget', () => {
  const refDate = '2026-03-28';

  it('returns 0 changes when schedules are identical', () => {
    const assignments = makeAssignments('parent_a', ['2026-03-10', '2026-03-11']);
    const result = computeStabilityBudget(assignments, assignments, refDate);
    expect(result.changedDaysInWindow).toBe(0);
    expect(result.budgetExceeded).toBe(false);
    expect(result.remainingBudget).toBe(8);
  });

  it('counts changed days correctly', () => {
    const prev = [
      { date: '2026-03-10', assignedTo: 'parent_a' },
      { date: '2026-03-11', assignedTo: 'parent_a' },
      { date: '2026-03-12', assignedTo: 'parent_b' },
    ];
    const curr = [
      { date: '2026-03-10', assignedTo: 'parent_b' }, // changed
      { date: '2026-03-11', assignedTo: 'parent_a' }, // same
      { date: '2026-03-12', assignedTo: 'parent_a' }, // changed
    ];
    const result = computeStabilityBudget(prev, curr, refDate);
    expect(result.changedDaysInWindow).toBe(2);
    expect(result.remainingBudget).toBe(6);
  });

  it('ignores dates outside the window', () => {
    const prev = [{ date: '2026-02-01', assignedTo: 'parent_a' }]; // Way before window
    const curr = [{ date: '2026-02-01', assignedTo: 'parent_b' }];
    const result = computeStabilityBudget(prev, curr, refDate);
    expect(result.changedDaysInWindow).toBe(0);
  });

  it('detects budget exceeded', () => {
    const dates = Array.from({ length: 10 }, (_, i) => {
      const d = new Date('2026-03-10');
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const prev = makeAssignments('parent_a', dates);
    const curr = makeAssignments('parent_b', dates);
    const result = computeStabilityBudget(prev, curr, refDate);
    expect(result.changedDaysInWindow).toBe(10);
    expect(result.budgetExceeded).toBe(true);
    expect(result.remainingBudget).toBe(-2);
  });

  it('respects custom window and max', () => {
    const prev = [{ date: '2026-03-27', assignedTo: 'parent_a' }];
    const curr = [{ date: '2026-03-27', assignedTo: 'parent_b' }];
    const result = computeStabilityBudget(prev, curr, refDate, 7, 1);
    expect(result.changedDaysInWindow).toBe(1);
    expect(result.budgetExceeded).toBe(true);
    expect(result.windowDays).toBe(7);
    expect(result.maxAllowedChanges).toBe(1);
  });

  it('boundary: exactly at max changes → exceeded', () => {
    const dates = Array.from({ length: 8 }, (_, i) => {
      const d = new Date('2026-03-10');
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const prev = makeAssignments('parent_a', dates);
    const curr = makeAssignments('parent_b', dates);
    const result = computeStabilityBudget(prev, curr, refDate);
    expect(result.changedDaysInWindow).toBe(8);
    expect(result.budgetExceeded).toBe(true);
    expect(result.remainingBudget).toBe(0);
  });
});
