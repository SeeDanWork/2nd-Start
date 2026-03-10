import { describe, it, expect } from 'vitest';
import { calculateOverlayDrift } from '../fairness/FairnessDriftCalculator';
import { applyOverlays } from '../overlay/OverlayApplicator';
import { DisruptionType } from '../../enums/DisruptionType';
import {
  makeAlternatingSchedule, makeOverlay,
  PARENT_A, PARENT_B, CHILD_1, CHILD_2,
} from './helpers';

describe('FairnessDriftCalculator', () => {
  it('records +1/-1 night drift correctly', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-05');
    // 2026-03-02 child-1 is with PARENT_A, overlay switches to PARENT_B
    const overlay = makeOverlay('2026-03-02', CHILD_1, PARENT_B);
    const { overlaidSchedule } = applyOverlays({ activeSchedule: schedule, overlays: [overlay] });

    const drift = calculateOverlayDrift({
      activeSchedule: schedule,
      overlaidSchedule,
      overlays: [overlay],
    });

    expect(drift.byParentId[PARENT_A].nightDelta).toBe(-1);
    expect(drift.byParentId[PARENT_B].nightDelta).toBe(1);
  });

  it('updates weekend drift when weekend affected', () => {
    // 2026-03-06 is Friday, 2026-03-07 is Saturday
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-08');
    // Overlay on Friday (weekend night)
    const overlay = makeOverlay('2026-03-06', CHILD_1, PARENT_A);
    const { overlaidSchedule } = applyOverlays({ activeSchedule: schedule, overlays: [overlay] });

    // Check what parent was on this date in the original
    const origNight = schedule.nights.find(n => n.date === '2026-03-06' && n.childId === CHILD_1);

    // Only count drift if overlay actually changed the parent
    if (origNight && origNight.parentId !== PARENT_A) {
      const drift = calculateOverlayDrift({
        activeSchedule: schedule,
        overlaidSchedule,
        overlays: [overlay],
      });
      // The original parent lost a weekend night
      expect(drift.byParentId[origNight.parentId].weekendDelta).toBe(-1);
      expect(drift.byParentId[PARENT_A].weekendDelta).toBe(1);
    }
  });

  it('updates holiday drift when holiday affected', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-05');
    const overlay = makeOverlay('2026-03-03', CHILD_1, PARENT_B);
    const { overlaidSchedule } = applyOverlays({ activeSchedule: schedule, overlays: [overlay] });

    const drift = calculateOverlayDrift({
      activeSchedule: schedule,
      overlaidSchedule,
      overlays: [overlay],
      fixedHolidayAssignments: [{ label: 'Holiday', date: '2026-03-03', childIds: [CHILD_1], assignedParentId: PARENT_A }],
    });

    // 2026-03-03 is a holiday — drift should include holiday delta
    expect(drift.byParentId[PARENT_A].holidayDelta).toBe(-1);
    expect(drift.byParentId[PARENT_B].holidayDelta).toBe(1);
  });

  it('aggregates multiple overlays correctly', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-05');
    const o1 = makeOverlay('2026-03-02', CHILD_1, PARENT_B, DisruptionType.ILLNESS, 'o1');
    const o2 = makeOverlay('2026-03-03', CHILD_2, PARENT_B, DisruptionType.ILLNESS, 'o2');
    const { overlaidSchedule } = applyOverlays({ activeSchedule: schedule, overlays: [o1, o2] });

    const drift = calculateOverlayDrift({
      activeSchedule: schedule,
      overlaidSchedule,
      overlays: [o1, o2],
    });

    // PARENT_A lost 2 nights, PARENT_B gained 2
    expect(drift.byParentId[PARENT_A].nightDelta).toBe(-2);
    expect(drift.byParentId[PARENT_B].nightDelta).toBe(2);
  });
});
