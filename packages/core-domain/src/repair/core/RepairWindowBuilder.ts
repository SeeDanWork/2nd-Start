import { DateTime } from 'luxon';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { DisruptionOverlaySnapshot, RepairWindow } from '../types';
import { RepairWindowError } from '../errors';

/**
 * Derives a bounded repair window for localized repair solving.
 *
 * Default behavior:
 *   - start = earliest overlay date
 *   - end = start + maxRepairDays - 1
 *   - clipped to schedule bounds
 *
 * If requestedWindow is provided, validates and clips to schedule bounds.
 */
export function buildRepairWindow(input: {
  activeSchedule: ScheduleSnapshot;
  overlays: DisruptionOverlaySnapshot[];
  maxRepairDays: number;
  requestedWindow?: RepairWindow;
}): RepairWindow {
  const { activeSchedule, overlays, maxRepairDays, requestedWindow } = input;

  if (maxRepairDays < 1) {
    throw new RepairWindowError('maxRepairDays must be >= 1');
  }

  if (requestedWindow) {
    return clipToSchedule(requestedWindow, activeSchedule);
  }

  if (overlays.length === 0) {
    throw new RepairWindowError('No overlays provided and no explicit repair window');
  }

  // Find earliest overlay date
  const sortedDates = overlays.map(o => o.date).sort();
  const earliest = sortedDates[0];

  const startDt = DateTime.fromISO(earliest);
  const endDt = startDt.plus({ days: maxRepairDays - 1 });

  const rawWindow: RepairWindow = {
    startDate: startDt.toISODate()!,
    endDate: endDt.toISODate()!,
  };

  return clipToSchedule(rawWindow, activeSchedule);
}

function clipToSchedule(window: RepairWindow, schedule: ScheduleSnapshot): RepairWindow {
  let start = window.startDate;
  let end = window.endDate;

  if (start < schedule.startDate) start = schedule.startDate;
  if (end > schedule.endDate) end = schedule.endDate;

  if (start > end) {
    throw new RepairWindowError(
      `Repair window ${window.startDate}..${window.endDate} does not overlap schedule ${schedule.startDate}..${schedule.endDate}`,
    );
  }

  return { startDate: start, endDate: end };
}
