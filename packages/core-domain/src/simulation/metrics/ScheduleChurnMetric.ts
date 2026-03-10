import { SimulationExecutionContext } from '../types';

/**
 * Measures how many night assignments changed between consecutive schedule versions.
 * churnRate = changedNights / totalNights
 */
export function computeScheduleChurnRate(context: SimulationExecutionContext): number {
  const prev = context.previousScheduleNights;
  if (!prev || prev.length === 0) return 0;

  const current = context.activeScheduleNights;
  if (current.length === 0) return 0;

  let changed = 0;
  for (const night of current) {
    const match = prev.find(p => p.date === night.date && p.childId === night.childId);
    if (!match || match.parentId !== night.parentId) {
      changed++;
    }
  }

  return current.length > 0 ? changed / current.length : 0;
}
