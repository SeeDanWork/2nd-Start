import { DateTime } from 'luxon';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { DisruptionOverlaySnapshot, FairnessDriftSummary } from '../types';
import { FixedHolidayAssignment } from '../../solver/types';

/**
 * Calculates fairness drift caused by overlays.
 *
 * Compares active schedule vs overlaid schedule on overlay dates.
 * A parent losing a night gets -1; gaining gets +1.
 * Weekend/holiday deltas update only when affected dates qualify.
 */
export function calculateOverlayDrift(input: {
  activeSchedule: ScheduleSnapshot;
  overlaidSchedule: ScheduleSnapshot;
  overlays: DisruptionOverlaySnapshot[];
  fixedHolidayAssignments?: FixedHolidayAssignment[];
}): FairnessDriftSummary {
  const { activeSchedule, overlaidSchedule, overlays } = input;

  // Build holiday date set
  const holidayDates = new Set<string>();
  if (input.fixedHolidayAssignments) {
    for (const ha of input.fixedHolidayAssignments) {
      holidayDates.add(ha.date);
    }
  }

  // Build overlay date set for quick lookup
  const overlayKeys = new Set(overlays.map(o => `${o.date}:${o.childId}`));

  // Build lookups
  const activeLookup = new Map<string, string>();
  for (const n of activeSchedule.nights) {
    activeLookup.set(`${n.date}:${n.childId}`, n.parentId);
  }
  const overlaidLookup = new Map<string, string>();
  for (const n of overlaidSchedule.nights) {
    overlaidLookup.set(`${n.date}:${n.childId}`, n.parentId);
  }

  // Collect unique parent IDs
  const parentIds = new Set<string>();
  for (const n of activeSchedule.nights) parentIds.add(n.parentId);
  for (const n of overlaidSchedule.nights) parentIds.add(n.parentId);

  const drift: Record<string, { nightDelta: number; weekendDelta: number; holidayDelta: number }> = {};
  for (const pid of parentIds) {
    drift[pid] = { nightDelta: 0, weekendDelta: 0, holidayDelta: 0 };
  }

  // Compare only on overlay-affected slots
  for (const key of overlayKeys) {
    const activeParent = activeLookup.get(key);
    const overlaidParent = overlaidLookup.get(key);
    if (!activeParent || !overlaidParent || activeParent === overlaidParent) continue;

    const date = key.split(':')[0];
    const dt = DateTime.fromISO(date);
    const isWeekend = dt.weekday === 5 || dt.weekday === 6;
    const isHoliday = holidayDates.has(date);

    // Active parent lost a night
    drift[activeParent].nightDelta -= 1;
    // Overlaid parent gained a night
    drift[overlaidParent].nightDelta += 1;

    if (isWeekend) {
      drift[activeParent].weekendDelta -= 1;
      drift[overlaidParent].weekendDelta += 1;
    }

    if (isHoliday) {
      drift[activeParent].holidayDelta -= 1;
      drift[overlaidParent].holidayDelta += 1;
    }
  }

  return { byParentId: drift };
}
