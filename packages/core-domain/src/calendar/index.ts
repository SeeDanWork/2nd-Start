// Types
export type {
  CalendarEventScopeType,
  CalendarEventKind,
  CalendarConstraintLevel,
  ExternalCalendarEvent,
  NormalizedCalendarEvent,
  ClassifiedCalendarEvent,
  CalendarConstraintRecord,
  CalendarAvailabilityView,
  CalendarTranslationResult,
  CalendarArtifact,
  CalendarProjectionInput,
  CalendarFamilyContext,
  CalendarIngestionResult,
  CalendarEventRecord,
} from './types';

// Errors
export {
  CalendarNormalizationError,
  CalendarScopeResolutionError,
  CalendarClassificationError,
  CalendarIngestionError,
  CalendarTranslationError,
  CalendarDeduplicationError,
} from './errors';

// Core
export { CalendarScopeResolver } from './core/CalendarScopeResolver';
export type { ScopeResolutionResult } from './core/CalendarScopeResolver';
export { CalendarSolverAdapter } from './core/CalendarSolverAdapter';

// Classification
export { CalendarEventKindInferer } from './classification/CalendarEventKindInferer';
export { CalendarConstraintClassifier } from './classification/CalendarConstraintClassifier';
export { getClassificationRule } from './classification/CalendarClassificationPolicy';

// Ingestion
export { CalendarEventNormalizer } from './ingestion/CalendarEventNormalizer';
export { CalendarEventDeduplicator } from './ingestion/CalendarEventDeduplicator';
export type { DeduplicationResult } from './ingestion/CalendarEventDeduplicator';
export { CalendarEventIngestionService } from './ingestion/CalendarEventIngestionService';
export type { CalendarEventIngestionServiceDeps } from './ingestion/CalendarEventIngestionService';

// Translation
export { CalendarConstraintTranslator } from './translation/CalendarConstraintTranslator';
export { CalendarAvailabilityBuilder } from './translation/CalendarAvailabilityBuilder';
export { CalendarProjectionService } from './translation/CalendarProjectionService';

// Materialization
export {
  buildIngestionArtifact,
  buildClassificationArtifact,
  buildWindowConstraintArtifact,
  buildUnresolvedScopeArtifact,
} from './materialization/CalendarArtifactBuilder';
export { materializeToRecord, materializeBatch } from './materialization/CalendarEventMaterializer';

// Repository
export type { ICalendarEventRepository } from './repositories/ICalendarEventRepository';
