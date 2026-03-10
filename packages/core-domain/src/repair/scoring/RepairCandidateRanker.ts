import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import {
  NormalizedRepairInput,
  RepairScore,
  RepairScoreBreakdown,
  FairnessDriftSummary,
} from '../types';
import { computeRepairStabilityScore } from '../objectives/StabilityRepairObjective';
import { computeRepairFamilyStructureScore } from '../objectives/FamilyStructureRepairObjective';
import { computeFairnessRestitutionScore } from '../objectives/FairnessRestitutionObjective';
import { computeNearTermCalmnessScore } from '../objectives/NearTermCalmnessObjective';
import {
  computeRepairParentPreferenceScore,
  computeRepairChildPreferenceScore,
  computeRepairLogisticsScore,
  computeRepairConvenienceScore,
} from '../objectives/RepairPlaceholderObjectives';

export interface ScoredRepairData {
  candidateId: string;
  repairedSchedule: ScheduleSnapshot;
  penaltyScore: number;
}

export interface RankedRepairCandidate extends ScoredRepairData {
  score: RepairScore;
  fairnessDrift: FairnessDriftSummary;
}

/**
 * Computes the full tiered score for a repair candidate.
 *
 * total = primaryMultiplier * primaryScore + secondaryScore - penalties
 */
export function computeRepairScore(
  data: ScoredRepairData,
  input: NormalizedRepairInput,
): { score: RepairScore; fairnessDrift: FairnessDriftSummary } {
  const weights = input.config.objectiveWeights;

  const stabilityResult = computeRepairStabilityScore(data.repairedSchedule, input);
  const structureResult = computeRepairFamilyStructureScore(data.repairedSchedule, input);
  const restitutionResult = computeFairnessRestitutionScore(data.repairedSchedule, input);
  const calmnessResult = computeNearTermCalmnessScore(data.repairedSchedule, input);

  const stabilityWeighted = stabilityResult.score * weights.stability;
  const structureWeighted = structureResult.score * weights.familyStructure;
  const restitutionWeighted = restitutionResult.score * weights.fairnessRestitution;
  const calmnessWeighted = calmnessResult.score * weights.nearTermCalmness;

  const primaryScore = stabilityWeighted + structureWeighted + restitutionWeighted + calmnessWeighted;

  const parentPref = computeRepairParentPreferenceScore(data.repairedSchedule, input) * weights.parentPreference;
  const childPref = computeRepairChildPreferenceScore(data.repairedSchedule, input) * weights.childPreference;
  const logistics = computeRepairLogisticsScore(data.repairedSchedule, input) * weights.logistics;
  const convenience = computeRepairConvenienceScore(data.repairedSchedule, input) * weights.convenience;

  const secondaryScore = parentPref + childPref + logistics + convenience;
  const total = input.config.primaryMultiplier * primaryScore + secondaryScore - data.penaltyScore;

  const breakdown: RepairScoreBreakdown = {
    stability: stabilityWeighted,
    familyStructure: structureWeighted,
    fairnessRestitution: restitutionWeighted,
    nearTermCalmness: calmnessWeighted,
    parentPreference: parentPref,
    childPreference: childPref,
    logistics,
    convenience,
    penalties: data.penaltyScore,
    changedNightCount: stabilityResult.changedNights,
    changedExchangeCount: stabilityResult.changedExchanges,
    restitutionNightCount: restitutionResult.restitutionNightCount,
  };

  return {
    score: { total, primaryScore, secondaryScore, breakdown },
    fairnessDrift: restitutionResult.residualDrift,
  };
}

/**
 * Ranks repair candidates deterministically.
 *
 * Tie-break order:
 *   1. higher total score
 *   2. fewer additional changed nights beyond overlays
 *   3. fewer added exchanges
 *   4. lower sibling split count
 *   5. better fairness restitution (more restitution nights)
 *   6. lexical candidateId
 */
export function rankRepairCandidates(
  candidates: RankedRepairCandidate[],
): RankedRepairCandidate[] {
  return [...candidates].sort((a, b) => {
    const scoreDiff = b.score.total - a.score.total;
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;

    const aChanges = a.score.breakdown.changedNightCount;
    const bChanges = b.score.breakdown.changedNightCount;
    if (aChanges !== bChanges) return aChanges - bChanges;

    const aExchanges = a.score.breakdown.changedExchangeCount;
    const bExchanges = b.score.breakdown.changedExchangeCount;
    if (aExchanges !== bExchanges) return aExchanges - bExchanges;

    // Sibling splits — computed from breakdown isn't directly available, use familyStructure inversely
    const aStruct = a.score.breakdown.familyStructure;
    const bStruct = b.score.breakdown.familyStructure;
    if (Math.abs(aStruct - bStruct) > 1e-9) return bStruct - aStruct; // higher is better

    // More restitution is better
    const aRest = a.score.breakdown.restitutionNightCount;
    const bRest = b.score.breakdown.restitutionNightCount;
    if (aRest !== bRest) return bRest - aRest;

    return a.candidateId.localeCompare(b.candidateId);
  });
}

/**
 * Deduplicates structurally identical repair candidates.
 */
export function deduplicateRepairCandidates(candidates: RankedRepairCandidate[]): RankedRepairCandidate[] {
  const seen = new Set<string>();
  const result: RankedRepairCandidate[] = [];

  for (const c of candidates) {
    const fp = c.repairedSchedule.nights
      .map(n => `${n.date}:${n.childId}:${n.parentId}`)
      .join('|');
    if (!seen.has(fp)) {
      seen.add(fp);
      result.push(c);
    }
  }

  return result;
}
