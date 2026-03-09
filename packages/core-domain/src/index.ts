export * from './enums';
export * from './types';
export * from './models';
export * from './utils';
export * from './errors';
export * from './versioning';
export * from './diff';
export * from './services';
export * from './repositories';
export * from './policy';
export {
  // Re-export solver types with explicit names to avoid conflicts with ./types
  solve,
  buildSolverInput,
  evaluateCandidatePolicies,
  NoOpAvailabilityProvider,
  buildModel,
  solveDeterministic,
  extractCandidate,
  computeStabilityScore,
  computeFamilyStructureScore,
  computeFairnessScore,
  computeParentPreferenceScore,
  computeChildPreferenceScore,
  computeLogisticsScore,
  computeConvenienceScore,
  computeCandidateScore,
  rankCandidates,
  deduplicateCandidates,
  buildArtifacts,
  SolverInputValidationError,
  SolverModelBuildError,
  SolverNoFeasibleSolutionError,
  SolverCandidateExtractionError,
  SolverRankingError,
} from './solver';
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
  SolverCandidateMetadata,
  SolverCandidate,
  SolverArtifact,
  SolverResult,
  AssignmentVariable,
  BuiltScheduleModel,
  UnavailableAssignment,
  AvailabilityConstraintProvider,
  WeightProfile,
} from './solver';
// SolverScoreBreakdown conflicts with types/index.ts — use solver's version via solver import
