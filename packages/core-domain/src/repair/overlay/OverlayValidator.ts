import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { Parent } from '../../models/Parent';
import { Child } from '../../models/Child';
import { DisruptionOverlaySnapshot } from '../types';
import { OverlayValidationError, OverlayConflictError } from '../errors';

/**
 * Validates overlays against the active schedule and family members.
 *
 * Checks:
 *   - Schedule version match
 *   - Child/date within schedule window
 *   - Assigned parent belongs to family
 *   - No conflicting overlays for same child/date
 *   - No duplicate overlays
 */
export function validateOverlays(input: {
  activeSchedule: ScheduleSnapshot;
  overlays: DisruptionOverlaySnapshot[];
  parents: Parent[];
  children: Child[];
}): void {
  const { activeSchedule, overlays, parents, children } = input;
  const parentIdSet = new Set(parents.map(p => p.id as string));
  const childIdSet = new Set(children.map(c => c.id as string));

  // Build date set from schedule nights
  const scheduleDateSet = new Set(activeSchedule.nights.map(n => n.date));

  const seen = new Set<string>();

  for (const overlay of overlays) {
    // Schedule version match
    if (overlay.scheduleVersionId !== activeSchedule.scheduleVersionId) {
      throw new OverlayValidationError(
        `Overlay ${overlay.overlayId} targets schedule version ${overlay.scheduleVersionId}, ` +
        `but active schedule is ${activeSchedule.scheduleVersionId}`,
      );
    }

    // Child exists
    if (!childIdSet.has(overlay.childId)) {
      throw new OverlayValidationError(
        `Overlay ${overlay.overlayId} references unknown child ${overlay.childId}`,
      );
    }

    // Parent exists
    if (!parentIdSet.has(overlay.assignedParentId)) {
      throw new OverlayValidationError(
        `Overlay ${overlay.overlayId} references unknown parent ${overlay.assignedParentId}`,
      );
    }

    // Date within schedule window
    if (overlay.date < activeSchedule.startDate || overlay.date > activeSchedule.endDate) {
      throw new OverlayValidationError(
        `Overlay ${overlay.overlayId} date ${overlay.date} is outside schedule window ` +
        `${activeSchedule.startDate} to ${activeSchedule.endDate}`,
      );
    }

    // Conflict detection: same child/date
    const key = `${overlay.date}:${overlay.childId}`;
    if (seen.has(key)) {
      throw new OverlayConflictError(
        `Conflicting overlays for child ${overlay.childId} on ${overlay.date}`,
      );
    }
    seen.add(key);
  }
}
