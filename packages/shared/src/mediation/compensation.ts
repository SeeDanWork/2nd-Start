import { CalendarDiffEntry } from '../types';
import { LabeledCalendarDiff } from './types';
import { ParentRole } from '../enums';

/**
 * Labels each calendar diff entry as either a requested change or a
 * solver-added compensation change to maintain fairness balance.
 */
export function labelCalendarDiffs(
  calendarDiff: CalendarDiffEntry[],
  requestDates: string[],
): LabeledCalendarDiff[] {
  const requestDateSet = new Set(requestDates);

  return calendarDiff.map((entry) => ({
    date: entry.date,
    oldParent: entry.oldParent as ParentRole,
    newParent: entry.newParent as ParentRole,
    isRequested: requestDateSet.has(entry.date),
    isCompensation: !requestDateSet.has(entry.date),
  }));
}
