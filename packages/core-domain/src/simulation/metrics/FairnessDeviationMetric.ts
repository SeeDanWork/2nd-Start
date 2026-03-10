import { SimulationExecutionContext } from '../types';

/**
 * Computes the magnitude of fairness deviation across all parents.
 * Returns the max absolute deviation across night/weekend/holiday dimensions.
 */
export function computeFairnessDeviationMagnitude(context: SimulationExecutionContext): number {
  let maxDeviation = 0;

  for (const data of Object.values(context.fairnessLedger)) {
    const mag = Math.max(
      Math.abs(data.nightDeviation),
      Math.abs(data.weekendDeviation),
      Math.abs(data.holidayDeviation),
    );
    maxDeviation = Math.max(maxDeviation, mag);
  }

  return maxDeviation;
}
