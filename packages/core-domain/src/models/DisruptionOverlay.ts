import { ScheduleId, ChildId, ParentId } from '../types';
import { DisruptionType } from '../enums';

export interface DisruptionOverlay {
  id: string;
  scheduleVersionId: ScheduleId;
  childId: ChildId;
  date: string; // ISO date YYYY-MM-DD
  assignedParentId: ParentId;
  type: DisruptionType;
  reason: string;
  createdAt: Date;
}

export function createDisruptionOverlay(
  id: string,
  scheduleVersionId: ScheduleId,
  childId: ChildId,
  date: string,
  assignedParentId: ParentId,
  type: DisruptionType,
  reason: string,
): DisruptionOverlay {
  if (!reason || reason.trim().length === 0) {
    throw new Error('Disruption reason must not be empty');
  }
  return {
    id,
    scheduleVersionId,
    childId,
    date,
    assignedParentId,
    type,
    reason: reason.trim(),
    createdAt: new Date(),
  };
}
