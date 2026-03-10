// Types
export type {
  FairnessLedgerState,
  FairnessLedgerRow,
  FairnessLedgerEventRecord,
  FairnessDelta,
  FairnessDeltaBatch,
  FairnessProjectionInput,
  FairnessProjectionResult,
  FairnessArtifact,
} from './types';
export { FairnessEventType } from './types';

// Errors
export {
  FairnessValidationError,
  FairnessLedgerNotFoundError,
  FairnessDuplicateEventError,
  FairnessProjectionError,
  FairnessReconciliationError,
} from './errors';

// Ledger
export {
  fromOverlayDrift,
  fromRepairRestitution,
  fromProposalAcceptanceReconciliation,
  fromManualAdjustment,
} from './ledger/FairnessEventFactory';
export { applyDeltaBatch } from './ledger/FairnessLedgerAccumulator';
export { reconcileAcceptedScheduleChange } from './ledger/FairnessLedgerReconciler';

// Materialization
export { buildLedgerState, createEmptyLedgerState } from './materialization/FairnessSnapshotBuilder';
export { buildFairnessArtifacts } from './materialization/FairnessArtifactBuilder';

// Projection
export { calculateScheduleDelta } from './projection/ScheduleFairnessDeltaCalculator';
export { project as projectFairness } from './projection/FairnessProjectionEngine';

// Service
export { FairnessStateService } from './core/FairnessStateService';
export type { FairnessStateServiceDeps } from './core/FairnessStateService';

// Adapters
export {
  driftSummaryToDeltaBatch,
  ledgerStateToSolverFairnessState,
  solverFairnessStateToLedgerState,
} from './core/adapters';

// Repositories
export type { IFairnessLedgerRepository, FairnessLedgerUpsertInput } from './repositories/IFairnessLedgerRepository';
export type { IFairnessLedgerEventRepository } from './repositories/IFairnessLedgerEventRepository';

// Idempotency
export { buildIdempotencyKey } from './core/IdempotencyKeyBuilder';
