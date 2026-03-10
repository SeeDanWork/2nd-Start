import { FairnessState } from '../../../solver/types';
import { FairnessLedgerState } from '../../types';

/**
 * Converts FairnessLedgerState (Phase 6) into FairnessState (Phase 4/5)
 * for solver input.
 */
export function ledgerStateToSolverFairnessState(
  ledger: FairnessLedgerState,
): FairnessState {
  const state: FairnessState = { byParentId: {} };

  const sortedParentIds = Object.keys(ledger.byParentId).sort();
  for (const pid of sortedParentIds) {
    const entry = ledger.byParentId[pid];
    state.byParentId[pid] = {
      nightDeviation: entry.nightDeviation,
      weekendDeviation: entry.weekendDeviation,
      holidayDeviation: entry.holidayDeviation,
    };
  }

  return state;
}

/**
 * Converts FairnessState (Phase 4/5) into FairnessLedgerState (Phase 6).
 */
export function solverFairnessStateToLedgerState(
  familyId: string,
  state: FairnessState,
): FairnessLedgerState {
  const ledger: FairnessLedgerState = { familyId, byParentId: {} };

  const sortedParentIds = Object.keys(state.byParentId).sort();
  for (const pid of sortedParentIds) {
    const entry = state.byParentId[pid];
    ledger.byParentId[pid] = {
      nightDeviation: entry.nightDeviation,
      weekendDeviation: entry.weekendDeviation,
      holidayDeviation: entry.holidayDeviation,
    };
  }

  return ledger;
}
