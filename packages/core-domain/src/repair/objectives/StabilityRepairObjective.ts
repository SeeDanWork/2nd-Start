import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { NormalizedRepairInput } from '../types';

/**
 * Stability objective for repair: penalizes additional changes beyond overlay-required ones.
 *
 * - Compares repaired schedule to active (pre-overlay) schedule
 * - Overlay-required changes are not penalized
 * - Additional changes beyond overlays reduce score
 * - Score range: [0, 1]
 */
export function computeRepairStabilityScore(
  repairedSchedule: ScheduleSnapshot,
  input: NormalizedRepairInput,
): { score: number; changedNights: number; changedExchanges: number; overlayChanges: number } {
  const repairDates = new Set(input.days.map(d => d.date));

  let changedNights = 0;
  let overlayChanges = 0;
  let totalComparable = 0;

  for (const night of repairedSchedule.nights) {
    if (!repairDates.has(night.date)) continue;
    totalComparable++;

    const key = `${night.date}:${night.childId}`;
    const activeParent = input.activeNightLookup.get(key);
    if (activeParent && activeParent !== night.parentId) {
      changedNights++;
      if (input.overlayFixedSlots.has(key)) {
        overlayChanges++;
      }
    }
  }

  // Changes beyond overlays
  const additionalChanges = Math.max(0, changedNights - overlayChanges);

  // Count exchange churn in repair window
  const activeExchangeKeys = new Set<string>();
  for (const e of input.activeSchedule.exchanges) {
    if (repairDates.has(e.date)) {
      activeExchangeKeys.add(`${e.date}:${e.childId}`);
    }
  }
  let changedExchanges = 0;
  for (const e of repairedSchedule.exchanges) {
    if (repairDates.has(e.date) && !activeExchangeKeys.has(`${e.date}:${e.childId}`)) {
      changedExchanges++;
    }
  }

  if (totalComparable === 0) {
    return { score: 1.0, changedNights: 0, changedExchanges: 0, overlayChanges: 0 };
  }

  // Score: penalize additional (non-overlay) changes
  const maxPossibleAdditional = Math.max(1, totalComparable - overlayChanges);
  const stabilityFraction = 1 - additionalChanges / maxPossibleAdditional;
  const exchangePenalty = Math.min(changedExchanges / Math.max(1, totalComparable / 2), 1) * 0.15;

  const score = Math.max(0, stabilityFraction - exchangePenalty);

  return { score, changedNights, changedExchanges, overlayChanges };
}
