// Types
export {
  IntentType,
} from './types';
export type {
  IncomingMessage,
  ExtractedIntentCandidate,
  IntentExtractionResponse,
  ExtractionFamilyContext,
  ValidatedIntentCandidate,
  InterpretedIntent,
  ResolvedEntityMap,
  InterpretationFailure,
  InterpretationStatus,
  MessageInterpretationResult,
  WorkflowRouteResult,
  EntityResolutionResult,
  DateResolutionResult,
  AvailabilityChangePayload,
  SwapRequestPayload,
  DisruptionReportPayload,
  ProposalRequestPayload,
  PolicyConfirmationPayload,
  IntentRecord,
} from './types';

// Errors
export {
  IntentExtractionError,
  IntentValidationError,
  IntentResolutionError,
  MessageInterpretationError,
  IntentRoutingError,
  AmbiguousIntentError,
  UnsupportedIntentTypeError,
} from './errors';

// Validation
export { IntentSchemaRegistry } from './validation/IntentSchemaRegistry';
export { IntentCandidateValidator } from './validation/IntentCandidateValidator';
export type { CandidateValidationResult } from './validation/IntentCandidateValidator';
export { MessageInterpretationValidator } from './validation/MessageInterpretationValidator';
export type { InterpretationValidationResult } from './validation/MessageInterpretationValidator';
export {
  getSchemaForIntentType,
  getAllIntentTypes,
  availabilityChangePayloadSchema,
  swapRequestPayloadSchema,
  disruptionReportPayloadSchema,
  proposalRequestPayloadSchema,
  policyConfirmationPayloadSchema,
} from './validation/schemas';

// Extraction
export type { IntentExtractionProvider } from './extraction/IntentExtractionProvider';
export { LlmIntentExtractionProvider } from './extraction/LlmIntentExtractionProvider';
export type { LlmClient } from './extraction/LlmIntentExtractionProvider';
export { MockIntentExtractionProvider, createStandardMockProvider } from './extraction/MockIntentExtractionProvider';
export { buildIntentExtractionPrompt } from './extraction/intentExtractionPrompt';

// Resolution
export { EntityReferenceResolver } from './resolution/EntityReferenceResolver';
export { DateReferenceResolver } from './resolution/DateReferenceResolver';
export { IntentResolutionCoordinator } from './resolution/IntentResolutionCoordinator';

// Core
export { MessageInterpretationService } from './core/MessageInterpretationService';
export type { MessageInterpretationServiceDeps, FamilyContextLoader } from './core/MessageInterpretationService';
export { MessageInterpretationPersistence } from './core/MessageInterpretationPersistence';

// Routing
export { IntentRouter } from './routing/IntentRouter';
export type { IntentRoute } from './routing/IntentRouter';
export { AvailabilityChangeRoute } from './routing/AvailabilityChangeRoute';
export { SwapRequestRoute } from './routing/SwapRequestRoute';
export { DisruptionReportRoute } from './routing/DisruptionReportRoute';
export { ProposalRequestRoute } from './routing/ProposalRequestRoute';
export { PolicyConfirmationRoute } from './routing/PolicyConfirmationRoute';

// Repositories
export type { IIntentRepository } from './repositories/IIntentRepository';
