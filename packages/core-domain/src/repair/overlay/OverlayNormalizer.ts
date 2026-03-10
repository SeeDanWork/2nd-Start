import { DisruptionOverlaySnapshot } from '../types';

/**
 * Sorts overlays deterministically for consistent application.
 *
 * Sort order:
 *   1. date ascending
 *   2. childId ascending
 *   3. overlayId ascending
 */
export function normalizeOverlays(overlays: DisruptionOverlaySnapshot[]): DisruptionOverlaySnapshot[] {
  return [...overlays].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    const cc = a.childId.localeCompare(b.childId);
    if (cc !== 0) return cc;
    return a.overlayId.localeCompare(b.overlayId);
  });
}
