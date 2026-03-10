import { describe, it, expect } from 'vitest';
import { identifyRestitutionTargets } from '../fairness/FairnessRestitutionPlanner';
import { applyOverlays } from '../overlay/OverlayApplicator';
import { makeAlternatingSchedule, makeOverlay, PARENT_A, PARENT_B, CHILD_1, CHILD_2 } from './helpers';

describe('FairnessRestitutionPlanner', () => {
  it('identifies future restitution targets deterministically', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-15');
    const overlay = makeOverlay('2026-03-02', CHILD_1, PARENT_B);
    const { overlaidSchedule } = applyOverlays({ activeSchedule: schedule, overlays: [overlay] });

    const driftSummary = {
      byParentId: {
        [PARENT_A]: { nightDelta: -1, weekendDelta: 0, holidayDelta: 0 },
        [PARENT_B]: { nightDelta: 1, weekendDelta: 0, holidayDelta: 0 },
      },
    };

    const targets = identifyRestitutionTargets({
      overlaidSchedule,
      repairWindow: { startDate: '2026-03-02', endDate: '2026-03-15' },
      driftSummary,
    });

    expect(targets.length).toBeGreaterThan(0);
    // All targets should move nights from PARENT_B to PARENT_A
    for (const t of targets) {
      expect(t.fromParentId).toBe(PARENT_B);
      expect(t.toParentId).toBe(PARENT_A);
    }
  });

  it('does not generate targets outside repair window', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-30');
    const overlay = makeOverlay('2026-03-02', CHILD_1, PARENT_B);
    const { overlaidSchedule } = applyOverlays({ activeSchedule: schedule, overlays: [overlay] });

    const driftSummary = {
      byParentId: {
        [PARENT_A]: { nightDelta: -1, weekendDelta: 0, holidayDelta: 0 },
        [PARENT_B]: { nightDelta: 1, weekendDelta: 0, holidayDelta: 0 },
      },
    };

    const targets = identifyRestitutionTargets({
      overlaidSchedule,
      repairWindow: { startDate: '2026-03-02', endDate: '2026-03-08' },
      driftSummary,
    });

    for (const t of targets) {
      expect(t.date >= '2026-03-02').toBe(true);
      expect(t.date <= '2026-03-08').toBe(true);
    }
  });

  it('returns empty when no drift exists', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-08');
    const driftSummary = {
      byParentId: {
        [PARENT_A]: { nightDelta: 0, weekendDelta: 0, holidayDelta: 0 },
        [PARENT_B]: { nightDelta: 0, weekendDelta: 0, holidayDelta: 0 },
      },
    };

    const targets = identifyRestitutionTargets({
      overlaidSchedule: schedule,
      repairWindow: { startDate: '2026-03-02', endDate: '2026-03-08' },
      driftSummary,
    });

    expect(targets).toHaveLength(0);
  });
});
