import { NormalizedSolverInput, CandidateNight } from '../types';

export interface FairnessScoreResult {
  total: number;
  nights: number;
  weekends: number;
  holidays: number;
}

/**
 * Composite fairness objective: measures equitable distribution of nights,
 * weekends, and holidays across parents.
 *
 * Assumes equal distribution target unless existing fairness state indicates otherwise.
 * Incorporates prior fairness deviations if available.
 *
 * Score range: [0, 1] normalized for each sub-score.
 */
export function computeFairnessScore(
  nights: CandidateNight[],
  input: NormalizedSolverInput,
): FairnessScoreResult {
  const nightFairness = computeNightFairness(nights, input);
  const weekendFairness = computeWeekendFairness(nights, input);
  const holidayFairness = computeHolidayFairness(nights, input);

  // Weighted average: nights most important, then weekends, then holidays
  const total = nightFairness * 0.5 + weekendFairness * 0.3 + holidayFairness * 0.2;

  return {
    total,
    nights: nightFairness,
    weekends: weekendFairness,
    holidays: holidayFairness,
  };
}

function computeNightFairness(
  nights: CandidateNight[],
  input: NormalizedSolverInput,
): number {
  if (input.parentIds.length <= 1) return 1.0;

  const counts = countByParent(nights, input.parentIds);
  const totalNights = nights.length;
  const target = totalNights / input.parentIds.length;

  // Incorporate prior deviation
  let maxDeviation = 0;
  for (const parentId of input.parentIds) {
    const count = counts.get(parentId) ?? 0;
    const priorDev = input.fairnessState.byParentId[parentId]?.nightDeviation ?? 0;
    const effectiveDeviation = Math.abs((count + priorDev) - target);
    maxDeviation = Math.max(maxDeviation, effectiveDeviation);
  }

  // Normalize: 0 deviation = 1.0, deviation >= totalNights = 0.0
  return Math.max(0, 1 - maxDeviation / Math.max(1, target));
}

function computeWeekendFairness(
  nights: CandidateNight[],
  input: NormalizedSolverInput,
): number {
  if (input.parentIds.length <= 1) return 1.0;

  const weekendDates = new Set(input.days.filter(d => d.isWeekend).map(d => d.date));
  const weekendNights = nights.filter(n => weekendDates.has(n.date));

  if (weekendNights.length === 0) return 1.0;

  const counts = countByParent(weekendNights, input.parentIds);
  const target = weekendNights.length / input.parentIds.length;

  let maxDeviation = 0;
  for (const parentId of input.parentIds) {
    const count = counts.get(parentId) ?? 0;
    const priorDev = input.fairnessState.byParentId[parentId]?.weekendDeviation ?? 0;
    const effectiveDeviation = Math.abs((count + priorDev) - target);
    maxDeviation = Math.max(maxDeviation, effectiveDeviation);
  }

  return Math.max(0, 1 - maxDeviation / Math.max(1, target));
}

function computeHolidayFairness(
  nights: CandidateNight[],
  input: NormalizedSolverInput,
): number {
  if (input.parentIds.length <= 1) return 1.0;
  if (input.holidayDateSet.size === 0) return 1.0;

  const holidayNights = nights.filter(n => input.holidayDateSet.has(n.date));
  if (holidayNights.length === 0) return 1.0;

  const counts = countByParent(holidayNights, input.parentIds);
  const target = holidayNights.length / input.parentIds.length;

  let maxDeviation = 0;
  for (const parentId of input.parentIds) {
    const count = counts.get(parentId) ?? 0;
    const priorDev = input.fairnessState.byParentId[parentId]?.holidayDeviation ?? 0;
    const effectiveDeviation = Math.abs((count + priorDev) - target);
    maxDeviation = Math.max(maxDeviation, effectiveDeviation);
  }

  return Math.max(0, 1 - maxDeviation / Math.max(1, target));
}

function countByParent(
  nights: CandidateNight[],
  parentIds: string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const parentId of parentIds) {
    counts.set(parentId, 0);
  }
  for (const night of nights) {
    counts.set(night.parentId, (counts.get(night.parentId) ?? 0) + 1);
  }
  return counts;
}
