import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { NightOwnership } from '../../models/NightOwnership';
import { DisruptionOverlaySnapshot, AppliedOverlayResult, OverlayImpact } from '../types';
import { normalizeOverlays } from './OverlayNormalizer';

/**
 * Applies disruption overlays deterministically onto an active schedule snapshot.
 *
 * - Replaces ownership on overlay dates
 * - Preserves non-overlaid nights unchanged
 * - Emits OverlayImpact[] tracking each change
 * - Does NOT mutate original schedule objects
 */
export function applyOverlays(input: {
  activeSchedule: ScheduleSnapshot;
  overlays: DisruptionOverlaySnapshot[];
}): AppliedOverlayResult {
  const { activeSchedule, overlays } = input;
  const sorted = normalizeOverlays(overlays);

  // Build overlay lookup: "date:childId" -> overlay
  const overlayLookup = new Map<string, DisruptionOverlaySnapshot>();
  for (const overlay of sorted) {
    overlayLookup.set(`${overlay.date}:${overlay.childId}`, overlay);
  }

  // Build original night lookup for impact tracking
  const originalLookup = new Map<string, NightOwnership>();
  for (const night of activeSchedule.nights) {
    originalLookup.set(`${night.date}:${night.childId}`, night);
  }

  const newNights: NightOwnership[] = [];
  const impacts: OverlayImpact[] = [];

  for (const night of activeSchedule.nights) {
    const key = `${night.date}:${night.childId}`;
    const overlay = overlayLookup.get(key);

    if (overlay && overlay.assignedParentId !== night.parentId) {
      // Apply overlay: change parent
      newNights.push({
        ...night,
        parentId: overlay.assignedParentId as any,
      });
      impacts.push({
        overlayId: overlay.overlayId,
        childId: overlay.childId,
        date: overlay.date,
        fromParentId: night.parentId,
        toParentId: overlay.assignedParentId,
        type: overlay.type,
      });
    } else {
      // Preserve unchanged
      newNights.push({ ...night });
    }
  }

  // Sort impacts deterministically
  impacts.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return a.childId.localeCompare(b.childId);
  });

  const overlaidSchedule: ScheduleSnapshot = {
    ...activeSchedule,
    nights: newNights,
    exchanges: [...activeSchedule.exchanges],
  };

  return { overlaidSchedule, overlayImpacts: impacts };
}
