import { FamilyId, ParentId, ChildId } from '../types';
import { CalendarConstraintLevel } from '../enums';

export interface CalendarEvent {
  id: string;
  familyId: FamilyId;
  parentId: ParentId | null;
  childId: ChildId | null;
  title: string;
  startTime: Date;
  endTime: Date;
  constraintLevel: CalendarConstraintLevel;
  source: string;
  createdAt: Date;
}

export function createCalendarEvent(
  id: string,
  familyId: FamilyId,
  title: string,
  startTime: Date,
  endTime: Date,
  constraintLevel: CalendarConstraintLevel,
  source: string,
  parentId?: ParentId | null,
  childId?: ChildId | null,
): CalendarEvent {
  if (startTime >= endTime) {
    throw new Error('Start time must be before end time');
  }
  if (!title || title.trim().length === 0) {
    throw new Error('Title must not be empty');
  }
  return {
    id,
    familyId,
    parentId: parentId ?? null,
    childId: childId ?? null,
    title: title.trim(),
    startTime,
    endTime,
    constraintLevel,
    source,
    createdAt: new Date(),
  };
}
