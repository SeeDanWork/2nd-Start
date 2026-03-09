import { NormalizedSolverInput, CandidateNight } from '../types';

/**
 * Child preference objective (placeholder).
 *
 * Returns neutral score (1.0) until child preference data is modeled.
 * Architecture is real and extensible — this module will incorporate
 * age-appropriate scheduling signals, activity preferences, and school schedules.
 */
export function computeChildPreferenceScore(
  _nights: CandidateNight[],
  _input: NormalizedSolverInput,
): number {
  return 1.0;
}
