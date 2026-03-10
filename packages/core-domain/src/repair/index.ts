// Types
export type {
  RepairWindow,
  DisruptionOverlaySnapshot,
  AppliedOverlayResult,
  OverlayImpact,
  FairnessDriftRecord,
  FairnessDriftSummary,
  RestitutionTarget,
  RepairInput,
  RepairSolverConfig,
  RepairObjectiveWeights,
  NormalizedRepairInput,
  RepairScore,
  RepairScoreBreakdown,
  RepairCandidateMetadata,
  RepairCandidate,
  RepairArtifact,
  RepairResult,
  RepairAssignmentVariable,
  BuiltRepairModel,
  RepairWeightProfile,
} from './types';

// Core
export { solveRepairProblem } from './core/LocalizedRepairSolver';
export { buildRepairInput } from './core/RepairInputBuilder';
export { buildRepairWindow } from './core/RepairWindowBuilder';
export { evaluateRepairPolicies } from './core/RepairPolicyCoordinator';

// Overlay
export { validateOverlays } from './overlay/OverlayValidator';
export { normalizeOverlays } from './overlay/OverlayNormalizer';
export { applyOverlays } from './overlay/OverlayApplicator';

// Fairness
export { calculateOverlayDrift } from './fairness/FairnessDriftCalculator';
export { identifyRestitutionTargets } from './fairness/FairnessRestitutionPlanner';
export { driftToLedgerUpdates } from './fairness/FairnessLedgerAdapter';
export type { FairnessLedgerUpdate } from './fairness/FairnessLedgerAdapter';

// Model
export { buildRepairModel } from './model/RepairModelBuilder';
export { solveRepair } from './model/DeterministicRepairSolver';
export { extractRepairCandidate } from './model/RepairCandidateExtractor';

// Objectives
export {
  computeRepairStabilityScore,
  computeRepairFamilyStructureScore,
  computeFairnessRestitutionScore,
  computeNearTermCalmnessScore,
  computeRepairParentPreferenceScore,
  computeRepairChildPreferenceScore,
  computeRepairLogisticsScore,
  computeRepairConvenienceScore,
} from './objectives';

// Scoring
export { computeRepairScore, rankRepairCandidates, deduplicateRepairCandidates } from './scoring/RepairCandidateRanker';

// Materialization
export { buildRepairArtifacts } from './materialization/RepairArtifactBuilder';

// Errors
export {
  RepairInputValidationError,
  OverlayValidationError,
  OverlayConflictError,
  RepairWindowError,
  RepairModelBuildError,
  RepairNoFeasibleSolutionError,
  RepairCandidateExtractionError,
  RepairRankingError,
} from './errors';
