import { describe, it, expect } from 'vitest';
import { buildSolverInput } from '../core/SolverInputBuilder';
import { buildModel } from '../model/ScheduleModelBuilder';
import { makeSolverInput, makeWindow, PARENT_A, PARENT_B, CHILD_1, CHILD_2 } from './helpers';

describe('ScheduleModelBuilder', () => {
  it('creates exactly-one-parent constraints (correct slot count)', () => {
    const input = makeSolverInput({ window: makeWindow('2026-03-02', '2026-03-04') });
    const normalized = buildSolverInput(input);
    const model = buildModel(normalized);

    // 3 days * 2 children = 6 slots
    expect(model.variablesBySlot.size).toBe(6);

    // Each slot has 2 variables (one per parent)
    for (const [, indices] of model.variablesBySlot) {
      expect(indices).toHaveLength(2);
    }
  });

  it('total variable count = days * children * parents', () => {
    const input = makeSolverInput({ window: makeWindow('2026-03-02', '2026-03-04') });
    const normalized = buildSolverInput(input);
    const model = buildModel(normalized);

    // 3 days * 2 children * 2 parents = 12
    expect(model.variableCount).toBe(12);
  });

  it('enforces fixed holiday ownership', () => {
    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-04'),
      fixedHolidayAssignments: [{
        label: 'Holiday',
        date: '2026-03-03',
        childIds: [CHILD_1, CHILD_2],
        assignedParentId: PARENT_A,
      }],
    });
    const normalized = buildSolverInput(input);
    const model = buildModel(normalized);

    // Check that fixed variables exist for 2026-03-03
    expect(model.fixedVariables.size).toBe(2);

    // Verify fixed variables point to PARENT_A
    for (const vi of model.fixedVariables) {
      const v = model.variableByIndex.get(vi)!;
      expect(v.parentId).toBe(PARENT_A);
      expect(v.date).toBe('2026-03-03');
    }
  });

  it('variable creation order is deterministic (date, childId, parentId)', () => {
    const input = makeSolverInput({ window: makeWindow('2026-03-02', '2026-03-03') });
    const normalized = buildSolverInput(input);
    const model = buildModel(normalized);

    const order = model.variables.map(v => `${v.date}:${v.childId}:${v.parentId}`);

    // Expected order: date ascending, then childId ascending, then parentId ascending
    const expected = [
      '2026-03-02:child-1:parent-a',
      '2026-03-02:child-1:parent-b',
      '2026-03-02:child-2:parent-a',
      '2026-03-02:child-2:parent-b',
      '2026-03-03:child-1:parent-a',
      '2026-03-03:child-1:parent-b',
      '2026-03-03:child-2:parent-a',
      '2026-03-03:child-2:parent-b',
    ];
    expect(order).toEqual(expected);
  });
});
