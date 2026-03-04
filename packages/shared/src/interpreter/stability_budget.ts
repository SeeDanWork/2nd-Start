// ─── Stability Budget ─────────────────────────────────────────────────
//
// Computes how many schedule changes have occurred in a rolling window.
// Pure function — takes previous assignments and current assignments.

import {
  DEFAULT_STABILITY_BUDGET_WINDOW_DAYS,
  DEFAULT_STABILITY_BUDGET_MAX_CHANGES,
} from '../constants';
import type { StabilityBudgetResult } from './types';

export interface AssignmentRecord {
  date: string;      // ISO date (YYYY-MM-DD)
  assignedTo: string; // 'parent_a' | 'parent_b'
}

/**
 * Compute the stability budget: count how many days differ between
 * the previous schedule version and the current one within the window.
 *
 * @param previousAssignments - Assignments from the previous schedule version
 * @param currentAssignments - Assignments from the current active schedule
 * @param referenceDate - The "now" date for the rolling window (ISO string)
 * @param windowDays - Window size (default: 28)
 * @param maxChanges - Max allowed changes (default: 8)
 */
export function computeStabilityBudget(
  previousAssignments: AssignmentRecord[],
  currentAssignments: AssignmentRecord[],
  referenceDate: string,
  windowDays: number = DEFAULT_STABILITY_BUDGET_WINDOW_DAYS,
  maxChanges: number = DEFAULT_STABILITY_BUDGET_MAX_CHANGES,
): StabilityBudgetResult {
  const refMs = new Date(referenceDate).getTime();
  const windowStartMs = refMs - windowDays * 24 * 3600_000;

  // Build lookup for previous assignments within window
  const prevMap = new Map<string, string>();
  for (const a of previousAssignments) {
    const dateMs = new Date(a.date).getTime();
    if (dateMs >= windowStartMs && dateMs <= refMs) {
      prevMap.set(a.date, a.assignedTo);
    }
  }

  // Count diffs
  let changedDays = 0;
  for (const a of currentAssignments) {
    const dateMs = new Date(a.date).getTime();
    if (dateMs >= windowStartMs && dateMs <= refMs) {
      const prev = prevMap.get(a.date);
      if (prev && prev !== a.assignedTo) {
        changedDays++;
      }
    }
  }

  return {
    changedDaysInWindow: changedDays,
    maxAllowedChanges: maxChanges,
    windowDays,
    budgetExceeded: changedDays >= maxChanges,
    remainingBudget: maxChanges - changedDays,
  };
}
