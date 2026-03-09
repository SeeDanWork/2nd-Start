import { ParentId, FamilyId, ChildId } from '../../types';
import { ParentRole } from '../../enums';
import { Parent } from '../../models/Parent';
import { Child } from '../../models/Child';
import { SolverInput, SolverConfig, ObjectiveWeights, PlanningWindow, FixedHolidayAssignment, FairnessState } from '../types';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';

export const FAMILY_ID = 'family-1' as FamilyId;
export const PARENT_A = 'parent-a' as ParentId;
export const PARENT_B = 'parent-b' as ParentId;
export const CHILD_1 = 'child-1' as ChildId;
export const CHILD_2 = 'child-2' as ChildId;

export function makeParent(id: string, name: string = 'Parent'): Parent {
  return {
    id: id as ParentId,
    familyId: FAMILY_ID,
    name,
    role: ParentRole.MOTHER,
    email: `${id}@test.com`,
    createdAt: new Date('2026-01-01'),
  };
}

export function makeChild(id: string, name: string = 'Child', birthDate: string = '2020-01-01'): Child {
  return {
    id: id as ChildId,
    familyId: FAMILY_ID,
    name,
    birthDate,
    createdAt: new Date('2026-01-01'),
  };
}

export function makeWeights(overrides?: Partial<ObjectiveWeights>): ObjectiveWeights {
  return {
    stability: 10,
    familyStructure: 8,
    fairness: 10,
    parentPreference: 3,
    childPreference: 3,
    logistics: 2,
    convenience: 2,
    nightsFairness: 5,
    weekendsFairness: 4,
    holidaysFairness: 3,
    ...overrides,
  };
}

export function makeConfig(overrides?: Partial<SolverConfig>): SolverConfig {
  return {
    candidateCount: 3,
    primaryMultiplier: 100,
    objectiveWeights: makeWeights(),
    ...overrides,
  };
}

export function makeWindow(start: string = '2026-03-02', end: string = '2026-03-15'): PlanningWindow {
  return { startDate: start, endDate: end };
}

export function makeSolverInput(overrides?: Partial<SolverInput>): SolverInput {
  return {
    familyId: FAMILY_ID,
    window: makeWindow(),
    children: [makeChild(CHILD_1, 'Alice'), makeChild(CHILD_2, 'Bob')],
    parents: [makeParent(PARENT_A, 'Mom'), makeParent(PARENT_B, 'Dad')],
    activePolicies: [],
    solverConfig: makeConfig(),
    ...overrides,
  };
}

export function makeSingleChildInput(overrides?: Partial<SolverInput>): SolverInput {
  return makeSolverInput({
    children: [makeChild(CHILD_1, 'Alice')],
    ...overrides,
  });
}
