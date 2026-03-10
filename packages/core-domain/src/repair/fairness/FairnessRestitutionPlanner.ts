import { DateTime } from 'luxon';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { RepairWindow, FairnessDriftSummary, RestitutionTarget } from '../types';

/**
 * Identifies deterministic restitution targets within the repair window.
 *
 * Priorities:
 *   - Prefer natural upcoming transitions (where parent already changes)
 *   - Prefer weekends over school nights
 *   - Prefer fewer total changed nights
 *   - Only targets dates within repair window
 */
export function identifyRestitutionTargets(input: {
  overlaidSchedule: ScheduleSnapshot;
  repairWindow: RepairWindow;
  driftSummary: FairnessDriftSummary;
}): RestitutionTarget[] {
  const { overlaidSchedule, repairWindow, driftSummary } = input;
  const targets: RestitutionTarget[] = [];

  // Find parents who lost nights (negative drift)
  const losers: { parentId: string; nightDelta: number }[] = [];
  const gainers: { parentId: string; nightDelta: number }[] = [];

  for (const [parentId, drift] of Object.entries(driftSummary.byParentId)) {
    if (drift.nightDelta < 0) losers.push({ parentId, nightDelta: drift.nightDelta });
    if (drift.nightDelta > 0) gainers.push({ parentId, nightDelta: drift.nightDelta });
  }

  if (losers.length === 0 || gainers.length === 0) return targets;

  // Sort deterministically
  losers.sort((a, b) => a.nightDelta - b.nightDelta || a.parentId.localeCompare(b.parentId));
  gainers.sort((a, b) => b.nightDelta - a.nightDelta || a.parentId.localeCompare(b.parentId));

  // Build night lookup for overlaid schedule within repair window
  const nightsByDate = new Map<string, Map<string, string>>();
  for (const night of overlaidSchedule.nights) {
    if (night.date < repairWindow.startDate || night.date > repairWindow.endDate) continue;
    if (!nightsByDate.has(night.date)) nightsByDate.set(night.date, new Map());
    nightsByDate.get(night.date)!.set(night.childId, night.parentId);
  }

  // Find dates in repair window where a gainer has nights that could be given to a loser
  const sortedDates = [...nightsByDate.keys()].sort();

  for (const date of sortedDates) {
    const assignments = nightsByDate.get(date)!;
    const dt = DateTime.fromISO(date);
    const isWeekend = dt.weekday === 5 || dt.weekday === 6;

    for (const [childId, currentParent] of [...assignments.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      // Check if current parent is a gainer
      const gainerEntry = gainers.find(g => g.parentId === currentParent);
      if (!gainerEntry) continue;

      // Find the best loser to receive this night
      for (const loser of losers) {
        if (loser.nightDelta >= 0) continue; // already restored

        // Priority: weekend > weekday, earlier dates > later dates
        const basePriority = isWeekend ? 10 : 5;
        // Earlier dates within window get slightly higher priority for gradual correction
        const dayIndex = sortedDates.indexOf(date);
        const positionBonus = sortedDates.length - dayIndex;

        targets.push({
          date,
          childId,
          fromParentId: currentParent,
          toParentId: loser.parentId,
          priority: basePriority + positionBonus,
          reason: `Restitution: ${loser.parentId} lost ${Math.abs(loser.nightDelta)} night(s) from disruptions`,
        });
        break; // one target per slot
      }
    }
  }

  // Sort by priority descending, then date, then childId
  targets.sort((a, b) => {
    const pd = b.priority - a.priority;
    if (pd !== 0) return pd;
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return a.childId.localeCompare(b.childId);
  });

  return targets;
}
