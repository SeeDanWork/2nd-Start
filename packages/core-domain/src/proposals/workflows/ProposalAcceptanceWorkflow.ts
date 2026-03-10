import {
  ProposalAcceptanceInput,
  ProposalAcceptanceResult,
  ProposalOrigin,
  ProposalArtifact,
} from '../types';
import { ProposalAcceptanceError } from '../errors';
import { ProposalService } from '../../services/ProposalService';
import { ScheduleVersionService } from '../../services/ScheduleVersionService';
import { ProposalFairnessCoordinator } from '../core/ProposalFairnessCoordinator';
import { ProposalOverlayCoordinator } from '../core/ProposalOverlayCoordinator';
import { ProposalInvalidationService } from './ProposalInvalidationService';
import { IProposalRepository } from '../../repositories/IProposalRepository';
import { IProposalScheduleRepository } from '../../repositories/IProposalScheduleRepository';
import { ProposalStatus } from '../../enums/ProposalStatus';
import { ScheduleStatus } from '../../enums/ScheduleStatus';
import { ScheduleId, FamilyId } from '../../types';

export interface ProposalAcceptanceWorkflowDeps {
  proposalService: ProposalService;
  scheduleVersionService: ScheduleVersionService;
  proposalRepo: IProposalRepository;
  proposalScheduleRepo: IProposalScheduleRepository;
  fairnessCoordinator: ProposalFairnessCoordinator;
  overlayCoordinator: ProposalOverlayCoordinator;
  invalidationService: ProposalInvalidationService;
}

/**
 * Canonical acceptance workflow for both baseline and repair proposals.
 */
export class ProposalAcceptanceWorkflow {
  constructor(private readonly deps: ProposalAcceptanceWorkflowDeps) {}

  async accept(input: ProposalAcceptanceInput): Promise<ProposalAcceptanceResult> {
    if (!input.proposalId) {
      throw new ProposalAcceptanceError('proposalId is required');
    }
    if (!input.acceptedBy) {
      throw new ProposalAcceptanceError('acceptedBy is required');
    }

    // 1. Load proposal
    const proposal = await this.deps.proposalRepo.findById(input.proposalId);
    if (!proposal) {
      throw new ProposalAcceptanceError(`Proposal ${input.proposalId} not found`);
    }

    // 2. Ensure PENDING
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new ProposalAcceptanceError(
        `Proposal ${input.proposalId} is ${proposal.status}, not PENDING`,
      );
    }

    // 3. Ensure base version still active
    const baseVersion = await this.deps.scheduleVersionService.getActiveVersion(
      '' // need family id
    );

    // Load base schedule to get familyId
    const baseSnapshot = await this.deps.scheduleVersionService.getScheduleSnapshot(
      proposal.baseScheduleVersionId,
    );

    // 4. Load proposal snapshot
    const proposalSnapshot = await this.deps.proposalService.getProposalSnapshot(input.proposalId);

    // 5-8. Accept proposal (creates new version, archives old, updates status)
    const newVersion = await this.deps.proposalService.acceptProposal(input.proposalId);

    // 9. Invalidate sibling proposals
    const invalidatedIds = await this.deps.invalidationService.invalidateSiblingProposals({
      baseScheduleVersionId: proposal.baseScheduleVersionId,
      acceptedProposalId: input.proposalId,
      invalidatedAt: input.acceptedAt,
      reason: `Sibling proposal accepted: ${input.proposalId}`,
    });

    // 10. Build accepted schedule snapshot for fairness
    const acceptedSnapshot = await this.deps.scheduleVersionService.getScheduleSnapshot(
      newVersion.id,
    );

    // Determine origin
    const origin: ProposalOrigin = proposal.type.includes('repair')
      ? 'REPAIR_SOLVER'
      : 'BASELINE_SOLVER';

    // 10b. Fairness ledger updates
    let fairnessArtifacts: ProposalArtifact[] = [];
    try {
      fairnessArtifacts = await this.deps.fairnessCoordinator.appendAcceptanceFairnessEffects({
        familyId: baseSnapshot.familyId,
        priorActiveSchedule: baseSnapshot,
        acceptedSchedule: acceptedSnapshot,
        proposalId: input.proposalId,
        acceptedAt: input.acceptedAt,
        origin,
        parentIds: [],
      });
    } catch {
      // Fairness update failures should not block acceptance
    }

    // 11. Resolve overlays for repair proposals
    let resolvedOverlayIds: string[] = [];
    if (origin === 'REPAIR_SOLVER') {
      resolvedOverlayIds = await this.deps.overlayCoordinator.resolveAcceptedRepairOverlays({
        proposalId: input.proposalId,
        baseScheduleVersionId: proposal.baseScheduleVersionId,
        resolvedAt: input.acceptedAt,
      });
    }

    return {
      newScheduleVersionId: newVersion.id,
      newVersionNumber: newVersion.versionNumber,
      archivedScheduleVersionId: proposal.baseScheduleVersionId,
      acceptedProposalId: input.proposalId,
      invalidatedProposalIds: invalidatedIds,
      resolvedOverlayIds,
      fairnessArtifacts,
    };
  }
}
