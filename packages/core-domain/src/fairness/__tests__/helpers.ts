import { FairnessLedgerState, FairnessLedgerRow, FairnessDelta, FairnessDeltaBatch, FairnessEventType } from '../types';

export const FAMILY_ID = 'family-1';
export const PARENT_A = 'parent-a';
export const PARENT_B = 'parent-b';

export function makeEmptyLedger(parentIds: string[] = [PARENT_A, PARENT_B]): FairnessLedgerState {
  const state: FairnessLedgerState = { familyId: FAMILY_ID, byParentId: {} };
  for (const pid of parentIds) {
    state.byParentId[pid] = { nightDeviation: 0, weekendDeviation: 0, holidayDeviation: 0 };
  }
  return state;
}

export function makeLedger(
  deviations: Record<string, { night: number; weekend: number; holiday: number }>,
): FairnessLedgerState {
  const state: FairnessLedgerState = { familyId: FAMILY_ID, byParentId: {} };
  for (const [pid, dev] of Object.entries(deviations)) {
    state.byParentId[pid] = {
      nightDeviation: dev.night,
      weekendDeviation: dev.weekend,
      holidayDeviation: dev.holiday,
    };
  }
  return state;
}

export function makeLedgerRow(parentId: string, overrides?: Partial<FairnessLedgerRow>): FairnessLedgerRow {
  return {
    id: `row-${parentId}`,
    familyId: FAMILY_ID,
    parentId,
    nightDeviation: 0,
    weekendDeviation: 0,
    holidayDeviation: 0,
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeDeltaBatch(overrides?: Partial<FairnessDeltaBatch>): FairnessDeltaBatch {
  return {
    familyId: FAMILY_ID,
    sourceType: 'OVERLAY',
    sourceId: 'overlay-1',
    eventType: FairnessEventType.OVERLAY_DRIFT,
    effectiveDate: '2026-03-04',
    reason: 'Test drift',
    deltas: [
      { parentId: PARENT_A, nightDelta: -1, weekendDelta: 0, holidayDelta: 0 },
      { parentId: PARENT_B, nightDelta: 1, weekendDelta: 0, holidayDelta: 0 },
    ],
    ...overrides,
  };
}
