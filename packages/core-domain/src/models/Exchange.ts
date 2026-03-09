import { ScheduleId, ChildId, ParentId } from '../types';

export interface Exchange {
  id: string;
  scheduleId: ScheduleId;
  childId: ChildId;
  date: string; // ISO date YYYY-MM-DD
  fromParentId: ParentId;
  toParentId: ParentId;
  time: string;
  location: string;
  createdAt: Date;
}

export function createExchange(
  id: string,
  scheduleId: ScheduleId,
  childId: ChildId,
  date: string,
  fromParentId: ParentId,
  toParentId: ParentId,
  time: string,
  location: string,
): Exchange {
  if (fromParentId === toParentId) {
    throw new Error('From and to parent must be different');
  }
  return {
    id,
    scheduleId,
    childId,
    date,
    fromParentId,
    toParentId,
    time,
    location,
    createdAt: new Date(),
  };
}
