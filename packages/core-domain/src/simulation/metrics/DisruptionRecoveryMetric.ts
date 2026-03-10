import { SimulationExecutionContext } from '../types';

/**
 * Counts unresolved overlays — disruptions that haven't been repaired yet.
 */
export function computeDisruptionRecoveryOpenCount(context: SimulationExecutionContext): number {
  return context.appliedOverlays.length;
}
