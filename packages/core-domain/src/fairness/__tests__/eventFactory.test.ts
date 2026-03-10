import { describe, it, expect } from 'vitest';
import { fromOverlayDrift, fromRepairRestitution, fromManualAdjustment } from '../ledger/FairnessEventFactory';
import { FairnessEventType } from '../types';
import { FAMILY_ID, PARENT_A, PARENT_B } from './helpers';

describe('FairnessEventFactory', () => {
  it('builds overlay drift batch correctly', () => {
    const batch = fromOverlayDrift({
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
    expect(batch.sourceType).toBe('OVERLAY');
    expect(batch.deltas).toHaveLength(2);
    expect(batch.deltas[0].parentId).toBe(PARENT_A);
    expect(batch.deltas[0].nightDelta).toBe(-1);
    expect(batch.deltas[1].parentId).toBe(PARENT_B);
    expect(batch.deltas[1].nightDelta).toBe(1);
  });

  it('skips zero-drift parents in overlay batch', () => {
    const batch = fromOverlayDrift({
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

  it('builds restitution batch correctly', () => {
    const batch = fromRepairRestitution({
      familyId: FAMILY_ID,
      originalDrift: {
        byParentId: {
          [PARENT_A]: { nightDelta: -2, weekendDelta: 0, holidayDelta: 0 },
          [PARENT_B]: { nightDelta: 2, weekendDelta: 0, holidayDelta: 0 },
        },
      },
      residualDrift: {
        byParentId: {
          [PARENT_A]: { nightDelta: -1, weekendDelta: 0, holidayDelta: 0 },
          [PARENT_B]: { nightDelta: 1, weekendDelta: 0, holidayDelta: 0 },
        },
      },
      effectiveDate: '2026-03-10',
    });

    expect(batch.eventType).toBe(FairnessEventType.REPAIR_RESTITUTION);
    expect(batch.deltas).toHaveLength(2);
    // Correction of 1 night each: original(-2) - residual(-1) = -1, negated = +1
    expect(batch.deltas[0].parentId).toBe(PARENT_A);
    expect(batch.deltas[0].nightDelta).toBe(1);
    expect(batch.deltas[1].parentId).toBe(PARENT_B);
    expect(batch.deltas[1].nightDelta).toBe(-1);
  });

  it('builds manual adjustment batch deterministically', () => {
    const batch = fromManualAdjustment({
      familyId: FAMILY_ID,
      deltas: [
        { parentId: PARENT_B, nightDelta: -1, weekendDelta: 0, holidayDelta: 0 },
        { parentId: PARENT_A, nightDelta: 1, weekendDelta: 0, holidayDelta: 0 },
      ],
      effectiveDate: '2026-03-10',
      reason: 'Manual correction',
    });

    expect(batch.eventType).toBe(FairnessEventType.MANUAL_ADJUSTMENT);
    // Deltas should be sorted by parentId
    expect(batch.deltas[0].parentId).toBe(PARENT_A);
    expect(batch.deltas[1].parentId).toBe(PARENT_B);
  });

  it('rejects missing familyId', () => {
    expect(() => fromOverlayDrift({
      familyId: '',
      driftSummary: { byParentId: {} },
      effectiveDate: '2026-03-04',
    })).toThrow('familyId is required');
  });

  it('rejects missing effectiveDate', () => {
    expect(() => fromManualAdjustment({
      familyId: FAMILY_ID,
      deltas: [],
      effectiveDate: '',
    })).toThrow('effectiveDate is required');
  });
});
