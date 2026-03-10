import { DateTime } from 'luxon';
import {
  RepairInput,
  RepairResult,
  RepairCandidate,
  RepairWeightProfile,
  NormalizedRepairInput,
} from '../types';
import { RepairNoFeasibleSolutionError } from '../errors';
import { buildRepairInput } from './RepairInputBuilder';
import { buildRepairModel } from '../model/RepairModelBuilder';
import { solveRepair } from '../model/DeterministicRepairSolver';
import { evaluateRepairPolicies } from './RepairPolicyCoordinator';
import {
  computeRepairScore,
  rankRepairCandidates,
  deduplicateRepairCandidates,
  RankedRepairCandidate,
} from '../scoring/RepairCandidateRanker';
import { buildRepairArtifacts } from '../materialization/RepairArtifactBuilder';
import { createDefaultRegistry } from '../../policy/registry/createDefaultRegistry';

/**
 * Localized repair solver orchestrator.
 *
 * Flow:
 *   1. Normalize input (validate, apply overlays, derive window, compute drift)
 *   2. Build repair model
 *   3. Generate candidates via deterministic weight profiles
 *   4. Evaluate policies, compute scores
 *   5. Rank and deduplicate
 *   6. Emit artifacts
 *   7. Return result
 *
 * Candidate generation: 4 deterministic profiles
 *   - balanced
 *   - calmness-first
 *   - restitution-first (bounded)
 *   - baseline-preserving
 */
export async function solveRepairProblem(input: RepairInput): Promise<RepairResult> {
  // 1. Normalize
  const normalized = buildRepairInput(input);

  // 2. Build model
  const model = buildRepairModel(normalized);

  // 3. Generate profiles
  const profiles = generateRepairProfiles(normalized);

  // 4. Solve each profile
  const registry = createDefaultRegistry();
  const rankedCandidates: RankedRepairCandidate[] = [];

  for (const profile of profiles) {
    const repairedSchedule = solveRepair(normalized, model, profile);

    const policyResult = evaluateRepairPolicies(repairedSchedule, normalized, registry);
    if (!policyResult.isFeasible) continue;

    const candidateId = `repair-${profile.id}`;
    const { score, fairnessDrift } = computeRepairScore(
      { candidateId, repairedSchedule, penaltyScore: policyResult.penaltyScore },
      normalized,
    );

    rankedCandidates.push({
      candidateId,
      repairedSchedule,
      penaltyScore: policyResult.penaltyScore,
      score,
      fairnessDrift,
    });
  }

  if (rankedCandidates.length === 0) {
    throw new RepairNoFeasibleSolutionError('All repair candidates rejected due to HARD policy violations');
  }

  // 5. Deduplicate and rank
  const deduplicated = deduplicateRepairCandidates(rankedCandidates);
  const ranked = rankRepairCandidates(deduplicated);
  const final = ranked.slice(0, input.solverConfig.candidateCount);

  // Build full RepairCandidate objects
  const repairCandidates: RepairCandidate[] = final.map(rc => {
    const policyResult = evaluateRepairPolicies(rc.repairedSchedule, normalized, registry);
    return {
      candidateId: rc.candidateId,
      repairedSchedule: rc.repairedSchedule,
      score: rc.score,
      policyEvaluation: policyResult.evaluation,
      fairnessDrift: rc.fairnessDrift,
      metadata: {
        generatedAt: DateTime.now().toISO()!,
        repairWindowStart: normalized.repairWindow.startDate,
        repairWindowEnd: normalized.repairWindow.endDate,
        baseScheduleVersionId: normalized.activeSchedule.scheduleVersionId,
        overlayIds: input.disruptionOverlays.map(o => o.overlayId),
      },
    };
  });

  // 6. Artifacts
  const artifacts = buildRepairArtifacts(repairCandidates, normalized, normalized.driftSummary);

  return {
    overlaidSchedule: normalized.overlaidSchedule,
    candidates: repairCandidates,
    selectedCandidateId: repairCandidates[0]?.candidateId,
    driftSummary: normalized.driftSummary,
    artifacts,
  };
}

function generateRepairProfiles(input: NormalizedRepairInput): RepairWeightProfile[] {
  const base = input.config.objectiveWeights;

  return [
    { id: 'balanced', label: 'Balanced', weights: { ...base } },
    {
      id: 'calmness-first',
      label: 'Calmness First',
      weights: {
        ...base,
        nearTermCalmness: base.nearTermCalmness * 2,
        stability: base.stability * 1.5,
        fairnessRestitution: base.fairnessRestitution * 0.5,
      },
    },
    {
      id: 'restitution-first',
      label: 'Restitution First',
      weights: {
        ...base,
        fairnessRestitution: base.fairnessRestitution * 2,
        nearTermCalmness: base.nearTermCalmness * 0.7,
      },
    },
    {
      id: 'baseline-preserving',
      label: 'Baseline Preserving',
      weights: {
        ...base,
        stability: base.stability * 2.5,
        nearTermCalmness: base.nearTermCalmness * 1.5,
        fairnessRestitution: base.fairnessRestitution * 0.3,
      },
    },
  ];
}
