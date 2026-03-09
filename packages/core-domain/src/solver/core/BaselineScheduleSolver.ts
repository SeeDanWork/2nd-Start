import { DateTime } from 'luxon';
import {
  SolverInput,
  SolverResult,
  SolverCandidate,
  WeightProfile,
  ObjectiveWeights,
  NormalizedSolverInput,
} from '../types';
import { SolverNoFeasibleSolutionError } from '../errors';
import { buildSolverInput } from './SolverInputBuilder';
import { buildModel } from '../model/ScheduleModelBuilder';
import { solveDeterministic } from '../model/DeterministicSolver';
import { evaluateCandidatePolicies } from './SolverPolicyCoordinator';
import {
  computeCandidateScore,
  rankCandidates,
  deduplicateCandidates,
  RankedCandidate,
} from '../scoring/CandidateRanker';
import { buildArtifacts } from '../materialization/ArtifactBuilder';
import { createDefaultRegistry } from '../../policy/registry/createDefaultRegistry';

/**
 * Baseline schedule solver orchestrator.
 *
 * Flow:
 *   1. Normalize input
 *   2. Build constraint model
 *   3. Generate deterministic candidates via weight profiles
 *   4. Extract candidates
 *   5. Evaluate policies
 *   6. Compute objective scores
 *   7. Rank candidates
 *   8. Emit artifacts
 *   9. Return result
 *
 * Candidate generation strategy:
 *   - Run solver with a small fixed set of deterministic weight profiles
 *   - Base profile uses provided weights
 *   - Alternative profiles shift emphasis between stability, fairness, and structure
 *   - Extract one candidate per profile
 *   - Deduplicate structurally identical candidates
 *   - Rank the results
 */
export async function solve(input: SolverInput): Promise<SolverResult> {
  // 1. Normalize input
  const normalized = buildSolverInput(input);

  // 2. Build model
  const model = buildModel(normalized);

  // 3. Generate weight profiles
  const profiles = generateWeightProfiles(normalized);

  // 4-6. Solve, extract, evaluate, score each profile
  const registry = createDefaultRegistry();
  const rankedCandidates: RankedCandidate[] = [];

  for (const profile of profiles) {
    // 4. Solve
    const { nights, exchanges } = solveDeterministic(normalized, model, profile);

    // 5. Evaluate policies
    const policyResult = evaluateCandidatePolicies(nights, exchanges, normalized, registry);

    // Skip infeasible candidates (HARD violations)
    if (!policyResult.isFeasible) continue;

    const candidateId = `candidate-${profile.id}`;

    // 6. Compute score
    const score = computeCandidateScore(
      { candidateId, nights, exchanges, penaltyScore: policyResult.penaltyScore },
      normalized,
    );

    rankedCandidates.push({
      candidateId,
      nights,
      exchanges,
      penaltyScore: policyResult.penaltyScore,
      score,
    });
  }

  if (rankedCandidates.length === 0) {
    throw new SolverNoFeasibleSolutionError(
      'All candidates were rejected due to HARD policy violations',
    );
  }

  // 7. Deduplicate and rank
  const deduplicated = deduplicateCandidates(rankedCandidates);
  const ranked = rankCandidates(deduplicated, normalized);

  // Limit to requested count
  const finalCandidates = ranked.slice(0, input.solverConfig.candidateCount);

  // Build full SolverCandidate objects
  const solverCandidates: SolverCandidate[] = finalCandidates.map(rc => {
    // Re-evaluate policies for the final candidate data
    const policyResult = evaluateCandidatePolicies(rc.nights, rc.exchanges, normalized, registry);

    return {
      candidateId: rc.candidateId,
      nights: rc.nights,
      exchanges: rc.exchanges,
      score: rc.score,
      policyEvaluation: policyResult.evaluation,
      metadata: {
        generatedAt: DateTime.now().toISO()!,
        windowStart: normalized.window.startDate,
        windowEnd: normalized.window.endDate,
        baselineScheduleVersionId: input.baselineSchedule?.scheduleVersionId,
        weightProfileId: rc.candidateId.replace('candidate-', ''),
      },
    };
  });

  // 8. Emit artifacts
  const artifacts = buildArtifacts(solverCandidates, normalized);

  // 9. Return result
  return {
    candidates: solverCandidates,
    selectedCandidateId: solverCandidates[0]?.candidateId,
    artifacts,
  };
}

/**
 * Generates a fixed set of deterministic weight profiles for candidate diversity.
 *
 * Profiles:
 *   - "balanced": Original weights as-is
 *   - "stability-focused": 1.5x stability weight
 *   - "fairness-focused": 1.5x fairness weight
 *   - "structure-focused": 1.5x family structure weight
 *   - "minimal-transitions": 2x stability, reduced fairness
 */
function generateWeightProfiles(input: NormalizedSolverInput): WeightProfile[] {
  const base = input.config.objectiveWeights;

  const profiles: WeightProfile[] = [
    { id: 'balanced', label: 'Balanced', weights: { ...base } },
    {
      id: 'stability-focused',
      label: 'Stability Focused',
      weights: { ...base, stability: base.stability * 1.5 },
    },
    {
      id: 'fairness-focused',
      label: 'Fairness Focused',
      weights: {
        ...base,
        fairness: base.fairness * 1.5,
        nightsFairness: base.nightsFairness * 1.5,
        weekendsFairness: base.weekendsFairness * 1.5,
      },
    },
    {
      id: 'structure-focused',
      label: 'Structure Focused',
      weights: { ...base, familyStructure: base.familyStructure * 1.5 },
    },
    {
      id: 'minimal-transitions',
      label: 'Minimal Transitions',
      weights: {
        ...base,
        stability: base.stability * 2,
        fairness: base.fairness * 0.7,
      },
    },
  ];

  return profiles;
}
