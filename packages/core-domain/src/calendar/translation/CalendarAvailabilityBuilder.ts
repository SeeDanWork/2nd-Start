import {
  CalendarConstraintRecord,
  CalendarAvailabilityView,
} from '../types';

/**
 * Builds solver-facing availability views grouped by scope.
 */
export class CalendarAvailabilityBuilder {
  buildAvailabilityView(input: {
    familyId: string;
    windowStart: string;
    windowEnd: string;
    constraints: CalendarConstraintRecord[];
    parentIds: string[];
    childIds: string[];
  }): CalendarAvailabilityView {
    const parentConstraints: Record<string, CalendarConstraintRecord[]> = {};
    const childConstraints: Record<string, CalendarConstraintRecord[]> = {};
    const familyConstraints: CalendarConstraintRecord[] = [];

    // Initialize empty arrays for all known parents/children
    for (const pid of input.parentIds) {
      parentConstraints[pid] = [];
    }
    for (const cid of input.childIds) {
      childConstraints[cid] = [];
    }

    // Group constraints
    for (const constraint of input.constraints) {
      if (constraint.scopeType === 'PARENT' && constraint.parentId) {
        if (!parentConstraints[constraint.parentId]) {
          parentConstraints[constraint.parentId] = [];
        }
        parentConstraints[constraint.parentId].push(constraint);
      } else if (constraint.scopeType === 'CHILD' && constraint.childId) {
        if (!childConstraints[constraint.childId]) {
          childConstraints[constraint.childId] = [];
        }
        childConstraints[constraint.childId].push(constraint);
      } else {
        familyConstraints.push(constraint);
      }
    }

    // Sort each group deterministically
    for (const pid of Object.keys(parentConstraints)) {
      parentConstraints[pid].sort(constraintSorter);
    }
    for (const cid of Object.keys(childConstraints)) {
      childConstraints[cid].sort(constraintSorter);
    }
    familyConstraints.sort(constraintSorter);

    return {
      familyId: input.familyId,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      parentConstraints,
      childConstraints,
      familyConstraints,
    };
  }
}

function constraintSorter(a: CalendarConstraintRecord, b: CalendarConstraintRecord): number {
  const dc = a.date.localeCompare(b.date);
  if (dc !== 0) return dc;
  const sc = (a.startTime ?? '').localeCompare(b.startTime ?? '');
  if (sc !== 0) return sc;
  return a.eventId.localeCompare(b.eventId);
}
