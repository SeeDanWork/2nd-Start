import {
  FairnessLedgerState,
  FairnessDeltaBatch,
  FairnessProjectionResult,
  FairnessArtifact,
} from '../types';

/**
 * Creates structured artifacts for debugging and explanation use.
 */
export function buildFairnessArtifacts(input: {
  currentState?: FairnessLedgerState;
  eventBatch?: FairnessDeltaBatch;
  projection?: FairnessProjectionResult;
}): FairnessArtifact[] {
  const artifacts: FairnessArtifact[] = [];

  if (input.currentState) {
    const sortedParentIds = Object.keys(input.currentState.byParentId).sort();
    artifacts.push({
      type: 'CURRENT_DEVIATION_SUMMARY',
      data: {
        familyId: input.currentState.familyId,
        deviations: sortedParentIds.map(pid => ({
          parentId: pid,
          ...input.currentState!.byParentId[pid],
        })),
      },
    });
  }

  if (input.eventBatch) {
    artifacts.push({
      type: 'EVENT_BATCH_SUMMARY',
      data: {
        familyId: input.eventBatch.familyId,
        eventType: input.eventBatch.eventType,
        sourceType: input.eventBatch.sourceType,
        sourceId: input.eventBatch.sourceId,
        effectiveDate: input.eventBatch.effectiveDate,
        reason: input.eventBatch.reason,
        deltaCount: input.eventBatch.deltas.length,
        deltas: input.eventBatch.deltas,
      },
    });
  }

  if (input.projection) {
    const sortedParentIds = Object.keys(input.projection.projectedState.byParentId).sort();
    artifacts.push({
      type: 'PROJECTED_RESTITUTION_SUMMARY',
      data: {
        familyId: input.projection.familyId,
        projectedDeviations: sortedParentIds.map(pid => ({
          parentId: pid,
          ...input.projection!.projectedState.byParentId[pid],
        })),
        projectionDeltas: input.projection.projectionDeltas,
        summary: input.projection.summary,
      },
    });
  }

  return artifacts;
}
