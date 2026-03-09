import { DateTime } from 'luxon';
import { DateRange } from '../types';
import { Parent } from '../models/Parent';
import { Child } from '../models/Child';
import { ScheduleVersion } from '../models/ScheduleVersion';
import { ScheduleStatus } from '../enums';

/**
 * Validates a date range: both dates must be valid ISO dates and start <= end.
 * Throws if invalid.
 */
export function validateDateRange(range: DateRange): void {
  const start = DateTime.fromISO(range.start);
  const end = DateTime.fromISO(range.end);

  if (!start.isValid) {
    throw new Error(`Invalid start date: ${range.start}`);
  }
  if (!end.isValid) {
    throw new Error(`Invalid end date: ${range.end}`);
  }
  if (start > end) {
    throw new Error(`Start date ${range.start} must not be after end date ${range.end}`);
  }
}

/**
 * Asserts that a parent belongs to the given family.
 * Throws if the parent's familyId does not match.
 */
export function assertParentInFamily(parent: Parent, familyId: string): void {
  if (parent.familyId !== familyId) {
    throw new Error(
      `Parent ${parent.id} belongs to family ${parent.familyId}, not ${familyId}`,
    );
  }
}

/**
 * Asserts that a child belongs to the given family.
 * Throws if the child's familyId does not match.
 */
export function assertChildInFamily(child: Child, familyId: string): void {
  if (child.familyId !== familyId) {
    throw new Error(
      `Child ${child.id} belongs to family ${child.familyId}, not ${familyId}`,
    );
  }
}

/**
 * Ensures a schedule version is archived (immutable).
 * Throws if the schedule is still active.
 */
export function ensureScheduleImmutable(schedule: ScheduleVersion): void {
  if (schedule.status === ScheduleStatus.ACTIVE) {
    throw new Error(
      `Schedule ${schedule.id} is still active. Archive it before creating a new version.`,
    );
  }
}
