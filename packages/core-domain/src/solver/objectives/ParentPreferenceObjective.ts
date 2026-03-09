import { NormalizedSolverInput, CandidateNight } from '../types';

/**
 * Parent preference objective (placeholder).
 *
 * Returns neutral score (1.0) until parent preference data is modeled.
 * Architecture is real and extensible — this module will incorporate
 * preferred days, time-of-week preferences, and custom scheduling wishes.
 */
export function computeParentPreferenceScore(
  _nights: CandidateNight[],
  _input: NormalizedSolverInput,
): number {
  return 1.0;
}
