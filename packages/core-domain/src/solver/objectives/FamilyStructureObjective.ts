import { NormalizedSolverInput, CandidateNight } from '../types';

/**
 * Family structure objective: measures sibling cohesion.
 *
 * - Rewards nights where all siblings are with the same parent
 * - Penalizes unnecessary sibling splits
 * - Returns neutral (1.0) for single-child families
 *
 * Score range: [0, 1] normalized.
 */
export function computeFamilyStructureScore(
  nights: CandidateNight[],
  input: NormalizedSolverInput,
): { score: number; splitNights: number; totalSiblingOpportunities: number } {
  if (input.childIds.length <= 1) {
    return { score: 1.0, splitNights: 0, totalSiblingOpportunities: 0 };
  }

  // Group nights by date
  const nightsByDate = new Map<string, Map<string, string>>();
  for (const night of nights) {
    if (!nightsByDate.has(night.date)) {
      nightsByDate.set(night.date, new Map());
    }
    nightsByDate.get(night.date)!.set(night.childId, night.parentId);
  }

  let splitNights = 0;
  let totalSiblingOpportunities = 0;

  for (const day of input.days) {
    const assignments = nightsByDate.get(day.date);
    if (!assignments || assignments.size <= 1) continue;

    totalSiblingOpportunities++;
    const parentSet = new Set(assignments.values());
    if (parentSet.size > 1) {
      splitNights++;
    }
  }

  if (totalSiblingOpportunities === 0) {
    return { score: 1.0, splitNights: 0, totalSiblingOpportunities: 0 };
  }

  const score = 1 - splitNights / totalSiblingOpportunities;

  return { score, splitNights, totalSiblingOpportunities };
}
