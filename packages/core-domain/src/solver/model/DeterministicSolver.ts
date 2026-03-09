import {
  NormalizedSolverInput,
  BuiltScheduleModel,
  WeightProfile,
  CandidateNight,
  CandidateExchange,
} from '../types';
import { SolverNoFeasibleSolutionError } from '../errors';
import { extractCandidate } from './CandidateExtractor';

/**
 * Deterministic constraint solver for night ownership.
 *
 * For each (date, child) slot, selects the parent that maximizes a weighted
 * score incorporating stability, fairness, and structure signals.
 *
 * This is a greedy deterministic solver suitable for Phase 4.
 * Future phases may replace the inner solver with OR-Tools CP-SAT.
 *
 * Candidate generation strategy:
 *   - Generate one candidate per weight profile
 *   - Each profile produces deterministic output
 *   - Profiles are processed sequentially
 */
export function solveDeterministic(
  input: NormalizedSolverInput,
  model: BuiltScheduleModel,
  profile: WeightProfile,
): { nights: CandidateNight[]; exchanges: CandidateExchange[] } {
  const assignment = new Map<number, number>();
  const weights = profile.weights;

  // Track running fairness during assignment
  const nightCounts = new Map<string, number>();
  const weekendCounts = new Map<string, number>();
  for (const parentId of input.parentIds) {
    nightCounts.set(parentId, 0);
    weekendCounts.set(parentId, 0);
  }

  // Previous night's parent per child (for stability/transition scoring)
  const prevParent = new Map<string, string>();

  // Initialize prevParent from baseline if available
  if (input.baselineNightLookup.size > 0 && input.days.length > 0) {
    const firstDate = input.days[0].date;
    for (const childId of input.childIds) {
      const baselineParent = input.baselineNightLookup.get(`${firstDate}:${childId}`);
      if (baselineParent) {
        // Set as "previous" to reward continuity
      }
    }
  }

  for (const day of input.days) {
    // For sibling cohesion: track what parent siblings are being assigned to on this date
    const dateSiblingAssignment = new Map<string, string>();

    for (const childId of input.childIds) {
      const slotKey = `${day.date}:${childId}`;
      const varIndices = model.variablesBySlot.get(slotKey);
      if (!varIndices) {
        throw new SolverNoFeasibleSolutionError(`Missing slot ${slotKey}`);
      }

      // Check for fixed assignment
      const fixedParent = input.fixedAssignments.get(slotKey);
      if (fixedParent !== undefined) {
        // Assign the fixed parent
        for (const vi of varIndices) {
          const v = model.variableByIndex.get(vi)!;
          assignment.set(vi, v.parentId === fixedParent ? 1 : 0);
        }
        nightCounts.set(fixedParent, (nightCounts.get(fixedParent) ?? 0) + 1);
        if (day.isWeekend) {
          weekendCounts.set(fixedParent, (weekendCounts.get(fixedParent) ?? 0) + 1);
        }
        prevParent.set(childId, fixedParent);
        dateSiblingAssignment.set(childId, fixedParent);
        continue;
      }

      // Score each parent for this slot
      let bestParent: string | null = null;
      let bestScore = -Infinity;

      for (const vi of varIndices) {
        const v = model.variableByIndex.get(vi)!;
        let score = 0;

        // Stability: reward matching baseline
        const baselineParent = input.baselineNightLookup.get(slotKey);
        if (baselineParent !== undefined) {
          if (v.parentId === baselineParent) {
            score += weights.stability * 10;
          } else {
            score -= weights.stability * 5;
          }
        }

        // Stability: reward continuity (same parent as previous night for this child)
        const prev = prevParent.get(childId);
        if (prev !== undefined) {
          if (v.parentId === prev) {
            score += weights.stability * 3;
          }
        }

        // Family structure: reward sibling cohesion
        if (dateSiblingAssignment.size > 0 && weights.familyStructure > 0) {
          // Check if already-assigned siblings for this date are with this parent
          let siblingMatch = 0;
          let siblingMismatch = 0;
          for (const [, siblingParent] of dateSiblingAssignment) {
            if (siblingParent === v.parentId) siblingMatch++;
            else siblingMismatch++;
          }
          score += weights.familyStructure * (siblingMatch * 8 - siblingMismatch * 6);
        }

        // Fairness: prefer the parent with fewer nights so far
        const totalNights = input.days.length * input.childIds.length;
        const targetPerParent = totalNights / input.parentIds.length;
        const currentCount = nightCounts.get(v.parentId) ?? 0;
        const deviation = currentCount - targetPerParent;
        score -= weights.fairness * Math.abs(deviation) * 2;

        // Night fairness weight
        score -= weights.nightsFairness * Math.max(0, deviation) * 1.5;

        // Weekend fairness
        if (day.isWeekend) {
          const totalWeekends = input.days.filter(d => d.isWeekend).length * input.childIds.length;
          const weekendTarget = totalWeekends / input.parentIds.length;
          const weekendDev = (weekendCounts.get(v.parentId) ?? 0) - weekendTarget;
          score -= weights.weekendsFairness * Math.abs(weekendDev) * 2;
        }

        // Holiday fairness (holidays get extra fairness weight)
        if (day.isHoliday) {
          score -= weights.holidaysFairness * Math.abs(deviation) * 3;
        }

        // Compare deterministically
        if (score > bestScore || (score === bestScore && (bestParent === null || v.parentId < bestParent))) {
          bestScore = score;
          bestParent = v.parentId;
        }
      }

      if (bestParent === null) {
        throw new SolverNoFeasibleSolutionError(`No feasible parent for slot ${slotKey}`);
      }

      // Set assignment
      for (const vi of varIndices) {
        const v = model.variableByIndex.get(vi)!;
        assignment.set(vi, v.parentId === bestParent ? 1 : 0);
      }

      nightCounts.set(bestParent, (nightCounts.get(bestParent) ?? 0) + 1);
      if (day.isWeekend) {
        weekendCounts.set(bestParent, (weekendCounts.get(bestParent) ?? 0) + 1);
      }
      prevParent.set(childId, bestParent);
      dateSiblingAssignment.set(childId, bestParent);
    }
  }

  return extractCandidate(assignment, model, input);
}
