import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { ProposalOrigin, ProposalArtifact } from '../types';
import {
  FairnessDeltaBatch,
  FairnessLedgerState,
} from '../../fairness/types';
import { reconcileAcceptedScheduleChange } from '../../fairness/ledger/FairnessLedgerReconciler';
import { FairnessStateService } from '../../fairness/core/FairnessStateService';
import { buildFairnessArtifacts } from '../../fairness/materialization/FairnessArtifactBuilder';

/**
 * Coordinates fairness ledger updates during proposal acceptance.
 */
export class ProposalFairnessCoordinator {
  constructor(private readonly fairnessService: FairnessStateService | null) {}

  /**
   * Build fairness delta batch from accepted proposal effects.
   * Returns null if no fairness-relevant delta exists.
   */
  buildAcceptanceFairnessBatch(input: {
    familyId: string;
    priorActiveSchedule: ScheduleSnapshot;
    acceptedSchedule: ScheduleSnapshot;
    proposalId: string;
    acceptedAt: string;
    origin: ProposalOrigin;
  }): FairnessDeltaBatch | null {
    const batch = reconcileAcceptedScheduleChange({
      familyId: input.familyId,
      previousLedger: { familyId: input.familyId, byParentId: {} },
      priorActiveSchedule: input.priorActiveSchedule,
      acceptedSchedule: input.acceptedSchedule,
      sourceType: input.origin === 'REPAIR_SOLVER' ? 'REPAIR_ACCEPTANCE' : 'PROPOSAL_ACCEPTANCE',
      sourceId: input.proposalId,
      effectiveDate: input.acceptedAt.slice(0, 10),
    });

    if (batch.deltas.length === 0) return null;
    return batch;
  }

  /**
   * Append fairness effects during acceptance and return artifacts.
   */
  async appendAcceptanceFairnessEffects(input: {
    familyId: string;
    priorActiveSchedule: ScheduleSnapshot;
    acceptedSchedule: ScheduleSnapshot;
    proposalId: string;
    acceptedAt: string;
    origin: ProposalOrigin;
    parentIds: string[];
  }): Promise<ProposalArtifact[]> {
    const batch = this.buildAcceptanceFairnessBatch(input);

    if (!batch || !this.fairnessService) {
      return [];
    }

    const updatedState = await this.fairnessService.appendDeltaBatch(batch);
    const artifacts = buildFairnessArtifacts({
      currentState: updatedState,
      eventBatch: batch,
    });

    return artifacts.map(a => ({
      type: a.type,
      data: a.data,
    }));
  }
}
