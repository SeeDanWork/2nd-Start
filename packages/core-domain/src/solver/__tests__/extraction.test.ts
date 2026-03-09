import { describe, it, expect } from 'vitest';
import { buildSolverInput } from '../core/SolverInputBuilder';
import { buildModel } from '../model/ScheduleModelBuilder';
import { extractCandidate } from '../model/CandidateExtractor';
import { makeSolverInput, makeWindow, PARENT_A, PARENT_B, CHILD_1, CHILD_2 } from './helpers';

describe('CandidateExtractor', () => {
  it('exchanges inferred correctly from ownership changes', () => {
    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-04'),
      children: [{ id: CHILD_1, familyId: 'family-1' as any, name: 'Alice', birthDate: '2020-01-01', createdAt: new Date() }],
    });
    const normalized = buildSolverInput(input);
    const model = buildModel(normalized);

    // Manually assign: A, B, A for child-1
    const assignment = new Map<number, number>();
    for (const v of model.variables) {
      if (v.date === '2026-03-02' && v.childId === CHILD_1) {
        assignment.set(v.index, v.parentId === PARENT_A ? 1 : 0);
      } else if (v.date === '2026-03-03' && v.childId === CHILD_1) {
        assignment.set(v.index, v.parentId === PARENT_B ? 1 : 0);
      } else if (v.date === '2026-03-04' && v.childId === CHILD_1) {
        assignment.set(v.index, v.parentId === PARENT_A ? 1 : 0);
      }
    }

    const result = extractCandidate(assignment, model, normalized);

    expect(result.nights).toHaveLength(3);
    expect(result.exchanges).toHaveLength(2);

    // Exchange on 2026-03-03: A->B
    expect(result.exchanges[0]).toEqual({
      date: '2026-03-03',
      childId: CHILD_1,
      fromParentId: PARENT_A,
      toParentId: PARENT_B,
      time: null,
      location: null,
    });
    // Exchange on 2026-03-04: B->A
    expect(result.exchanges[1]).toEqual({
      date: '2026-03-04',
      childId: CHILD_1,
      fromParentId: PARENT_B,
      toParentId: PARENT_A,
      time: null,
      location: null,
    });
  });

  it('extracted candidates are deterministically ordered', () => {
    const input = makeSolverInput({ window: makeWindow('2026-03-02', '2026-03-03') });
    const normalized = buildSolverInput(input);
    const model = buildModel(normalized);

    // Assign all to PARENT_A
    const assignment = new Map<number, number>();
    for (const v of model.variables) {
      assignment.set(v.index, v.parentId === PARENT_A ? 1 : 0);
    }

    const result1 = extractCandidate(assignment, model, normalized);
    const result2 = extractCandidate(assignment, model, normalized);

    // Same assignment produces identical output
    expect(result1.nights).toEqual(result2.nights);
    expect(result1.exchanges).toEqual(result2.exchanges);

    // Nights ordered by date, then childId
    for (let i = 1; i < result1.nights.length; i++) {
      const prev = result1.nights[i - 1];
      const curr = result1.nights[i];
      const cmp = prev.date.localeCompare(curr.date) || prev.childId.localeCompare(curr.childId);
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });

  it('no exchanges when parent stays the same', () => {
    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-04'),
      children: [{ id: CHILD_1, familyId: 'family-1' as any, name: 'Alice', birthDate: '2020-01-01', createdAt: new Date() }],
    });
    const normalized = buildSolverInput(input);
    const model = buildModel(normalized);

    const assignment = new Map<number, number>();
    for (const v of model.variables) {
      assignment.set(v.index, v.parentId === PARENT_A ? 1 : 0);
    }

    const result = extractCandidate(assignment, model, normalized);
    expect(result.exchanges).toHaveLength(0);
  });
});
