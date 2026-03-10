import {
  NormalizedRepairInput,
  BuiltRepairModel,
  RepairWeightProfile,
} from '../types';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { RepairNoFeasibleSolutionError } from '../errors';
import { extractRepairCandidate } from './RepairCandidateExtractor';
import { identifyRestitutionTargets } from '../fairness/FairnessRestitutionPlanner';

/**
 * Deterministic greedy solver for localized repair.
 *
 * For each slot in the repair window:
 *   - Fixed slots (overlay/holiday) are assigned their fixed parent
 *   - Free slots are scored using weighted signals favoring stability,
 *     calmness, fairness restitution, and sibling cohesion
 */
export function solveRepair(
  input: NormalizedRepairInput,
  model: BuiltRepairModel,
  profile: RepairWeightProfile,
): ScheduleSnapshot {
  const assignment = new Map<number, number>();
  const weights = profile.weights;

  // Get restitution targets for guiding solver
  const restitutionTargets = identifyRestitutionTargets({
    overlaidSchedule: input.overlaidSchedule,
    repairWindow: input.repairWindow,
    driftSummary: input.driftSummary,
  });
  const restitutionLookup = new Map<string, string>();
  for (const target of restitutionTargets) {
    restitutionLookup.set(`${target.date}:${target.childId}`, target.toParentId);
  }

  // Track running counts for fairness
  const nightCounts = new Map<string, number>();
  for (const parentId of input.parentIds) {
    nightCounts.set(parentId, 0);
  }

  // Previous parent per child for continuity
  const prevParent = new Map<string, string>();

  // Initialize prevParent from overlaid schedule for first repair date
  if (input.days.length > 0) {
    const firstDate = input.days[0].date;
    for (const childId of input.childIds) {
      // Look at the night before repair window
      const prevKey = `${firstDate}:${childId}`;
      const overlaidParent = input.overlaidNightLookup.get(prevKey);
      if (overlaidParent) {
        // Actually look one day before if available
      }
    }
  }

  for (const day of input.days) {
    const dateSiblingAssignment = new Map<string, string>();

    for (const childId of input.childIds) {
      const slotKey = `${day.date}:${childId}`;
      const varIndices = model.variablesBySlot.get(slotKey);
      if (!varIndices) {
        throw new RepairNoFeasibleSolutionError(`Missing slot ${slotKey}`);
      }

      // Check for fixed assignment (overlay or holiday)
      const isOverlayFixed = input.overlayFixedSlots.has(slotKey);
      const holidayParent = input.fixedHolidayAssignments.get(slotKey);

      if (isOverlayFixed) {
        const fixedParent = input.overlaidNightLookup.get(slotKey)!;
        for (const vi of varIndices) {
          const v = model.variableByIndex.get(vi)!;
          assignment.set(vi, v.parentId === fixedParent ? 1 : 0);
        }
        nightCounts.set(fixedParent, (nightCounts.get(fixedParent) ?? 0) + 1);
        prevParent.set(childId, fixedParent);
        dateSiblingAssignment.set(childId, fixedParent);
        continue;
      }

      if (holidayParent !== undefined) {
        for (const vi of varIndices) {
          const v = model.variableByIndex.get(vi)!;
          assignment.set(vi, v.parentId === holidayParent ? 1 : 0);
        }
        nightCounts.set(holidayParent, (nightCounts.get(holidayParent) ?? 0) + 1);
        prevParent.set(childId, holidayParent);
        dateSiblingAssignment.set(childId, holidayParent);
        continue;
      }

      // Score each parent
      let bestParent: string | null = null;
      let bestScore = -Infinity;

      for (const vi of varIndices) {
        const v = model.variableByIndex.get(vi)!;
        let score = 0;

        // Stability: reward matching active (pre-overlay) schedule
        const activeParent = input.activeNightLookup.get(slotKey);
        if (activeParent !== undefined) {
          if (v.parentId === activeParent) {
            score += weights.stability * 10;
          } else {
            score -= weights.stability * 5;
          }
        }

        // Near-term calmness: reward matching overlaid (post-overlay) schedule
        const overlaidParent = input.overlaidNightLookup.get(slotKey);
        if (overlaidParent !== undefined && v.parentId === overlaidParent) {
          score += weights.nearTermCalmness * 6;
        }

        // Continuity with previous night
        const prev = prevParent.get(childId);
        if (prev !== undefined && v.parentId === prev) {
          score += weights.nearTermCalmness * 3;
        }

        // Fairness restitution: bonus for matching restitution target
        const restitutionTarget = restitutionLookup.get(slotKey);
        if (restitutionTarget !== undefined && v.parentId === restitutionTarget) {
          score += weights.fairnessRestitution * 7;
        }

        // Family structure: sibling cohesion
        if (dateSiblingAssignment.size > 0 && weights.familyStructure > 0) {
          let siblingMatch = 0;
          let siblingMismatch = 0;
          for (const [, sibParent] of dateSiblingAssignment) {
            if (sibParent === v.parentId) siblingMatch++;
            else siblingMismatch++;
          }
          score += weights.familyStructure * (siblingMatch * 8 - siblingMismatch * 6);
        }

        // Fairness: balance night counts
        const totalNights = input.days.length * input.childIds.length;
        const targetPerParent = totalNights / input.parentIds.length;
        const currentCount = nightCounts.get(v.parentId) ?? 0;
        const deviation = currentCount - targetPerParent;
        score -= weights.fairnessRestitution * Math.abs(deviation) * 1.5;

        // Deterministic tie-break
        if (score > bestScore || (score === bestScore && (bestParent === null || v.parentId < bestParent))) {
          bestScore = score;
          bestParent = v.parentId;
        }
      }

      if (bestParent === null) {
        throw new RepairNoFeasibleSolutionError(`No feasible parent for slot ${slotKey}`);
      }

      for (const vi of varIndices) {
        const v = model.variableByIndex.get(vi)!;
        assignment.set(vi, v.parentId === bestParent ? 1 : 0);
      }

      nightCounts.set(bestParent, (nightCounts.get(bestParent) ?? 0) + 1);
      prevParent.set(childId, bestParent);
      dateSiblingAssignment.set(childId, bestParent);
    }
  }

  return extractRepairCandidate(assignment, model, input);
}
