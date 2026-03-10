import {
  FairnessDeltaBatch,
  FairnessDelta,
  FairnessEventType,
} from '../types';
import { FairnessDriftSummary } from '../../repair/types';
import { FairnessValidationError } from '../errors';

/**
 * Creates normalized fairness event batches from known domain outcomes.
 * All inputs must be explicit — no hidden current-time logic.
 */

export function fromOverlayDrift(input: {
  familyId: string;
  driftSummary: FairnessDriftSummary;
  sourceId?: string;
  effectiveDate: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): FairnessDeltaBatch {
  if (!input.familyId) {
    throw new FairnessValidationError('familyId is required for overlay drift batch');
  }
  if (!input.effectiveDate) {
    throw new FairnessValidationError('effectiveDate is required for overlay drift batch');
  }

  const deltas: FairnessDelta[] = [];
  const sortedParentIds = Object.keys(input.driftSummary.byParentId).sort();

  for (const parentId of sortedParentIds) {
    const drift = input.driftSummary.byParentId[parentId];
    if (drift.nightDelta === 0 && drift.weekendDelta === 0 && drift.holidayDelta === 0) continue;

    deltas.push({
      parentId,
      nightDelta: drift.nightDelta,
      weekendDelta: drift.weekendDelta,
      holidayDelta: drift.holidayDelta,
    });
  }

  return {
    familyId: input.familyId,
    sourceType: 'OVERLAY',
    sourceId: input.sourceId,
    eventType: FairnessEventType.OVERLAY_DRIFT,
    effectiveDate: input.effectiveDate,
    reason: input.reason ?? 'Overlay drift',
    deltas,
    metadata: input.metadata,
  };
}

export function fromRepairRestitution(input: {
  familyId: string;
  residualDrift: FairnessDriftSummary;
  originalDrift: FairnessDriftSummary;
  sourceId?: string;
  effectiveDate: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): FairnessDeltaBatch {
  if (!input.familyId) {
    throw new FairnessValidationError('familyId is required for repair restitution batch');
  }
  if (!input.effectiveDate) {
    throw new FairnessValidationError('effectiveDate is required for repair restitution batch');
  }

  const deltas: FairnessDelta[] = [];
  const sortedParentIds = Object.keys(input.originalDrift.byParentId).sort();

  for (const parentId of sortedParentIds) {
    const original = input.originalDrift.byParentId[parentId];
    const residual = input.residualDrift.byParentId[parentId] ?? { nightDelta: 0, weekendDelta: 0, holidayDelta: 0 };

    // Restitution = what was corrected (original - residual)
    const nightDelta = -(original.nightDelta - residual.nightDelta);
    const weekendDelta = -(original.weekendDelta - residual.weekendDelta);
    const holidayDelta = -(original.holidayDelta - residual.holidayDelta);

    if (nightDelta === 0 && weekendDelta === 0 && holidayDelta === 0) continue;

    deltas.push({ parentId, nightDelta, weekendDelta, holidayDelta });
  }

  return {
    familyId: input.familyId,
    sourceType: 'REPAIR',
    sourceId: input.sourceId,
    eventType: FairnessEventType.REPAIR_RESTITUTION,
    effectiveDate: input.effectiveDate,
    reason: input.reason ?? 'Repair restitution',
    deltas,
    metadata: input.metadata,
  };
}

export function fromProposalAcceptanceReconciliation(input: {
  familyId: string;
  deltas: FairnessDelta[];
  sourceId?: string;
  effectiveDate: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): FairnessDeltaBatch {
  if (!input.familyId) {
    throw new FairnessValidationError('familyId is required for proposal reconciliation batch');
  }
  if (!input.effectiveDate) {
    throw new FairnessValidationError('effectiveDate is required for proposal reconciliation batch');
  }

  const sortedDeltas = [...input.deltas].sort((a, b) => a.parentId.localeCompare(b.parentId));

  return {
    familyId: input.familyId,
    sourceType: 'PROPOSAL',
    sourceId: input.sourceId,
    eventType: FairnessEventType.PROPOSAL_ACCEPTANCE_RECONCILIATION,
    effectiveDate: input.effectiveDate,
    reason: input.reason ?? 'Proposal acceptance reconciliation',
    deltas: sortedDeltas,
    metadata: input.metadata,
  };
}

export function fromManualAdjustment(input: {
  familyId: string;
  deltas: FairnessDelta[];
  sourceId?: string;
  effectiveDate: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): FairnessDeltaBatch {
  if (!input.familyId) {
    throw new FairnessValidationError('familyId is required for manual adjustment batch');
  }
  if (!input.effectiveDate) {
    throw new FairnessValidationError('effectiveDate is required for manual adjustment batch');
  }

  const sortedDeltas = [...input.deltas].sort((a, b) => a.parentId.localeCompare(b.parentId));

  return {
    familyId: input.familyId,
    sourceType: 'MANUAL',
    sourceId: input.sourceId,
    eventType: FairnessEventType.MANUAL_ADJUSTMENT,
    effectiveDate: input.effectiveDate,
    reason: input.reason ?? 'Manual adjustment',
    deltas: sortedDeltas,
    metadata: input.metadata,
  };
}
