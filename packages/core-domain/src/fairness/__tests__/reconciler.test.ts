import { describe, it, expect } from 'vitest';
import { reconcileAcceptedScheduleChange } from '../ledger/FairnessLedgerReconciler';
import { makeEmptyLedger, FAMILY_ID, PARENT_A, PARENT_B } from './helpers';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { ScheduleId, FamilyId, ChildId, ParentId } from '../../types';

const CHILD_1 = 'child-1';

function makeSchedule(nights: Array<{ date: string; childId: string; parentId: string }>): ScheduleSnapshot {
  return {
    scheduleVersionId: 'sv-1' as ScheduleId,
    familyId: FAMILY_ID as FamilyId,
    startDate: nights[0]?.date ?? '2026-03-01',
    endDate: nights[nights.length - 1]?.date ?? '2026-03-01',
    nights: nights.map((n, i) => ({
      id: `n-${i}`,
      scheduleId: 'sv-1' as ScheduleId,
      date: n.date,
      childId: n.childId as ChildId,
      parentId: n.parentId as ParentId,
      createdAt: new Date(),
    })),
    exchanges: [],
  };
}

describe('FairnessLedgerReconciler', () => {
  it('reconciles accepted schedule changes into net delta batch', () => {
    const prior = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-04', childId: CHILD_1, parentId: PARENT_B },
    ]);
    const accepted = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_B }, // changed
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-04', childId: CHILD_1, parentId: PARENT_B },
    ]);

    const batch = reconcileAcceptedScheduleChange({
      familyId: FAMILY_ID,
      previousLedger: makeEmptyLedger(),
      priorActiveSchedule: prior,
      acceptedSchedule: accepted,
      sourceType: 'PROPOSAL',
      sourceId: 'proposal-1',
      effectiveDate: '2026-03-02',
    });

    expect(batch.eventType).toBe('PROPOSAL_ACCEPTANCE_RECONCILIATION');
    expect(batch.deltas).toHaveLength(2);

    const deltaA = batch.deltas.find(d => d.parentId === PARENT_A);
    const deltaB = batch.deltas.find(d => d.parentId === PARENT_B);
    expect(deltaA?.nightDelta).toBe(-1);
    expect(deltaB?.nightDelta).toBe(1);
  });

  it('returns empty deltas when schedules are identical', () => {
    const schedule = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
    ]);

    const batch = reconcileAcceptedScheduleChange({
      familyId: FAMILY_ID,
      previousLedger: makeEmptyLedger(),
      priorActiveSchedule: schedule,
      acceptedSchedule: schedule,
      sourceType: 'PROPOSAL',
      effectiveDate: '2026-03-02',
    });

    expect(batch.deltas).toHaveLength(0);
  });

  it('deterministic output', () => {
    const prior = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
    ]);
    const accepted = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_B },
    ]);

    const r1 = reconcileAcceptedScheduleChange({
      familyId: FAMILY_ID,
      previousLedger: makeEmptyLedger(),
      priorActiveSchedule: prior,
      acceptedSchedule: accepted,
      sourceType: 'PROPOSAL',
      effectiveDate: '2026-03-02',
    });
    const r2 = reconcileAcceptedScheduleChange({
      familyId: FAMILY_ID,
      previousLedger: makeEmptyLedger(),
      priorActiveSchedule: prior,
      acceptedSchedule: accepted,
      sourceType: 'PROPOSAL',
      effectiveDate: '2026-03-02',
    });

    expect(r1).toEqual(r2);
  });

  it('rejects missing familyId', () => {
    const s = makeSchedule([{ date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A }]);
    expect(() => reconcileAcceptedScheduleChange({
      familyId: '',
      previousLedger: makeEmptyLedger(),
      priorActiveSchedule: s,
      acceptedSchedule: s,
      sourceType: 'PROPOSAL',
      effectiveDate: '2026-03-02',
    })).toThrow('familyId is required');
  });
});
