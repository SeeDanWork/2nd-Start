import { ParentId, FamilyId, ChildId, ScheduleId } from '../../types';
import { ParentRole } from '../../enums';
import { DisruptionType } from '../../enums/DisruptionType';
import { Parent } from '../../models/Parent';
import { Child } from '../../models/Child';
import { NightOwnership } from '../../models/NightOwnership';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { DisruptionOverlaySnapshot, RepairInput, RepairSolverConfig, RepairObjectiveWeights } from '../types';

export const FAMILY_ID = 'family-1' as FamilyId;
export const PARENT_A = 'parent-a' as ParentId;
export const PARENT_B = 'parent-b' as ParentId;
export const CHILD_1 = 'child-1' as ChildId;
export const CHILD_2 = 'child-2' as ChildId;
export const SCHEDULE_V1 = 'schedule-v1' as ScheduleId;

export function makeParent(id: string): Parent {
  return {
    id: id as ParentId,
    familyId: FAMILY_ID,
    name: `Parent ${id}`,
    role: ParentRole.MOTHER,
    email: `${id}@test.com`,
    createdAt: new Date('2026-01-01'),
  };
}

export function makeChild(id: string): Child {
  return {
    id: id as ChildId,
    familyId: FAMILY_ID,
    name: `Child ${id}`,
    birthDate: '2020-01-01',
    createdAt: new Date('2026-01-01'),
  };
}

export function makeNight(date: string, childId: string, parentId: string): NightOwnership {
  return {
    id: `night-${date}-${childId}`,
    scheduleId: SCHEDULE_V1,
    date,
    childId: childId as ChildId,
    parentId: parentId as ParentId,
    createdAt: new Date('2026-01-01'),
  };
}

/**
 * Creates a schedule with alternating 2-night blocks: A,A,B,B,A,A,...
 * for each child across the given date range.
 */
export function makeAlternatingSchedule(
  startDate: string,
  endDate: string,
  childIds: string[] = [CHILD_1, CHILD_2],
): ScheduleSnapshot {
  const nights: NightOwnership[] = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  let dayIndex = 0;

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const parentId = Math.floor(dayIndex / 2) % 2 === 0 ? PARENT_A : PARENT_B;

    for (const childId of childIds) {
      nights.push(makeNight(dateStr, childId, parentId));
    }

    current.setDate(current.getDate() + 1);
    dayIndex++;
  }

  return {
    scheduleVersionId: SCHEDULE_V1,
    familyId: FAMILY_ID,
    startDate,
    endDate,
    nights,
    exchanges: [],
  };
}

export function makeOverlay(
  date: string,
  childId: string,
  assignedParentId: string,
  type: DisruptionType = DisruptionType.ILLNESS,
  overlayId?: string,
): DisruptionOverlaySnapshot {
  return {
    overlayId: overlayId ?? `overlay-${date}-${childId}`,
    scheduleVersionId: SCHEDULE_V1,
    childId,
    date,
    assignedParentId,
    type,
    reason: `${type} on ${date}`,
  };
}

export function makeRepairWeights(overrides?: Partial<RepairObjectiveWeights>): RepairObjectiveWeights {
  return {
    stability: 10,
    familyStructure: 6,
    fairnessRestitution: 8,
    nearTermCalmness: 8,
    parentPreference: 2,
    childPreference: 2,
    logistics: 1,
    convenience: 1,
    ...overrides,
  };
}

export function makeRepairConfig(overrides?: Partial<RepairSolverConfig>): RepairSolverConfig {
  return {
    candidateCount: 3,
    primaryMultiplier: 100,
    maxRepairDays: 14,
    objectiveWeights: makeRepairWeights(),
    ...overrides,
  };
}

export function makeRepairInput(overrides?: Partial<RepairInput>): RepairInput {
  // Default: 14-day schedule with 2 children, overlay child-1 on day 3
  const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-15');
  // Day 3 (2026-03-04) child-1 was with parent-a, overlay switches to parent-b
  const overlays = [makeOverlay('2026-03-04', CHILD_1, PARENT_B)];

  return {
    familyId: FAMILY_ID,
    activeSchedule: schedule,
    disruptionOverlays: overlays,
    parents: [makeParent(PARENT_A), makeParent(PARENT_B)],
    children: [makeChild(CHILD_1), makeChild(CHILD_2)],
    activePolicies: [],
    solverConfig: makeRepairConfig(),
    ...overrides,
  };
}
