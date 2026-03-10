import {
  FairnessProjectionInput,
  FairnessProjectionResult,
  FairnessDelta,
} from '../types';
import { FairnessProjectionError } from '../errors';
import { calculateScheduleDelta } from './ScheduleFairnessDeltaCalculator';

/**
 * Projects how a candidate schedule would change current ledger state.
 * This is for solver scoring and reasoning, not persistence.
 */
export function project(input: FairnessProjectionInput): FairnessProjectionResult {
  if (!input.familyId) {
    throw new FairnessProjectionError('familyId is required for projection');
  }

  let projectionDeltas: FairnessDelta[];

  if (input.candidateSchedule) {
    projectionDeltas = calculateScheduleDelta({
      activeSchedule: input.activeSchedule,
      candidateSchedule: input.candidateSchedule,
    });
  } else {
    projectionDeltas = [];
  }

  // Apply deltas to current ledger to build projected state
  const projectedState = {
    familyId: input.familyId,
    byParentId: {} as Record<string, {
      nightDeviation: number;
      weekendDeviation: number;
      holidayDeviation: number;
    }>,
  };

  // Copy current state
  for (const [pid, entry] of Object.entries(input.currentLedger.byParentId)) {
    projectedState.byParentId[pid] = { ...entry };
  }

  // Apply projection deltas
  for (const delta of projectionDeltas) {
    const existing = projectedState.byParentId[delta.parentId];
    if (existing) {
      existing.nightDeviation += delta.nightDelta;
      existing.weekendDeviation += delta.weekendDelta;
      existing.holidayDeviation += delta.holidayDelta;
    } else {
      projectedState.byParentId[delta.parentId] = {
        nightDeviation: delta.nightDelta,
        weekendDeviation: delta.weekendDelta,
        holidayDeviation: delta.holidayDelta,
      };
    }
  }

  // Build summary
  let totalNightMag = 0;
  let totalWeekendMag = 0;
  let totalHolidayMag = 0;

  for (const entry of Object.values(projectedState.byParentId)) {
    totalNightMag += Math.abs(entry.nightDeviation);
    totalWeekendMag += Math.abs(entry.weekendDeviation);
    totalHolidayMag += Math.abs(entry.holidayDeviation);
  }

  return {
    familyId: input.familyId,
    projectedState,
    projectionDeltas,
    summary: {
      totalNightDeviationMagnitude: totalNightMag,
      totalWeekendDeviationMagnitude: totalWeekendMag,
      totalHolidayDeviationMagnitude: totalHolidayMag,
    },
  };
}
