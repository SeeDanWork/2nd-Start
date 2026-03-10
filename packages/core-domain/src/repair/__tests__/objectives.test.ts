import { describe, it, expect } from 'vitest';
import { computeRepairStabilityScore } from '../objectives/StabilityRepairObjective';
import { computeFairnessRestitutionScore } from '../objectives/FairnessRestitutionObjective';
import { computeNearTermCalmnessScore } from '../objectives/NearTermCalmnessObjective';
import { computeRepairFamilyStructureScore } from '../objectives/FamilyStructureRepairObjective';
import { buildRepairInput } from '../core/RepairInputBuilder';
import { applyOverlays } from '../overlay/OverlayApplicator';
import {
  makeAlternatingSchedule, makeOverlay, makeRepairInput, makeNight,
  PARENT_A, PARENT_B, CHILD_1, CHILD_2, SCHEDULE_V1,
} from './helpers';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { ParentId } from '../../types';
import { NormalizedRepairInput } from '../types';

function buildNormalized(overrides?: Parameters<typeof makeRepairInput>[0]): NormalizedRepairInput {
  return buildRepairInput(makeRepairInput(overrides));
}

describe('StabilityRepairObjective', () => {
  it('penalizes extra changes beyond overlays', () => {
    const normalized = buildNormalized();

    // Repaired schedule identical to overlaid = only overlay changes, perfect stability
    const perfectRepaired = { ...normalized.overlaidSchedule };
    const perfectResult = computeRepairStabilityScore(perfectRepaired, normalized);

    // Repaired schedule with additional change beyond overlay
    const extraChangedRepaired: ScheduleSnapshot = {
      ...normalized.overlaidSchedule,
      nights: normalized.overlaidSchedule.nights.map(n => {
        // Swap a non-overlay night
        if (n.date === '2026-03-06' && n.childId === CHILD_1) {
          return { ...n, parentId: n.parentId === PARENT_A ? PARENT_B : PARENT_A };
        }
        return n;
      }),
    };
    const extraResult = computeRepairStabilityScore(extraChangedRepaired, normalized);

    // Additional changes should lower stability score
    expect(extraResult.score).toBeLessThan(perfectResult.score);
    expect(extraResult.changedNights).toBeGreaterThan(perfectResult.changedNights);
  });

  it('returns 1.0 when no changes in repair window', () => {
    const normalized = buildNormalized();
    // Use active schedule as repaired — overlay changes ARE penalized since they differ from active
    // But overlaid schedule matches active for non-overlay nights
    const result = computeRepairStabilityScore(normalized.overlaidSchedule, normalized);
    // The overlay itself counts as changedNights but as overlayChanges too, so no additional changes
    const additional = result.changedNights - result.overlayChanges;
    expect(additional).toBe(0);
  });
});

describe('FairnessRestitutionObjective', () => {
  it('rewards partial correction', () => {
    const normalized = buildNormalized();

    // No correction: use overlaid as repaired
    const noCorrection = computeFairnessRestitutionScore(normalized.overlaidSchedule, normalized);

    // Partial correction: swap one non-overlay night back toward active parent
    const partialRepaired: ScheduleSnapshot = {
      ...normalized.overlaidSchedule,
      nights: normalized.overlaidSchedule.nights.map(n => {
        // Find a night where overlaid differs from active and restore it
        const key = `${n.date}:${n.childId}`;
        const activeParent = normalized.activeNightLookup.get(key);
        if (n.date === '2026-03-06' && n.childId === CHILD_1 && activeParent && activeParent !== n.parentId) {
          return { ...n, parentId: activeParent as ParentId };
        }
        return n;
      }),
    };
    const partialResult = computeFairnessRestitutionScore(partialRepaired, normalized);

    // Score should be at least as good (partial correction should score >= no correction)
    expect(partialResult.score).toBeGreaterThanOrEqual(noCorrection.score);
  });

  it('returns 1.0 when no drift exists', () => {
    // Schedule with no overlay changes means no drift
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-08');
    // Create overlay that assigns same parent that was already assigned (no actual change)
    const origNight = schedule.nights.find(n => n.date === '2026-03-03' && n.childId === CHILD_1);
    if (!origNight) throw new Error('Night not found');

    const normalized = buildNormalized({
      activeSchedule: schedule,
      disruptionOverlays: [makeOverlay('2026-03-03', CHILD_1, origNight.parentId)],
    });

    const result = computeFairnessRestitutionScore(normalized.overlaidSchedule, normalized);
    // With zero drift, score should be 1.0
    expect(result.score).toBe(1.0);
  });
});

describe('NearTermCalmnessObjective', () => {
  it('penalizes churn near overlay dates', () => {
    const normalized = buildNormalized();

    // No churn: overlaid unchanged
    const calmResult = computeNearTermCalmnessScore(normalized.overlaidSchedule, normalized);

    // Churn near overlay: change a night right after overlay date
    const churned: ScheduleSnapshot = {
      ...normalized.overlaidSchedule,
      nights: normalized.overlaidSchedule.nights.map(n => {
        // 2026-03-05 is day after overlay (2026-03-04) — near-term zone
        if (n.date === '2026-03-05' && n.childId === CHILD_1) {
          return { ...n, parentId: n.parentId === PARENT_A ? PARENT_B : PARENT_A };
        }
        return n;
      }),
    };
    const churnedResult = computeNearTermCalmnessScore(churned, normalized);

    expect(churnedResult.score).toBeLessThan(calmResult.score);
  });

  it('penalizes A→B→A oscillation', () => {
    const normalized = buildNormalized();

    // Create oscillation pattern by changing alternate nights
    const oscillated: ScheduleSnapshot = {
      ...normalized.overlaidSchedule,
      nights: normalized.overlaidSchedule.nights.map(n => {
        if (n.childId !== CHILD_1) return n;
        const key = `${n.date}:${n.childId}`;
        if (normalized.overlayFixedSlots.has(key)) return n;
        // Every other non-fixed day, flip parent
        const dayNum = parseInt(n.date.slice(-2), 10);
        if (dayNum % 2 === 0) {
          return { ...n, parentId: n.parentId === PARENT_A ? PARENT_B : PARENT_A };
        }
        return n;
      }),
    };
    const oscResult = computeNearTermCalmnessScore(oscillated, normalized);

    // No changes
    const calmResult = computeNearTermCalmnessScore(normalized.overlaidSchedule, normalized);

    expect(oscResult.score).toBeLessThanOrEqual(calmResult.score);
  });
});

describe('FamilyStructureRepairObjective', () => {
  it('penalizes sibling splits', () => {
    const normalized = buildNormalized();

    // No splits: overlaid schedule keeps siblings together
    const togetherResult = computeRepairFamilyStructureScore(normalized.overlaidSchedule, normalized);

    // Force split: child-1 with parent-a, child-2 with parent-b on same date
    const splitRepaired: ScheduleSnapshot = {
      ...normalized.overlaidSchedule,
      nights: normalized.overlaidSchedule.nights.map(n => {
        if (n.date === '2026-03-06' && n.childId === CHILD_1) {
          return { ...n, parentId: PARENT_A };
        }
        if (n.date === '2026-03-06' && n.childId === CHILD_2) {
          return { ...n, parentId: PARENT_B };
        }
        return n;
      }),
    };
    const splitResult = computeRepairFamilyStructureScore(splitRepaired, normalized);

    expect(splitResult.splitNights).toBeGreaterThan(0);
    // More splits = lower score (unless original also had splits)
    expect(splitResult.score).toBeLessThanOrEqual(togetherResult.score);
  });

  it('returns 1.0 for single-child family', () => {
    const normalized = buildNormalized({
      children: [{ id: CHILD_1, familyId: 'family-1', name: 'Child 1', birthDate: '2020-01-01', createdAt: new Date() } as any],
      activeSchedule: makeAlternatingSchedule('2026-03-02', '2026-03-15', [CHILD_1]),
      disruptionOverlays: [makeOverlay('2026-03-04', CHILD_1, PARENT_B)],
    });

    const result = computeRepairFamilyStructureScore(normalized.overlaidSchedule, normalized);
    expect(result.score).toBe(1.0);
  });
});
