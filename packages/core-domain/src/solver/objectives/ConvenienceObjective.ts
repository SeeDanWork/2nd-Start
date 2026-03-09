import { NormalizedSolverInput, CandidateNight, CandidateExchange } from '../types';

/**
 * Convenience objective (placeholder).
 *
 * Returns neutral score (1.0) until convenience signals
 * (exchange count minimization, transition smoothness) are modeled.
 */
export function computeConvenienceScore(
  _nights: CandidateNight[],
  _exchanges: CandidateExchange[],
  _input: NormalizedSolverInput,
): number {
  return 1.0;
}
