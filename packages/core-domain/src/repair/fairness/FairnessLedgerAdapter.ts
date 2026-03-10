import { FairnessDriftSummary } from '../types';

/**
 * Typed payload for updating FairnessLedger rows based on drift.
 */
export interface FairnessLedgerUpdate {
  parentId: string;
  nightDeviationDelta: number;
  weekendDeviationDelta: number;
  holidayDeviationDelta: number;
  reason: string;
  sourceType: string;
  sourceId?: string;
}

/**
 * Converts a drift summary into ledger update payloads.
 * Does not implement persistence — just provides typed adapters.
 */
export function driftToLedgerUpdates(
  driftSummary: FairnessDriftSummary,
  sourceType: string,
  sourceId?: string,
): FairnessLedgerUpdate[] {
  const updates: FairnessLedgerUpdate[] = [];

  const sortedParentIds = Object.keys(driftSummary.byParentId).sort();

  for (const parentId of sortedParentIds) {
    const drift = driftSummary.byParentId[parentId];
    if (drift.nightDelta === 0 && drift.weekendDelta === 0 && drift.holidayDelta === 0) continue;

    updates.push({
      parentId,
      nightDeviationDelta: drift.nightDelta,
      weekendDeviationDelta: drift.weekendDelta,
      holidayDeviationDelta: drift.holidayDelta,
      reason: `Drift from ${sourceType}`,
      sourceType,
      sourceId,
    });
  }

  return updates;
}
