import { NormalizedSolverInput, CandidateExchange } from '../types';

/**
 * Logistics objective (placeholder).
 *
 * Returns neutral score (1.0) until logistics data (travel distances,
 * exchange locations, travel duration) is modeled.
 */
export function computeLogisticsScore(
  _exchanges: CandidateExchange[],
  _input: NormalizedSolverInput,
): number {
  return 1.0;
}
