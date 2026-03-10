import { ProposalArtifact, ProposalAcceptanceResult } from '../types';
import { ScheduleDiff } from '../../diff';

/**
 * Builds structured proposal artifacts from various data sources.
 */
export function buildDiffArtifact(diff: ScheduleDiff): ProposalArtifact {
  return {
    type: 'DIFF_SUMMARY',
    data: {
      changedNightCount: diff.summary.changedNightCount,
      changedExchangeCount: diff.summary.changedExchangeCount,
      affectedChildren: diff.summary.affectedChildren,
      affectedDates: diff.summary.affectedDates,
    },
  };
}

export function buildChangedNightArtifact(diff: ScheduleDiff): ProposalArtifact {
  return {
    type: 'CHANGED_NIGHT_SUMMARY',
    data: {
      nights: diff.changedNights,
    },
  };
}

export function buildExchangeArtifact(diff: ScheduleDiff): ProposalArtifact {
  return {
    type: 'EXCHANGE_SUMMARY',
    data: {
      added: diff.addedExchanges,
      removed: diff.removedExchanges,
      changed: diff.changedExchanges,
    },
  };
}

export function buildScoreArtifact(scoreBreakdown: Record<string, unknown>): ProposalArtifact {
  return {
    type: 'SCORE_SUMMARY',
    data: scoreBreakdown,
  };
}

export function buildFairnessArtifact(fairnessProjection: Record<string, unknown>): ProposalArtifact {
  return {
    type: 'FAIRNESS_SUMMARY',
    data: fairnessProjection,
  };
}

export function buildAcceptanceArtifact(result: ProposalAcceptanceResult): ProposalArtifact {
  return {
    type: 'ACCEPTANCE_OUTCOME',
    data: {
      newScheduleVersionId: result.newScheduleVersionId,
      newVersionNumber: result.newVersionNumber,
      archivedScheduleVersionId: result.archivedScheduleVersionId,
      invalidatedProposalCount: result.invalidatedProposalIds.length,
      resolvedOverlayCount: result.resolvedOverlayIds.length,
    },
  };
}
