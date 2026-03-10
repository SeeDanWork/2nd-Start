import { ProposalArtifact, ProposalReviewBundle } from '../types';
import {
  buildDiffArtifact,
  buildChangedNightArtifact,
  buildExchangeArtifact,
} from './ProposalArtifactBuilder';

/**
 * Builds review-focused artifacts from a review bundle.
 */
export function buildReviewArtifacts(bundle: ProposalReviewBundle): ProposalArtifact[] {
  const artifacts: ProposalArtifact[] = [];

  artifacts.push(buildDiffArtifact(bundle.diff));

  if (bundle.diff.changedNights.length > 0) {
    artifacts.push(buildChangedNightArtifact(bundle.diff));
  }

  if (bundle.diff.addedExchanges.length > 0 ||
      bundle.diff.removedExchanges.length > 0 ||
      bundle.diff.changedExchanges.length > 0) {
    artifacts.push(buildExchangeArtifact(bundle.diff));
  }

  if (bundle.scoreSummary.totalScore !== undefined) {
    artifacts.push({
      type: 'SCORE_SUMMARY',
      data: bundle.scoreSummary as unknown as Record<string, unknown>,
    });
  }

  if (bundle.fairnessSummary) {
    artifacts.push({
      type: 'FAIRNESS_SUMMARY',
      data: bundle.fairnessSummary as unknown as Record<string, unknown>,
    });
  }

  return artifacts;
}
