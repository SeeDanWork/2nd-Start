// Types
export type {
  PlanningWindow,
  SolverInput,
  SolverConfig,
  ObjectiveWeights,
  FairnessState,
  FixedHolidayAssignment,
  DayInfo,
  NormalizedSolverInput,
  CandidateNight,
  CandidateExchange,
  SolverScore,
  SolverScoreBreakdown,
  SolverCandidateMetadata,
  SolverCandidate,
  SolverArtifact,
  SolverResult,
  AssignmentVariable,
  BuiltScheduleModel,
  UnavailableAssignment,
  AvailabilityConstraintProvider,
  WeightProfile,
} from './types';

// Core
export { solve } from './core/BaselineScheduleSolver';
export { buildSolverInput } from './core/SolverInputBuilder';
export { evaluateCandidatePolicies } from './core/SolverPolicyCoordinator';
export { NoOpAvailabilityProvider } from './core/NoOpAvailabilityProvider';

// Model
export { buildModel } from './model/ScheduleModelBuilder';
export { solveDeterministic } from './model/DeterministicSolver';
export { extractCandidate } from './model/CandidateExtractor';

// Objectives
export {
  computeStabilityScore,
  computeFamilyStructureScore,
  computeFairnessScore,
  computeParentPreferenceScore,
  computeChildPreferenceScore,
  computeLogisticsScore,
  computeConvenienceScore,
} from './objectives';

// Scoring
export {
  computeCandidateScore,
  rankCandidates,
  deduplicateCandidates,
} from './scoring/CandidateRanker';

// Materialization
export { buildArtifacts } from './materialization/ArtifactBuilder';

// Errors
export {
  SolverInputValidationError,
  SolverModelBuildError,
  SolverNoFeasibleSolutionError,
  SolverCandidateExtractionError,
  SolverRankingError,
} from './errors';
