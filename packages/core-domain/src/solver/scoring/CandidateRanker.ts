import {
  NormalizedSolverInput,
  CandidateNight,
  CandidateExchange,
  SolverScore,
  SolverScoreBreakdown,
} from '../types';
import { computeStabilityScore } from '../objectives/StabilityObjective';
import { computeFamilyStructureScore } from '../objectives/FamilyStructureObjective';
import { computeFairnessScore } from '../objectives/FairnessObjective';
import { computeParentPreferenceScore } from '../objectives/ParentPreferenceObjective';
import { computeChildPreferenceScore } from '../objectives/ChildPreferenceObjective';
import { computeLogisticsScore } from '../objectives/LogisticsObjective';
import { computeConvenienceScore } from '../objectives/ConvenienceObjective';

export interface ScoredCandidateData {
  candidateId: string;
  nights: CandidateNight[];
  exchanges: CandidateExchange[];
  penaltyScore: number;
}

/**
 * Computes the full tiered score for a candidate.
 *
 * total = primaryMultiplier * primaryScore + secondaryScore - penalties
 *
 * Primary tier: stability + familyStructure + fairness
 * Secondary tier: parentPreference + childPreference + logistics + convenience
 */
export function computeCandidateScore(
  data: ScoredCandidateData,
  input: NormalizedSolverInput,
): SolverScore {
  const weights = input.config.objectiveWeights;

  // Primary objectives
  const stabilityResult = computeStabilityScore(data.nights, data.exchanges, input);
  const structureResult = computeFamilyStructureScore(data.nights, input);
  const fairnessResult = computeFairnessScore(data.nights, input);

  const stabilityWeighted = stabilityResult.score * weights.stability;
  const structureWeighted = structureResult.score * weights.familyStructure;
  const fairnessWeighted = fairnessResult.total * weights.fairness;

  const primaryScore = stabilityWeighted + structureWeighted + fairnessWeighted;

  // Secondary objectives
  const parentPrefScore = computeParentPreferenceScore(data.nights, input);
  const childPrefScore = computeChildPreferenceScore(data.nights, input);
  const logisticsScore = computeLogisticsScore(data.exchanges, input);
  const convenienceScore = computeConvenienceScore(data.nights, data.exchanges, input);

  const parentPrefWeighted = parentPrefScore * weights.parentPreference;
  const childPrefWeighted = childPrefScore * weights.childPreference;
  const logisticsWeighted = logisticsScore * weights.logistics;
  const convenienceWeighted = convenienceScore * weights.convenience;

  const secondaryScore = parentPrefWeighted + childPrefWeighted + logisticsWeighted + convenienceWeighted;

  const total = input.config.primaryMultiplier * primaryScore + secondaryScore - data.penaltyScore;

  const breakdown: SolverScoreBreakdown = {
    stability: stabilityWeighted,
    familyStructure: structureWeighted,
    fairness: {
      total: fairnessWeighted,
      nights: fairnessResult.nights,
      weekends: fairnessResult.weekends,
      holidays: fairnessResult.holidays,
    },
    parentPreference: parentPrefWeighted,
    childPreference: childPrefWeighted,
    logistics: logisticsWeighted,
    convenience: convenienceWeighted,
    penalties: data.penaltyScore,
  };

  return { total, primaryScore, secondaryScore, breakdown };
}

export interface RankedCandidate extends ScoredCandidateData {
  score: SolverScore;
}

/**
 * Ranks candidates deterministically.
 *
 * Tie-break order:
 *   1. higher total score
 *   2. fewer changed nights from baseline
 *   3. fewer exchanges
 *   4. fewer sibling split nights
 *   5. lexical candidateId
 */
export function rankCandidates(
  candidates: RankedCandidate[],
  input: NormalizedSolverInput,
): RankedCandidate[] {
  return [...candidates].sort((a, b) => {
    // 1. Higher total score first
    const scoreDiff = b.score.total - a.score.total;
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;

    // 2. Fewer changed nights
    const aChanges = countChangedNights(a.nights, input);
    const bChanges = countChangedNights(b.nights, input);
    if (aChanges !== bChanges) return aChanges - bChanges;

    // 3. Fewer exchanges
    if (a.exchanges.length !== b.exchanges.length) return a.exchanges.length - b.exchanges.length;

    // 4. Fewer sibling split nights
    const aSplits = countSplitNights(a.nights, input);
    const bSplits = countSplitNights(b.nights, input);
    if (aSplits !== bSplits) return aSplits - bSplits;

    // 5. Lexical candidateId
    return a.candidateId.localeCompare(b.candidateId);
  });
}

function countChangedNights(nights: CandidateNight[], input: NormalizedSolverInput): number {
  let count = 0;
  for (const n of nights) {
    const baseline = input.baselineNightLookup.get(`${n.date}:${n.childId}`);
    if (baseline !== undefined && baseline !== n.parentId) count++;
  }
  return count;
}

function countSplitNights(nights: CandidateNight[], input: NormalizedSolverInput): number {
  if (input.childIds.length <= 1) return 0;

  const byDate = new Map<string, Set<string>>();
  for (const n of nights) {
    if (!byDate.has(n.date)) byDate.set(n.date, new Set());
    byDate.get(n.date)!.add(n.parentId);
  }

  let splits = 0;
  for (const [, parents] of byDate) {
    if (parents.size > 1) splits++;
  }
  return splits;
}

/**
 * Deduplicates structurally identical candidates.
 * Two candidates are identical if they have the same night assignments.
 */
export function deduplicateCandidates(candidates: RankedCandidate[]): RankedCandidate[] {
  const seen = new Set<string>();
  const result: RankedCandidate[] = [];

  for (const c of candidates) {
    const fingerprint = c.nights
      .map(n => `${n.date}:${n.childId}:${n.parentId}`)
      .join('|');
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      result.push(c);
    }
  }

  return result;
}
