import { describe, it, expect } from 'vitest';
import { DisruptionType } from '../../enums/DisruptionType';
import { validateOverlays } from '../overlay/OverlayValidator';
import { applyOverlays } from '../overlay/OverlayApplicator';
import {
  makeAlternatingSchedule, makeOverlay, makeParent, makeChild,
  FAMILY_ID, PARENT_A, PARENT_B, CHILD_1, CHILD_2, SCHEDULE_V1,
} from './helpers';

describe('OverlayValidator', () => {
  it('rejects parent not in family', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-05');
    const overlay = makeOverlay('2026-03-03', CHILD_1, 'unknown-parent');
    expect(() => validateOverlays({
      activeSchedule: schedule,
      overlays: [overlay],
      parents: [makeParent(PARENT_A), makeParent(PARENT_B)],
      children: [makeChild(CHILD_1)],
    })).toThrow('unknown parent');
  });

  it('rejects conflicting overlays for same child/date', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-05');
    const o1 = makeOverlay('2026-03-03', CHILD_1, PARENT_B, DisruptionType.ILLNESS, 'o1');
    const o2 = makeOverlay('2026-03-03', CHILD_1, PARENT_A, DisruptionType.TRAVEL, 'o2');
    expect(() => validateOverlays({
      activeSchedule: schedule,
      overlays: [o1, o2],
      parents: [makeParent(PARENT_A), makeParent(PARENT_B)],
      children: [makeChild(CHILD_1)],
    })).toThrow('Conflicting overlays');
  });

  it('rejects overlay date outside schedule window', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-05');
    const overlay = makeOverlay('2026-04-01', CHILD_1, PARENT_B);
    expect(() => validateOverlays({
      activeSchedule: schedule,
      overlays: [overlay],
      parents: [makeParent(PARENT_A), makeParent(PARENT_B)],
      children: [makeChild(CHILD_1)],
    })).toThrow('outside schedule window');
  });
});

describe('OverlayApplicator', () => {
  it('applies single overlay correctly', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-05');
    // 2026-03-02 and 2026-03-03 are with PARENT_A (block 1)
    const overlay = makeOverlay('2026-03-02', CHILD_1, PARENT_B);

    const result = applyOverlays({ activeSchedule: schedule, overlays: [overlay] });

    const overlaidNight = result.overlaidSchedule.nights.find(
      n => n.date === '2026-03-02' && n.childId === CHILD_1,
    );
    expect(overlaidNight?.parentId).toBe(PARENT_B);
    expect(result.overlayImpacts).toHaveLength(1);
    expect(result.overlayImpacts[0].fromParentId).toBe(PARENT_A);
    expect(result.overlayImpacts[0].toParentId).toBe(PARENT_B);
  });

  it('applies multiple overlays deterministically', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-05');
    const o1 = makeOverlay('2026-03-03', CHILD_1, PARENT_B, DisruptionType.ILLNESS, 'o1');
    const o2 = makeOverlay('2026-03-02', CHILD_2, PARENT_B, DisruptionType.TRAVEL, 'o2');

    const result = applyOverlays({ activeSchedule: schedule, overlays: [o1, o2] });

    // Both should be applied
    const n1 = result.overlaidSchedule.nights.find(n => n.date === '2026-03-03' && n.childId === CHILD_1);
    const n2 = result.overlaidSchedule.nights.find(n => n.date === '2026-03-02' && n.childId === CHILD_2);
    expect(n1?.parentId).toBe(PARENT_B);
    expect(n2?.parentId).toBe(PARENT_B);

    // Impacts sorted by date then childId
    expect(result.overlayImpacts).toHaveLength(2);
    expect(result.overlayImpacts[0].date).toBe('2026-03-02');
    expect(result.overlayImpacts[1].date).toBe('2026-03-03');
  });

  it('preserves non-overlaid nights unchanged', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-05');
    const overlay = makeOverlay('2026-03-02', CHILD_1, PARENT_B);

    const result = applyOverlays({ activeSchedule: schedule, overlays: [overlay] });

    // Check that other nights are unchanged
    const child2Night = result.overlaidSchedule.nights.find(
      n => n.date === '2026-03-02' && n.childId === CHILD_2,
    );
    const origChild2Night = schedule.nights.find(
      n => n.date === '2026-03-02' && n.childId === CHILD_2,
    );
    expect(child2Night?.parentId).toBe(origChild2Night?.parentId);

    // Total night count should be the same
    expect(result.overlaidSchedule.nights.length).toBe(schedule.nights.length);
  });
});
