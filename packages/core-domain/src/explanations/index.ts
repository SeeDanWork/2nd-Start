// Types
export type {
  ExplanationTargetType,
  ExplanationImportance,
  ExplanationCategory,
  SourceArtifactRef,
  ExplanationRecord,
  ExplanationSummary,
  ExplanationArtifact,
  ExplanationBundle,
  NormalizedArtifact,
  ScheduleSnapshot,
  ChangeExplanationInput,
  ExplanationBuildInput,
  ExplanationQueryResult,
  IExplanationRecordRepository,
  IExplanationSourceArtifactRepository,
} from './types';

// Errors
export {
  ExplanationBuildError,
  ExplanationQueryError,
  ExplanationPersistenceError,
  ExplanationArtifactNormalizationError,
  UnsupportedExplanationTargetError,
} from './errors';

// Core
export {
  ArtifactNormalizer,
  SourceArtifactRegistry,
  ExplanationEngine,
} from './core';
export type { RawArtifactInput, ExplanationEngineDeps } from './core';

// Builders
export {
  ChangeExplanationBuilder,
  FairnessExplanationBuilder,
  PolicyExplanationBuilder,
  CalendarExplanationBuilder,
  AcceptanceExplanationBuilder,
  ExplanationSummaryBuilder,
} from './builders';

// Query
export {
  ExplanationQueryService,
  ExplanationBundleAssembler,
} from './query';
export type { ExplanationQueryServiceDeps } from './query';
