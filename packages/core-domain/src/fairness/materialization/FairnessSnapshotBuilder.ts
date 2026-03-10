import { FairnessLedgerState, FairnessLedgerRow } from '../types';

/**
 * Materializes ledger rows into FairnessLedgerState.
 * Ensures stable parent ordering and zero-initialization.
 */
export function buildLedgerState(
  rows: FairnessLedgerRow[],
  parentIds: string[],
): FairnessLedgerState {
  if (rows.length === 0 && parentIds.length === 0) {
    return { familyId: '', byParentId: {} };
  }

  const familyId = rows[0]?.familyId ?? '';
  const state: FairnessLedgerState = { familyId, byParentId: {} };

  // Initialize all known parents with zeros
  const sortedParentIds = [...parentIds].sort();
  for (const pid of sortedParentIds) {
    state.byParentId[pid] = {
      nightDeviation: 0,
      weekendDeviation: 0,
      holidayDeviation: 0,
    };
  }

  // Apply row data, sorted deterministically
  const sortedRows = [...rows].sort((a, b) => a.parentId.localeCompare(b.parentId));
  for (const row of sortedRows) {
    state.byParentId[row.parentId] = {
      nightDeviation: row.nightDeviation,
      weekendDeviation: row.weekendDeviation,
      holidayDeviation: row.holidayDeviation,
      updatedAt: row.updatedAt,
    };
    if (!state.familyId) state.familyId = row.familyId;
  }

  return state;
}

/**
 * Creates an empty zero-initialized ledger state for all parents in a family.
 */
export function createEmptyLedgerState(
  familyId: string,
  parentIds: string[],
): FairnessLedgerState {
  const state: FairnessLedgerState = { familyId, byParentId: {} };

  const sortedParentIds = [...parentIds].sort();
  for (const pid of sortedParentIds) {
    state.byParentId[pid] = {
      nightDeviation: 0,
      weekendDeviation: 0,
      holidayDeviation: 0,
    };
  }

  return state;
}
