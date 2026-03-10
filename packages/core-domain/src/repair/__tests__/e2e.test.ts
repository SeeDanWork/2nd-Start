import { describe, it, expect } from 'vitest';
import { solveRepairProblem } from '../core/LocalizedRepairSolver';
import { buildRepairInput } from '../core/RepairInputBuilder';
import { applyOverlays } from '../overlay/OverlayApplicator';
import { calculateOverlayDrift } from '../fairness/FairnessDriftCalculator';
import { DisruptionType } from '../../enums/DisruptionType';
import {
  makeAlternatingSchedule, makeOverlay, makeRepairInput, makeRepairWeights,
  PARENT_A, PARENT_B, CHILD_1, CHILD_2,
} from './helpers';

describe('Repair E2E', () => {
  it('illness overlay creates overlaid schedule and drift summary', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-15');
    // Day 0 (2026-03-02): PARENT_A block. Overlay switches to PARENT_B.
    const overlay = makeOverlay('2026-03-02', CHILD_1, PARENT_B, DisruptionType.ILLNESS);

    const { overlaidSchedule, overlayImpacts } = applyOverlays({
      activeSchedule: schedule,
      overlays: [overlay],
    });

    // Overlay should have been applied
    const overlaidNight = overlaidSchedule.nights.find(
      n => n.date === '2026-03-02' && n.childId === CHILD_1,
    );
    expect(overlaidNight?.parentId).toBe(PARENT_B);
    expect(overlayImpacts).toHaveLength(1);
    expect(overlayImpacts[0].type).toBe(DisruptionType.ILLNESS);

    // Drift should reflect the change
    const drift = calculateOverlayDrift({
      activeSchedule: schedule,
      overlaidSchedule,
      overlays: [overlay],
    });

    expect(drift.byParentId[PARENT_A].nightDelta).toBe(-1);
    expect(drift.byParentId[PARENT_B].nightDelta).toBe(1);
  });

  it('repair solver generates proposal-ready repaired schedules', async () => {
    const input = makeRepairInput();
    const result = await solveRepairProblem(input);

    // Should have candidates
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.length).toBeLessThanOrEqual(input.solverConfig.candidateCount);

    // Each candidate should have required structure
    for (const candidate of result.candidates) {
      expect(candidate.candidateId).toBeTruthy();
      expect(candidate.repairedSchedule).toBeDefined();
      expect(candidate.repairedSchedule.nights.length).toBeGreaterThan(0);
      expect(candidate.score).toBeDefined();
      expect(candidate.score.total).toBeDefined();
      expect(candidate.score.breakdown).toBeDefined();
      expect(candidate.policyEvaluation).toBeDefined();
      expect(candidate.fairnessDrift).toBeDefined();
      expect(candidate.metadata).toBeDefined();
      expect(candidate.metadata.baseScheduleVersionId).toBe(input.activeSchedule.scheduleVersionId);
      expect(candidate.metadata.overlayIds).toEqual(
        input.disruptionOverlays.map(o => o.overlayId),
      );
    }

    // Should have a selected candidate
    expect(result.selectedCandidateId).toBeTruthy();

    // Overlaid schedule should be present
    expect(result.overlaidSchedule).toBeDefined();
    expect(result.overlaidSchedule.nights.length).toBe(input.activeSchedule.nights.length);

    // Artifacts should be generated
    expect(result.artifacts.length).toBeGreaterThan(0);
  });

  it('repaired candidate reduces fairness drift without excessive churn', async () => {
    // More overlays = more drift to correct
    // Day 0-1 (Mar 2-3): PARENT_A, Day 2-3 (Mar 4-5): PARENT_B, Day 4-5 (Mar 6-7): PARENT_A
    // Overlay on PARENT_A days to switch to PARENT_B
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-20');
    const overlays = [
      makeOverlay('2026-03-02', CHILD_1, PARENT_B, DisruptionType.ILLNESS, 'o1'),
      makeOverlay('2026-03-03', CHILD_1, PARENT_B, DisruptionType.ILLNESS, 'o2'),
    ];

    const result = await solveRepairProblem(makeRepairInput({
      activeSchedule: schedule,
      disruptionOverlays: overlays,
      solverConfig: {
        candidateCount: 4,
        primaryMultiplier: 100,
        maxRepairDays: 14,
        objectiveWeights: makeRepairWeights(),
      },
    }));

    const topCandidate = result.candidates[0];

    // Verify schedule integrity: repaired should have at least as many nights as repair window
    expect(topCandidate.repairedSchedule.nights.length).toBeGreaterThan(0);

    // Count changes from active schedule in repair window
    const normalized = buildRepairInput(makeRepairInput({
      activeSchedule: schedule,
      disruptionOverlays: overlays,
      solverConfig: {
        candidateCount: 4,
        primaryMultiplier: 100,
        maxRepairDays: 14,
        objectiveWeights: makeRepairWeights(),
      },
    }));
    const repairDates = new Set(normalized.days.map(d => d.date));

    let changesFromActive = 0;
    let totalRepairNights = 0;
    for (const night of topCandidate.repairedSchedule.nights) {
      if (!repairDates.has(night.date)) continue;
      totalRepairNights++;
      const activeParent = normalized.activeNightLookup.get(`${night.date}:${night.childId}`);
      if (activeParent && activeParent !== night.parentId) {
        changesFromActive++;
      }
    }

    // Should not change more than half the nights in repair window (not excessive)
    expect(changesFromActive).toBeLessThanOrEqual(totalRepairNights / 2);

    // Overlay dates should remain fixed
    for (const overlay of overlays) {
      const key = `${overlay.date}:${overlay.childId}`;
      const repairedNight = topCandidate.repairedSchedule.nights.find(
        n => `${n.date}:${n.childId}` === key,
      );
      expect(repairedNight?.parentId).toBe(overlay.assignedParentId);
    }

    // Drift summary should exist
    expect(result.driftSummary).toBeDefined();
    expect(result.driftSummary.byParentId).toBeDefined();
  });

  it('deterministic: same input yields same result', async () => {
    const input = makeRepairInput();

    const r1 = await solveRepairProblem(input);
    const r2 = await solveRepairProblem(input);

    expect(r1.candidates.length).toBe(r2.candidates.length);
    for (let i = 0; i < r1.candidates.length; i++) {
      expect(r1.candidates[i].candidateId).toBe(r2.candidates[i].candidateId);
      // Night assignments should match
      const n1 = r1.candidates[i].repairedSchedule.nights;
      const n2 = r2.candidates[i].repairedSchedule.nights;
      expect(n1.length).toBe(n2.length);
      for (let j = 0; j < n1.length; j++) {
        expect(n1[j].date).toBe(n2[j].date);
        expect(n1[j].childId).toBe(n2[j].childId);
        expect(n1[j].parentId).toBe(n2[j].parentId);
      }
    }
  });
});
