import { SimulationExecutionContext } from '../types';

/**
 * Counts parent-to-parent transitions across all children in the active schedule.
 * A transition occurs when consecutive nights for a child have different parents.
 */
export function computeAverageTransitionCount(context: SimulationExecutionContext): number {
  const nights = context.activeScheduleNights;
  if (nights.length === 0) return 0;

  // Group nights by child
  const byChild = new Map<string, Array<{ date: string; parentId: string }>>();
  for (const n of nights) {
    if (!byChild.has(n.childId)) byChild.set(n.childId, []);
    byChild.get(n.childId)!.push({ date: n.date, parentId: n.parentId });
  }

  let totalTransitions = 0;
  let childCount = 0;

  for (const [, childNights] of byChild) {
    childNights.sort((a, b) => a.date.localeCompare(b.date));
    let transitions = 0;
    for (let i = 1; i < childNights.length; i++) {
      if (childNights[i].parentId !== childNights[i - 1].parentId) {
        transitions++;
      }
    }
    totalTransitions += transitions;
    childCount++;
  }

  return childCount > 0 ? totalTransitions / childCount : 0;
}
