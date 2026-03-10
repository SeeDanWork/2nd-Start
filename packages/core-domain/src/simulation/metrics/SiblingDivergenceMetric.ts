import { SimulationExecutionContext } from '../types';

/**
 * Measures how often siblings are split across parents on the same night.
 * divergenceRate = nightsWithSplit / totalNightsChecked
 */
export function computeSiblingDivergenceRate(context: SimulationExecutionContext): number {
  const nights = context.activeScheduleNights;
  if (nights.length === 0) return 0;

  // Group by date
  const byDate = new Map<string, Array<{ childId: string; parentId: string }>>();
  for (const n of nights) {
    if (!byDate.has(n.date)) byDate.set(n.date, []);
    byDate.get(n.date)!.push({ childId: n.childId, parentId: n.parentId });
  }

  let splitNights = 0;
  let totalDates = 0;

  for (const [, dateNights] of byDate) {
    if (dateNights.length <= 1) continue; // Single child, no divergence possible
    totalDates++;
    const parents = new Set(dateNights.map(n => n.parentId));
    if (parents.size > 1) splitNights++;
  }

  return totalDates > 0 ? splitNights / totalDates : 0;
}
