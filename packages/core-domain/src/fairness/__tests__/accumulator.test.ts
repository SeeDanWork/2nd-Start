import { describe, it, expect } from 'vitest';
import { applyDeltaBatch } from '../ledger/FairnessLedgerAccumulator';
import { makeEmptyLedger, makeLedger, makeDeltaBatch, FAMILY_ID, PARENT_A, PARENT_B } from './helpers';

describe('FairnessLedgerAccumulator', () => {
  it('applies positive and negative deltas correctly', () => {
    const ledger = makeEmptyLedger();
    const batch = makeDeltaBatch({
      deltas: [
        { parentId: PARENT_A, nightDelta: -2, weekendDelta: -1, holidayDelta: 0 },
        { parentId: PARENT_B, nightDelta: 2, weekendDelta: 1, holidayDelta: 0 },
      ],
    });

    const updated = applyDeltaBatch({ ledger, batch });

    expect(updated.byParentId[PARENT_A].nightDeviation).toBe(-2);
    expect(updated.byParentId[PARENT_A].weekendDeviation).toBe(-1);
    expect(updated.byParentId[PARENT_B].nightDeviation).toBe(2);
    expect(updated.byParentId[PARENT_B].weekendDeviation).toBe(1);
  });

  it('accumulates on existing state', () => {
    const ledger = makeLedger({
      [PARENT_A]: { night: -3, weekend: 0, holiday: 0 },
      [PARENT_B]: { night: 3, weekend: 0, holiday: 0 },
    });
    const batch = makeDeltaBatch({
      deltas: [
        { parentId: PARENT_A, nightDelta: 1, weekendDelta: 0, holidayDelta: 0 },
        { parentId: PARENT_B, nightDelta: -1, weekendDelta: 0, holidayDelta: 0 },
      ],
    });

    const updated = applyDeltaBatch({ ledger, batch });

    expect(updated.byParentId[PARENT_A].nightDeviation).toBe(-2);
    expect(updated.byParentId[PARENT_B].nightDeviation).toBe(2);
  });

  it('initializes missing parent rows when allowed', () => {
    const ledger = makeEmptyLedger([PARENT_A]);
    const batch = makeDeltaBatch({
      deltas: [
        { parentId: PARENT_B, nightDelta: 1, weekendDelta: 0, holidayDelta: 0 },
      ],
    });

    const updated = applyDeltaBatch({ ledger, batch, allowUnknownParents: true });

    expect(updated.byParentId[PARENT_B].nightDeviation).toBe(1);
  });

  it('rejects unknown parents when not allowed', () => {
    const ledger = makeEmptyLedger([PARENT_A]);
    const batch = makeDeltaBatch({
      deltas: [
        { parentId: PARENT_B, nightDelta: 1, weekendDelta: 0, holidayDelta: 0 },
      ],
    });

    expect(() => applyDeltaBatch({ ledger, batch })).toThrow('Unknown parent');
  });

  it('rejects mismatched familyId', () => {
    const ledger = makeEmptyLedger();
    const batch = makeDeltaBatch({ familyId: 'other-family' });

    expect(() => applyDeltaBatch({ ledger, batch })).toThrow('does not match');
  });

  it('deterministic output ordering', () => {
    const ledger = makeEmptyLedger();
    const batch = makeDeltaBatch();

    const r1 = applyDeltaBatch({ ledger, batch });
    const r2 = applyDeltaBatch({ ledger, batch });

    expect(r1).toEqual(r2);
  });
});
