// Types
export type {
  ProposalOrigin,
  ProposalGenerationInput,
  ProposalCandidateInput,
  ProposalReviewBundle,
  ProposalScoreSummary,
  ProposalFairnessSummary,
  ProposalReviewMetadata,
  ProposalArtifact,
  ProposalAcceptanceInput,
  ProposalAcceptanceResult,
} from './types';

// Errors
export {
  ProposalGenerationError,
  ProposalReviewError,
  ProposalAcceptanceError,
  ProposalRejectionError,
  ProposalInvalidationError,
  ProposalOriginError,
  ProposalArtifactError,
} from './errors';

// Core
export { ProposalGenerationService } from './core/ProposalGenerationService';
export { materializeCandidate } from './core/ProposalCandidateMaterializer';
export { ProposalFairnessCoordinator } from './core/ProposalFairnessCoordinator';
export { ProposalOverlayCoordinator } from './core/ProposalOverlayCoordinator';
export type { IDisruptionOverlayRepository } from './core/ProposalOverlayCoordinator';
export { collectCandidateArtifacts } from './core/ProposalArtifactCollector';

// Review
export { ProposalReviewService } from './review/ProposalReviewService';
export type { ProposalReviewServiceDeps } from './review/ProposalReviewService';
export { buildScoreSummary } from './review/ProposalScoreSummaryBuilder';
export { buildFairnessSummary } from './review/ProposalFairnessSummaryBuilder';

// Workflows
export { ProposalAcceptanceWorkflow } from './workflows/ProposalAcceptanceWorkflow';
export type { ProposalAcceptanceWorkflowDeps } from './workflows/ProposalAcceptanceWorkflow';
export { ProposalRejectionWorkflow } from './workflows/ProposalRejectionWorkflow';
export { ProposalInvalidationService } from './workflows/ProposalInvalidationService';

// Materialization
export {
  buildDiffArtifact,
  buildChangedNightArtifact,
  buildExchangeArtifact,
  buildScoreArtifact,
  buildFairnessArtifact,
  buildAcceptanceArtifact,
} from './materialization/ProposalArtifactBuilder';
export { buildReviewArtifacts } from './materialization/ProposalReviewArtifactBuilder';
