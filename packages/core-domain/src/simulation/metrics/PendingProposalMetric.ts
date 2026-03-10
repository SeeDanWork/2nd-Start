import { SimulationExecutionContext } from '../types';

/**
 * Counts proposals still in PENDING status.
 */
export function computePendingProposalCount(context: SimulationExecutionContext): number {
  return context.proposals.filter(p => p.status === 'PENDING').length;
}
