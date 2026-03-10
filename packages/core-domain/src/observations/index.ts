// Types
export type {
  BehaviorObservationWindow,
  ObservationEvidenceRecord,
  PolicySuggestionType,
  PolicySuggestionStatus,
  SuggestionEvidenceSummary,
  PolicySuggestion,
  PolicySuggestionCandidate,
  PolicySuggestionReviewBundle,
  SuggestionResolutionInput,
  SuggestionResolutionResult,
  PolicySuggestionEvidenceLink,
} from './types';

// Errors
export {
  ObservationEvidenceError,
  PatternDetectionError,
  PolicySuggestionError,
  PolicySuggestionResolutionError,
  PolicySuggestionReviewError,
  UnsupportedSuggestionConversionError,
} from './errors';

// Evidence
export type { ObservationEvidenceExtractor } from './evidence';
export {
  AcceptedProposalEvidenceExtractor,
  ExchangePatternEvidenceExtractor,
  OverlayCoverageEvidenceExtractor,
  ActivityResponsibilityEvidenceExtractor,
} from './evidence';
export type {
  AcceptedProposalRecord,
  ExchangeRecord,
  OverlayCoverageRecord,
  ActivityRecord,
} from './evidence';

// Detectors
export type { PatternDetector } from './detectors';
export {
  PreferredExchangeDayDetector,
  PreferredExchangeLocationDetector,
  SchoolClosureCoverageDetector,
  MinBlockLengthAdjustmentDetector,
  ActivityResponsibilityDetector,
  SiblingDivergencePreferenceDetector,
  PatternDetectorRegistry,
} from './detectors';

// Core
export { PolicySuggestionService, SuggestionDeduplicator, SuggestionEvidenceSummarizer } from './core';
export type { PolicySuggestionServiceDeps } from './core';

// Review
export { PolicySuggestionReviewService, PolicySuggestionArtifactBuilder } from './review';
export type { PolicySuggestionReviewServiceDeps } from './review';

// Resolution
export { PolicySuggestionResolutionWorkflow } from './suggestions';
export type { PolicySuggestionResolutionWorkflowDeps } from './suggestions';

// Repositories
export type {
  IObservationEvidenceRepository,
  IPolicySuggestionRepository,
  IPolicySuggestionEvidenceLinkRepository,
} from './repositories';
