import { describe, it, expect } from 'vitest';
import { driftSummaryToDeltaBatch } from '../core/adapters/RepairDriftAdapter';
import { ledgerStateToSolverFairnessState, solverFairnessStateToLedgerState } from '../core/adapters/SolverFairnessAdapter';
import { FairnessEventType } from '../types';
import { FAMILY_ID, PARENT_A, PARENT_B } from './helpers';

describe('RepairDriftAdapter', () => {
  it('converts repair drift summary into ledger delta batch correctly', () => {
    const batch = driftSummaryToDeltaBatch({
      familyId: FAMILY_ID,
      driftSummary: {
        byParentId: {
          [PARENT_A]: { nightDelta: -1, weekendDelta: 0, holidayDelta: 0 },
          [PARENT_B]: { nightDelta: 1, weekendDelta: 0, holidayDelta: 0 },
        },
      },
      sourceId: 'overlay-1',
      effectiveDate: '2026-03-04',
    });

    expect(batch.eventType).toBe(FairnessEventType.OVERLAY_DRIFT);
    expect(batch.familyId).toBe(FAMILY_ID);
    expect(batch.deltas).toHaveLength(2);

    const deltaA = batch.deltas.find(d => d.parentId === PARENT_A);
    expect(deltaA?.nightDelta).toBe(-1);
  });

  it('skips parents with zero drift', () => {
    const batch = driftSummaryToDeltaBatch({
      familyId: FAMILY_ID,
      driftSummary: {
        byParentId: {
          [PARENT_A]: { nightDelta: 0, weekendDelta: 0, holidayDelta: 0 },
          [PARENT_B]: { nightDelta: 1, weekendDelta: 0, holidayDelta: 0 },
        },
      },
      effectiveDate: '2026-03-04',
    });

    expect(batch.deltas).toHaveLength(1);
    expect(batch.deltas[0].parentId).toBe(PARENT_B);
  });
});

describe('SolverFairnessAdapter', () => {
  it('converts ledger state into solver fairness state correctly', () => {
    const solverState = ledgerStateToSolverFairnessState({
      familyId: FAMILY_ID,
      byParentId: {
        [PARENT_A]: { nightDeviation: -3, weekendDeviation: -1, holidayDeviation: 0 },
        [PARENT_B]: { nightDeviation: 3, weekendDeviation: 1, holidayDeviation: 0 },
      },
    });

    expect(solverState.byParentId[PARENT_A].nightDeviation).toBe(-3);
    expect(solverState.byParentId[PARENT_B].weekendDeviation).toBe(1);
  });

  it('roundtrips solver state through ledger state', () => {
    const original = {
      byParentId: {
        [PARENT_A]: { nightDeviation: -2, weekendDeviation: 0, holidayDeviation: -1 },
        [PARENT_B]: { nightDeviation: 2, weekendDeviation: 0, holidayDeviation: 1 },
      },
    };

    const ledger = solverFairnessStateToLedgerState(FAMILY_ID, original);
    const roundtripped = ledgerStateToSolverFairnessState(ledger);

    expect(roundtripped.byParentId[PARENT_A]).toEqual(original.byParentId[PARENT_A]);
    expect(roundtripped.byParentId[PARENT_B]).toEqual(original.byParentId[PARENT_B]);
  });
});
