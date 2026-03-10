import { describe, it, expect } from 'vitest';
import { calculateScheduleDelta } from '../projection/ScheduleFairnessDeltaCalculator';
import { project } from '../projection/FairnessProjectionEngine';
import { makeEmptyLedger, makeLedger, FAMILY_ID, PARENT_A, PARENT_B } from './helpers';
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

describe('ScheduleFairnessDeltaCalculator', () => {
  it('candidate schedule gain/loss updates night deviations correctly', () => {
    const active = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-04', childId: CHILD_1, parentId: PARENT_B },
    ]);
    const candidate = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_B }, // changed
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-04', childId: CHILD_1, parentId: PARENT_B },
    ]);

    const deltas = calculateScheduleDelta({ activeSchedule: active, candidateSchedule: candidate });

    const deltaA = deltas.find(d => d.parentId === PARENT_A);
    const deltaB = deltas.find(d => d.parentId === PARENT_B);
    expect(deltaA?.nightDelta).toBe(-1);
    expect(deltaB?.nightDelta).toBe(1);
  });

  it('weekend deviations update when affected', () => {
    // 2026-03-06 is Friday (weekday 5 in Luxon)
    const active = makeSchedule([
      { date: '2026-03-06', childId: CHILD_1, parentId: PARENT_A },
    ]);
    const candidate = makeSchedule([
      { date: '2026-03-06', childId: CHILD_1, parentId: PARENT_B },
    ]);

    const deltas = calculateScheduleDelta({ activeSchedule: active, candidateSchedule: candidate });

    const deltaA = deltas.find(d => d.parentId === PARENT_A);
    const deltaB = deltas.find(d => d.parentId === PARENT_B);
    expect(deltaA?.weekendDelta).toBe(-1);
    expect(deltaB?.weekendDelta).toBe(1);
  });

  it('neutral projection returned when candidate equals active baseline', () => {
    const schedule = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_B },
    ]);

    const deltas = calculateScheduleDelta({
      activeSchedule: schedule,
      candidateSchedule: schedule,
    });

    expect(deltas).toHaveLength(0);
  });

  it('repeated identical input yields identical result', () => {
    const active = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
    ]);
    const candidate = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_B },
    ]);

    const r1 = calculateScheduleDelta({ activeSchedule: active, candidateSchedule: candidate });
    const r2 = calculateScheduleDelta({ activeSchedule: active, candidateSchedule: candidate });

    expect(r1).toEqual(r2);
  });
});

describe('FairnessProjectionEngine', () => {
  it('projects deltas onto current ledger', () => {
    const active = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
    ]);
    const candidate = makeSchedule([
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_B },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
    ]);

    const currentLedger = makeLedger({
      [PARENT_A]: { night: -1, weekend: 0, holiday: 0 },
      [PARENT_B]: { night: 1, weekend: 0, holiday: 0 },
    });

    const result = project({
      familyId: FAMILY_ID,
      currentLedger,
      scheduleWindowStart: '2026-03-02',
      scheduleWindowEnd: '2026-03-03',
      activeSchedule: active,
      candidateSchedule: candidate,
    });

    // PARENT_A lost 1 more night: -1 + (-1) = -2
    expect(result.projectedState.byParentId[PARENT_A].nightDeviation).toBe(-2);
    // PARENT_B gained 1 more: 1 + 1 = 2
    expect(result.projectedState.byParentId[PARENT_B].nightDeviation).toBe(2);
  });

  it('returns current state when no candidate schedule', () => {
    const ledger = makeLedger({
      [PARENT_A]: { night: -2, weekend: 0, holiday: 0 },
      [PARENT_B]: { night: 2, weekend: 0, holiday: 0 },
    });

    const result = project({
      familyId: FAMILY_ID,
      currentLedger: ledger,
      scheduleWindowStart: '2026-03-02',
      scheduleWindowEnd: '2026-03-15',
    });

    expect(result.projectedState.byParentId[PARENT_A].nightDeviation).toBe(-2);
    expect(result.projectedState.byParentId[PARENT_B].nightDeviation).toBe(2);
    expect(result.projectionDeltas).toHaveLength(0);
  });

  it('computes summary magnitudes', () => {
    const ledger = makeLedger({
      [PARENT_A]: { night: -3, weekend: -1, holiday: 0 },
      [PARENT_B]: { night: 3, weekend: 1, holiday: 0 },
    });

    const result = project({
      familyId: FAMILY_ID,
      currentLedger: ledger,
      scheduleWindowStart: '2026-03-02',
      scheduleWindowEnd: '2026-03-15',
    });

    expect(result.summary.totalNightDeviationMagnitude).toBe(6); // |3| + |-3|
    expect(result.summary.totalWeekendDeviationMagnitude).toBe(2);
    expect(result.summary.totalHolidayDeviationMagnitude).toBe(0);
  });
});
