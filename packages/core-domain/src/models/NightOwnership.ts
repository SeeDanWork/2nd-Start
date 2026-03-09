import { ScheduleId, ChildId, ParentId } from '../types';

export interface NightOwnership {
  id: string;
  scheduleId: ScheduleId;
  date: string; // ISO date YYYY-MM-DD
  childId: ChildId;
  parentId: ParentId;
  createdAt: Date;
}

export function createNightOwnership(
  id: string,
  scheduleId: ScheduleId,
  date: string,
  childId: ChildId,
  parentId: ParentId,
): NightOwnership {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Date must be YYYY-MM-DD format');
  }
  return {
    id,
    scheduleId,
    date,
    childId,
    parentId,
    createdAt: new Date(),
  };
}
