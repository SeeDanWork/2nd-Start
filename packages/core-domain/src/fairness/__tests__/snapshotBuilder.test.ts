import { describe, it, expect } from 'vitest';
import { buildLedgerState, createEmptyLedgerState } from '../materialization/FairnessSnapshotBuilder';
import { makeLedgerRow, FAMILY_ID, PARENT_A, PARENT_B } from './helpers';

describe('FairnessSnapshotBuilder', () => {
  it('initializes empty ledger state for all parents', () => {
    const state = createEmptyLedgerState(FAMILY_ID, [PARENT_A, PARENT_B]);

    expect(state.familyId).toBe(FAMILY_ID);
    expect(Object.keys(state.byParentId)).toHaveLength(2);
    expect(state.byParentId[PARENT_A].nightDeviation).toBe(0);
    expect(state.byParentId[PARENT_A].weekendDeviation).toBe(0);
    expect(state.byParentId[PARENT_A].holidayDeviation).toBe(0);
    expect(state.byParentId[PARENT_B].nightDeviation).toBe(0);
  });

  it('materializes rows deterministically', () => {
    const rows = [
      makeLedgerRow(PARENT_B, { nightDeviation: 3, weekendDeviation: 1 }),
      makeLedgerRow(PARENT_A, { nightDeviation: -3, weekendDeviation: -1 }),
    ];

    const state = buildLedgerState(rows, [PARENT_A, PARENT_B]);

    expect(state.byParentId[PARENT_A].nightDeviation).toBe(-3);
    expect(state.byParentId[PARENT_A].weekendDeviation).toBe(-1);
    expect(state.byParentId[PARENT_B].nightDeviation).toBe(3);
    expect(state.byParentId[PARENT_B].weekendDeviation).toBe(1);

    // Parent ordering should be deterministic (sorted)
    const keys = Object.keys(state.byParentId);
    expect(keys).toEqual([...keys].sort());
  });

  it('preserves zero-state parents', () => {
    const rows = [
      makeLedgerRow(PARENT_A, { nightDeviation: 2 }),
    ];

    // PARENT_B has no row but is in parentIds
    const state = buildLedgerState(rows, [PARENT_A, PARENT_B]);

    expect(state.byParentId[PARENT_A].nightDeviation).toBe(2);
    expect(state.byParentId[PARENT_B].nightDeviation).toBe(0);
    expect(state.byParentId[PARENT_B].weekendDeviation).toBe(0);
  });

  it('handles empty rows and parentIds', () => {
    const state = buildLedgerState([], []);
    expect(state.familyId).toBe('');
    expect(Object.keys(state.byParentId)).toHaveLength(0);
  });
});
