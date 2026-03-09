import { describe, it, expect } from 'vitest';
import { buildSolverInput } from '../core/SolverInputBuilder';
import { makeSolverInput, makeWindow, makeParent, makeChild, FAMILY_ID, PARENT_A, PARENT_B, CHILD_1, CHILD_2 } from './helpers';
import { FamilyId, ParentId, ChildId } from '../../types';

describe('SolverInputBuilder', () => {
  it('rejects invalid planning window (start > end)', () => {
    const input = makeSolverInput({ window: makeWindow('2026-03-15', '2026-03-01') });
    expect(() => buildSolverInput(input)).toThrow('startDate must be <= endDate');
  });

  it('rejects empty start date', () => {
    const input = makeSolverInput({ window: { startDate: '', endDate: '2026-03-14' } });
    expect(() => buildSolverInput(input)).toThrow('startDate and endDate');
  });

  it('rejects missing familyId', () => {
    const input = makeSolverInput({ familyId: '' as FamilyId });
    expect(() => buildSolverInput(input)).toThrow('familyId is required');
  });

  it('rejects no parents', () => {
    const input = makeSolverInput({ parents: [] });
    expect(() => buildSolverInput(input)).toThrow('At least one parent');
  });

  it('rejects no children', () => {
    const input = makeSolverInput({ children: [] });
    expect(() => buildSolverInput(input)).toThrow('At least one child');
  });

  it('rejects parent from wrong family', () => {
    const wrongParent = { ...makeParent(PARENT_A), familyId: 'other-family' as FamilyId };
    const input = makeSolverInput({ parents: [wrongParent, makeParent(PARENT_B)] });
    expect(() => buildSolverInput(input)).toThrow('belongs to family');
  });

  it('rejects child from wrong family', () => {
    const wrongChild = { ...makeChild(CHILD_1), familyId: 'other-family' as FamilyId };
    const input = makeSolverInput({ children: [wrongChild] });
    expect(() => buildSolverInput(input)).toThrow('belongs to family');
  });

  it('sorts parents/children/policies deterministically', () => {
    const input = makeSolverInput({
      parents: [makeParent('parent-z'), makeParent('parent-a')],
      children: [makeChild('child-z' as ChildId), makeChild('child-a' as ChildId)],
    });
    const normalized = buildSolverInput(input);
    expect(normalized.parentIds).toEqual(['parent-a', 'parent-z']);
    expect(normalized.childIds).toEqual(['child-a', 'child-z']);
  });

  it('marks weekend dates correctly (Fri+Sat nights)', () => {
    // 2026-03-02 is Monday
    const input = makeSolverInput({ window: makeWindow('2026-03-02', '2026-03-08') });
    const normalized = buildSolverInput(input);

    const weekendDates = normalized.days.filter(d => d.isWeekend).map(d => d.date);
    // Fri=2026-03-06, Sat=2026-03-07
    expect(weekendDates).toEqual(['2026-03-06', '2026-03-07']);
  });

  it('expands planning window into correct day count', () => {
    const input = makeSolverInput({ window: makeWindow('2026-03-01', '2026-03-07') });
    const normalized = buildSolverInput(input);
    expect(normalized.days).toHaveLength(7);
    expect(normalized.days[0].date).toBe('2026-03-01');
    expect(normalized.days[6].date).toBe('2026-03-07');
  });

  it('builds baseline lookup from baseline schedule', () => {
    const input = makeSolverInput({
      baselineSchedule: {
        scheduleVersionId: 'v1',
        familyId: FAMILY_ID,
        startDate: '2026-03-02',
        endDate: '2026-03-03',
        nights: [
          { id: 'n1', scheduleId: 'v1' as any, date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A, createdAt: new Date() },
        ],
        exchanges: [],
      },
    });
    const normalized = buildSolverInput(input);
    expect(normalized.baselineNightLookup.get(`2026-03-02:${CHILD_1}`)).toBe(PARENT_A);
  });

  it('validates fixed holiday references', () => {
    const input = makeSolverInput({
      fixedHolidayAssignments: [{
        label: 'Christmas',
        date: '2026-03-05',
        childIds: ['unknown-child'],
        assignedParentId: PARENT_A,
      }],
    });
    expect(() => buildSolverInput(input)).toThrow('unknown child');
  });

  it('validates fixed holiday parent references', () => {
    const input = makeSolverInput({
      fixedHolidayAssignments: [{
        label: 'Christmas',
        date: '2026-03-05',
        childIds: [CHILD_1],
        assignedParentId: 'unknown-parent',
      }],
    });
    expect(() => buildSolverInput(input)).toThrow('unknown parent');
  });
});
