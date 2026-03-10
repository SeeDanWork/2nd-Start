import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { NormalizedRepairInput } from '../types';

/**
 * Family structure objective for repair: rewards sibling cohesion.
 * Same principle as Phase 4 — single-child families get 1.0.
 *
 * Score range: [0, 1]
 */
export function computeRepairFamilyStructureScore(
  repairedSchedule: ScheduleSnapshot,
  input: NormalizedRepairInput,
): { score: number; splitNights: number; totalOpportunities: number } {
  if (input.childIds.length <= 1) {
    return { score: 1.0, splitNights: 0, totalOpportunities: 0 };
  }

  const repairDates = new Set(input.days.map(d => d.date));

  // Group nights by date within repair window
  const nightsByDate = new Map<string, Set<string>>();
  for (const night of repairedSchedule.nights) {
    if (!repairDates.has(night.date)) continue;
    if (!nightsByDate.has(night.date)) nightsByDate.set(night.date, new Set());
    nightsByDate.get(night.date)!.add(night.parentId);
  }

  let splitNights = 0;
  let totalOpportunities = 0;

  for (const [, parents] of nightsByDate) {
    if (parents.size <= 0) continue;
    totalOpportunities++;
    if (parents.size > 1) splitNights++;
  }

  if (totalOpportunities === 0) {
    return { score: 1.0, splitNights: 0, totalOpportunities: 0 };
  }

  return {
    score: 1 - splitNights / totalOpportunities,
    splitNights,
    totalOpportunities,
  };
}
