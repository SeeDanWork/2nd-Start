import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { NormalizedRepairInput, FairnessDriftSummary } from '../types';

/**
 * Fairness restitution objective: rewards gradual restoration of fairness.
 *
 * - Does NOT require full immediate equalization
 * - Rewards partial correction within repair window
 * - Incorporates night/weekend/holiday dimensions
 * - Perfect immediate fairness should NOT dominate stability
 *
 * Score range: [0, 1]
 */
export function computeFairnessRestitutionScore(
  repairedSchedule: ScheduleSnapshot,
  input: NormalizedRepairInput,
): { score: number; restitutionNightCount: number; residualDrift: FairnessDriftSummary } {
  const repairDates = new Set(input.days.map(d => d.date));
  const originalDrift = input.driftSummary;

  // Count how much drift was restored within repair window
  // Compare overlaid schedule vs repaired schedule in repair window
  const repairedLookup = new Map<string, string>();
  for (const n of repairedSchedule.nights) {
    repairedLookup.set(`${n.date}:${n.childId}`, n.parentId);
  }

  const residualDrift: Record<string, { nightDelta: number; weekendDelta: number; holidayDelta: number }> = {};
  for (const [parentId, drift] of Object.entries(originalDrift.byParentId)) {
    residualDrift[parentId] = { ...drift };
  }

  let restitutionNightCount = 0;

  // For each repair-window night, check if it moved from overlaid toward active
  for (const day of input.days) {
    for (const childId of input.childIds) {
      const key = `${day.date}:${childId}`;
      const overlaidParent = input.overlaidNightLookup.get(key);
      const repairedParent = repairedLookup.get(key);
      const activeParent = input.activeNightLookup.get(key);

      if (!overlaidParent || !repairedParent || !activeParent) continue;
      if (overlaidParent === repairedParent) continue; // no repair change

      // Skip overlay-fixed slots (shouldn't change, but defensive)
      if (input.overlayFixedSlots.has(key)) continue;

      // This night was changed by repair
      if (repairedParent !== overlaidParent) {
        // Check if this restores toward original active parent
        if (repairedParent === activeParent) {
          restitutionNightCount++;
          // Reduce residual drift
          if (residualDrift[overlaidParent]) residualDrift[overlaidParent].nightDelta -= 1;
          if (residualDrift[activeParent]) residualDrift[activeParent].nightDelta += 1;

          const isWeekend = day.isWeekend;
          const isHoliday = day.isHoliday;
          if (isWeekend) {
            if (residualDrift[overlaidParent]) residualDrift[overlaidParent].weekendDelta -= 1;
            if (residualDrift[activeParent]) residualDrift[activeParent].weekendDelta += 1;
          }
          if (isHoliday) {
            if (residualDrift[overlaidParent]) residualDrift[overlaidParent].holidayDelta -= 1;
            if (residualDrift[activeParent]) residualDrift[activeParent].holidayDelta += 1;
          }
        }
      }
    }
  }

  // Score: how much drift was reduced
  let totalOriginalDrift = 0;
  let totalResidualDrift = 0;
  for (const [, drift] of Object.entries(originalDrift.byParentId)) {
    totalOriginalDrift += Math.abs(drift.nightDelta) + Math.abs(drift.weekendDelta) * 0.5 + Math.abs(drift.holidayDelta) * 0.5;
  }
  for (const [, drift] of Object.entries(residualDrift)) {
    totalResidualDrift += Math.abs(drift.nightDelta) + Math.abs(drift.weekendDelta) * 0.5 + Math.abs(drift.holidayDelta) * 0.5;
  }

  let score: number;
  if (totalOriginalDrift === 0) {
    score = 1.0; // No drift to correct
  } else {
    // Fraction of drift that was corrected (partial is good)
    const corrected = Math.max(0, totalOriginalDrift - totalResidualDrift);
    score = corrected / totalOriginalDrift;
    // Cap at 0.8 to avoid rewarding aggressive correction over stability
    score = Math.min(score, 0.8) / 0.8;
  }

  return {
    score,
    restitutionNightCount,
    residualDrift: { byParentId: residualDrift },
  };
}
