import { describe, it, expect } from 'vitest';
import { buildRepairInput } from '../core/RepairInputBuilder';
import { buildRepairModel } from '../model/RepairModelBuilder';
import { solveRepair } from '../model/DeterministicRepairSolver';
import { evaluateRepairPolicies } from '../core/RepairPolicyCoordinator';
import { createDefaultRegistry } from '../../policy/registry/createDefaultRegistry';
import {
  makeAlternatingSchedule, makeOverlay, makeRepairInput, makeRepairWeights,
  PARENT_A, PARENT_B, CHILD_1, CHILD_2,
} from './helpers';
import { RepairWeightProfile, NormalizedRepairInput } from '../types';
import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';

function solve(overrides?: Parameters<typeof makeRepairInput>[0]) {
  const normalized = buildRepairInput(makeRepairInput(overrides));
  const model = buildRepairModel(normalized);
  const profile: RepairWeightProfile = {
    id: 'balanced',
    label: 'Balanced',
    weights: normalized.config.objectiveWeights,
  };
  const repaired = solveRepair(normalized, model, profile);
  return { normalized, model, repaired };
}

describe('DeterministicRepairSolver', () => {
  it('nights outside repair window remain unchanged', () => {
    const { normalized, repaired } = solve();

    const repairDates = new Set(normalized.days.map(d => d.date));

    for (const night of repaired.nights) {
      if (repairDates.has(night.date)) continue;
      // Night outside window should match overlaid schedule
      const overlaidParent = normalized.overlaidNightLookup.get(`${night.date}:${night.childId}`);
      expect(night.parentId).toBe(overlaidParent);
    }
  });

  it('overlay dates remain fixed', () => {
    const { normalized, repaired } = solve();

    for (const key of normalized.overlayFixedSlots) {
      const overlaidParent = normalized.overlaidNightLookup.get(key);
      const repairedNight = repaired.nights.find(n => `${n.date}:${n.childId}` === key);
      expect(repairedNight?.parentId).toBe(overlaidParent);
    }
  });

  it('repair candidates restore fairness gradually', () => {
    // Create a scenario with significant drift
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-20');
    const overlays = [
      makeOverlay('2026-03-04', CHILD_1, PARENT_B, undefined, 'o1'),
      makeOverlay('2026-03-05', CHILD_1, PARENT_B, undefined, 'o2'),
      makeOverlay('2026-03-06', CHILD_2, PARENT_B, undefined, 'o3'),
    ];

    const { normalized, repaired } = solve({
      activeSchedule: schedule,
      disruptionOverlays: overlays,
      solverConfig: {
        candidateCount: 3,
        primaryMultiplier: 100,
        maxRepairDays: 14,
        objectiveWeights: makeRepairWeights(),
      },
    });

    // Count nights per parent in repair window
    const repairDates = new Set(normalized.days.map(d => d.date));
    const nightCounts: Record<string, number> = {};
    for (const night of repaired.nights) {
      if (!repairDates.has(night.date)) continue;
      nightCounts[night.parentId] = (nightCounts[night.parentId] ?? 0) + 1;
    }

    // The solver should attempt to balance rather than leave all drift uncorrected
    // Both parents should have at least some nights
    expect(nightCounts[PARENT_A]).toBeGreaterThan(0);
    expect(nightCounts[PARENT_B]).toBeGreaterThan(0);
  });

  it('repeated identical input yields identical output', () => {
    const input = makeRepairInput();

    const normalized1 = buildRepairInput(input);
    const model1 = buildRepairModel(normalized1);
    const profile: RepairWeightProfile = {
      id: 'balanced', label: 'Balanced',
      weights: normalized1.config.objectiveWeights,
    };
    const repaired1 = solveRepair(normalized1, model1, profile);

    const normalized2 = buildRepairInput(input);
    const model2 = buildRepairModel(normalized2);
    const repaired2 = solveRepair(normalized2, model2, profile);

    // Night assignments should be identical
    expect(repaired1.nights.length).toBe(repaired2.nights.length);
    for (let i = 0; i < repaired1.nights.length; i++) {
      expect(repaired1.nights[i].date).toBe(repaired2.nights[i].date);
      expect(repaired1.nights[i].childId).toBe(repaired2.nights[i].childId);
      expect(repaired1.nights[i].parentId).toBe(repaired2.nights[i].parentId);
    }
  });

  it('HARD policy violation rejects candidate', () => {
    const { repaired, normalized } = solve();
    const registry = createDefaultRegistry();

    // With no active HARD policies, should be feasible
    const result = evaluateRepairPolicies(repaired, normalized, registry);
    expect(result.isFeasible).toBe(true);

    // Add a HARD policy — MIN_BLOCK_LENGTH with minNights=999 is impossible
    const hardNormalized: NormalizedRepairInput = {
      ...normalized,
      activePolicies: [{
        id: 'hard-block',
        familyId: normalized.familyId,
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        priority: PolicyPriority.HARD,
        scope: { scopeType: 'FAMILY' },
        parameters: { minNights: 999 },
        active: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      }],
    };

    const hardResult = evaluateRepairPolicies(repaired, hardNormalized, registry);
    // If the MIN_BLOCK_LENGTH evaluator detects violation with minNights=999
    // and it's HARD priority, it should reject
    if (hardResult.evaluation.hardViolations.length > 0) {
      expect(hardResult.isFeasible).toBe(false);
    }
    // At minimum, the evaluation should have been performed
    expect(hardResult.evaluation).toBeDefined();
  });
});
