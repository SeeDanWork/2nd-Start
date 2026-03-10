import { FairnessLedgerState, FairnessDeltaBatch } from '../types';
import { FairnessValidationError } from '../errors';

/**
 * Applies delta batches to current ledger state.
 * Produces updated ledger state deterministically.
 */
export function applyDeltaBatch(input: {
  ledger: FairnessLedgerState;
  batch: FairnessDeltaBatch;
  allowUnknownParents?: boolean;
}): FairnessLedgerState {
  const { ledger, batch, allowUnknownParents = false } = input;

  if (batch.familyId !== ledger.familyId) {
    throw new FairnessValidationError(
      `Batch familyId ${batch.familyId} does not match ledger familyId ${ledger.familyId}`,
    );
  }

  // Deep copy current state
  const updated: FairnessLedgerState = {
    familyId: ledger.familyId,
    byParentId: {},
  };

  // Copy existing entries
  for (const [pid, entry] of Object.entries(ledger.byParentId)) {
    updated.byParentId[pid] = { ...entry };
  }

  // Apply deltas
  for (const delta of batch.deltas) {
    const existing = updated.byParentId[delta.parentId];

    if (!existing && !allowUnknownParents) {
      throw new FairnessValidationError(
        `Unknown parent ${delta.parentId} in delta batch; parent not in ledger`,
      );
    }

    if (!existing) {
      updated.byParentId[delta.parentId] = {
        nightDeviation: delta.nightDelta,
        weekendDeviation: delta.weekendDelta,
        holidayDeviation: delta.holidayDelta,
      };
    } else {
      existing.nightDeviation += delta.nightDelta;
      existing.weekendDeviation += delta.weekendDelta;
      existing.holidayDeviation += delta.holidayDelta;
    }
  }

  return updated;
}
