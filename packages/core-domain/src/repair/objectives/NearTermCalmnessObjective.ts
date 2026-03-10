import { DateTime } from 'luxon';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { NormalizedRepairInput } from '../types';

/**
 * Near-term calmness objective: penalizes churn close to overlay dates
 * and back-and-forth corrections.
 *
 * - Penalizes changes in the first few days after overlays
 * - Penalizes oscillation (A→B→A patterns)
 * - Rewards deferred, calm corrections later in window
 *
 * Score range: [0, 1]
 */
export function computeNearTermCalmnessScore(
  repairedSchedule: ScheduleSnapshot,
  input: NormalizedRepairInput,
): { score: number } {
  if (input.days.length === 0) return { score: 1.0 };

  const repairDates = input.days.map(d => d.date);

  // Find the latest overlay date to define "near-term" zone
  const overlayDates = [...input.overlayFixedSlots].map(k => k.split(':')[0]);
  const sortedOverlayDates = [...new Set(overlayDates)].sort();
  const latestOverlayDate = sortedOverlayDates[sortedOverlayDates.length - 1] ?? repairDates[0];

  const latestOverlayDt = DateTime.fromISO(latestOverlayDate);

  // Build repaired night lookup
  const repairedLookup = new Map<string, string>();
  for (const n of repairedSchedule.nights) {
    repairedLookup.set(`${n.date}:${n.childId}`, n.parentId);
  }

  let totalPenalty = 0;
  let totalSlots = 0;

  for (const day of input.days) {
    if (input.overlayFixedSlots.has(`${day.date}:${input.childIds[0]}`)) continue;

    const dayDt = DateTime.fromISO(day.date);
    const daysFromOverlay = dayDt.diff(latestOverlayDt, 'days').days;

    // Near-term = within 3 days of latest overlay
    const isNearTerm = daysFromOverlay >= 0 && daysFromOverlay <= 3;
    // Decay factor: changes close to overlay are worse
    const proximityMultiplier = isNearTerm ? 2.0 : 1.0;

    for (const childId of input.childIds) {
      const key = `${day.date}:${childId}`;
      if (input.overlayFixedSlots.has(key)) continue;

      totalSlots++;
      const overlaidParent = input.overlaidNightLookup.get(key);
      const repairedParent = repairedLookup.get(key);

      if (!overlaidParent || !repairedParent) continue;
      if (overlaidParent !== repairedParent) {
        totalPenalty += proximityMultiplier;
      }
    }
  }

  // Check for oscillation: A→B→A patterns in repair window
  for (const childId of input.childIds) {
    const childNights = input.days
      .map(d => ({
        date: d.date,
        parent: repairedLookup.get(`${d.date}:${childId}`),
      }))
      .filter(n => n.parent !== undefined);

    for (let i = 2; i < childNights.length; i++) {
      if (
        childNights[i].parent === childNights[i - 2].parent &&
        childNights[i].parent !== childNights[i - 1].parent
      ) {
        totalPenalty += 1.5; // oscillation penalty
      }
    }
  }

  if (totalSlots === 0) return { score: 1.0 };

  const maxPenalty = totalSlots * 2.5; // account for proximity multiplier + oscillation
  const score = Math.max(0, 1 - totalPenalty / maxPenalty);

  return { score };
}
