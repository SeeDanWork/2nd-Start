import { NormalizedSolverInput, CandidateNight, CandidateExchange } from '../types';

/**
 * Stability objective: measures how much a candidate deviates from the baseline.
 *
 * - Rewards unchanged nights
 * - Penalizes changed nights and exchange churn
 * - Returns neutral (1.0) when no baseline exists
 *
 * Score range: [0, 1] normalized.
 */
export function computeStabilityScore(
  nights: CandidateNight[],
  exchanges: CandidateExchange[],
  input: NormalizedSolverInput,
): { score: number; changedNights: number; changedExchanges: number } {
  if (input.baselineNightLookup.size === 0) {
    return { score: 1.0, changedNights: 0, changedExchanges: 0 };
  }

  let changedNights = 0;
  let totalComparableNights = 0;

  for (const night of nights) {
    const key = `${night.date}:${night.childId}`;
    const baselineParent = input.baselineNightLookup.get(key);
    if (baselineParent !== undefined) {
      totalComparableNights++;
      if (night.parentId !== baselineParent) {
        changedNights++;
      }
    }
  }

  // Exchange churn: count new exchanges not in baseline
  let changedExchanges = 0;
  for (const exchange of exchanges) {
    const key = `${exchange.date}:${exchange.childId}`;
    if (!input.baselineExchangeLookup.has(key)) {
      changedExchanges++;
    }
  }

  if (totalComparableNights === 0) {
    return { score: 1.0, changedNights: 0, changedExchanges };
  }

  // Night stability: fraction unchanged
  const nightStability = 1 - changedNights / totalComparableNights;

  // Exchange churn penalty (smaller weight)
  const maxExpectedExchanges = Math.max(1, totalComparableNights / 2);
  const exchangePenalty = Math.min(changedExchanges / maxExpectedExchanges, 1) * 0.2;

  const score = Math.max(0, nightStability - exchangePenalty);

  return { score, changedNights, changedExchanges };
}
