import { FairnessDriftSummary } from '../../../repair/types';
import { FairnessDeltaBatch, FairnessDelta, FairnessEventType } from '../../types';

/**
 * Converts a Phase 5 FairnessDriftSummary into a FairnessDeltaBatch
 * suitable for recording overlay drift in the ledger.
 */
export function driftSummaryToDeltaBatch(input: {
  familyId: string;
  driftSummary: FairnessDriftSummary;
  sourceId?: string;
  effectiveDate: string;
  reason?: string;
}): FairnessDeltaBatch {
  const deltas: FairnessDelta[] = [];
  const sortedParentIds = Object.keys(input.driftSummary.byParentId).sort();

  for (const parentId of sortedParentIds) {
    const drift = input.driftSummary.byParentId[parentId];
    if (drift.nightDelta === 0 && drift.weekendDelta === 0 && drift.holidayDelta === 0) continue;

    deltas.push({
      parentId,
      nightDelta: drift.nightDelta,
      weekendDelta: drift.weekendDelta,
      holidayDelta: drift.holidayDelta,
    });
  }

  return {
    familyId: input.familyId,
    sourceType: 'OVERLAY',
    sourceId: input.sourceId,
    eventType: FairnessEventType.OVERLAY_DRIFT,
    effectiveDate: input.effectiveDate,
    reason: input.reason ?? 'Overlay drift',
    deltas,
  };
}
