import { Proposal } from '../models/Proposal';
import { ProposalSchedule } from '../models/ProposalSchedule';
import { ProposalSnapshot } from '../models/ProposalSnapshot';
import { ScheduleVersion } from '../models/ScheduleVersion';
import { ProposalStatus } from '../enums/ProposalStatus';
import { ScheduleStatus } from '../enums/ScheduleStatus';
import { IProposalRepository } from '../repositories/IProposalRepository';
import { IProposalScheduleRepository } from '../repositories/IProposalScheduleRepository';
import { IScheduleVersionRepository } from '../repositories/IScheduleVersionRepository';
import { INightOwnershipRepository } from '../repositories/INightOwnershipRepository';
import { IExchangeRepository } from '../repositories/IExchangeRepository';
import { ScheduleVersionService } from './ScheduleVersionService';
import {
  ProposalNotFoundError,
  ProposalStaleError,
  ProposalResolutionError,
  ProposalNoScheduleError,
  ScheduleNotFoundError,
} from '../errors';
import { assertProposalPending } from '../versioning/invariants';
import { ScheduleId, FamilyId, ChildId, ParentId } from '../types';
import { SolverScoreBreakdown, FairnessProjection } from '../types';
import { ProposalNightOwnership } from '../models/ProposalNightOwnership';
import { ProposalExchange } from '../models/ProposalExchange';

export interface CreateProposalInput {
  id: string;
  baseScheduleVersionId: ScheduleId;
  createdBy: string;
  type: string;
  expiresAt?: Date | null;
}

export interface AttachProposalScheduleInput {
  id: string;
  proposalId: string;
  scoreBreakdown: SolverScoreBreakdown;
  fairnessProjection: FairnessProjection;
  stabilityDelta: number;
  nights: ProposalNightOwnership[];
  exchanges: ProposalExchange[];
}

export class ProposalService {
  constructor(
    private readonly proposalRepo: IProposalRepository,
    private readonly proposalScheduleRepo: IProposalScheduleRepository,
    private readonly scheduleVersionRepo: IScheduleVersionRepository,
    private readonly nightRepo: INightOwnershipRepository,
    private readonly exchangeRepo: IExchangeRepository,
    private readonly scheduleVersionService: ScheduleVersionService,
  ) {}

  async createProposal(input: CreateProposalInput): Promise<Proposal> {
    const baseVersion = await this.scheduleVersionRepo.findById(input.baseScheduleVersionId);
    if (!baseVersion) {
      throw new ScheduleNotFoundError(input.baseScheduleVersionId);
    }

    const proposal: Proposal = {
      id: input.id,
      baseScheduleVersionId: input.baseScheduleVersionId,
      createdBy: input.createdBy,
      type: input.type,
      status: ProposalStatus.PENDING,
      createdAt: new Date(),
      expiresAt: input.expiresAt ?? null,
      resolvedAt: null,
      invalidatedReason: null,
    };

    return this.proposalRepo.create(proposal);
  }

  async attachProposalSchedule(input: AttachProposalScheduleInput): Promise<ProposalSchedule> {
    const proposal = await this.proposalRepo.findById(input.proposalId);
    if (!proposal) {
      throw new ProposalNotFoundError(input.proposalId);
    }
    assertProposalPending(proposal);

    const schedule: ProposalSchedule = {
      id: input.id,
      proposalId: input.proposalId,
      scoreBreakdown: input.scoreBreakdown,
      fairnessProjection: input.fairnessProjection,
      stabilityDelta: input.stabilityDelta,
      createdAt: new Date(),
    };

    const created = await this.proposalScheduleRepo.create(schedule);

    if (input.nights.length > 0) {
      await this.proposalScheduleRepo.createNights(input.nights);
    }
    if (input.exchanges.length > 0) {
      await this.proposalScheduleRepo.createExchanges(input.exchanges);
    }

    return created;
  }

  async acceptProposal(proposalId: string): Promise<ScheduleVersion> {
    const proposal = await this.proposalRepo.findById(proposalId);
    if (!proposal) {
      throw new ProposalNotFoundError(proposalId);
    }
    assertProposalPending(proposal);

    // Verify base version is still active
    const baseVersion = await this.scheduleVersionRepo.findById(proposal.baseScheduleVersionId);
    if (!baseVersion) {
      throw new ScheduleNotFoundError(proposal.baseScheduleVersionId);
    }
    if (baseVersion.status !== ScheduleStatus.ACTIVE || baseVersion.archivedAt !== null) {
      throw new ProposalStaleError(proposalId, proposal.baseScheduleVersionId);
    }

    // Load proposal schedule contents
    const proposalSchedule = await this.proposalScheduleRepo.findByProposalId(proposalId);
    if (!proposalSchedule) {
      throw new ProposalNoScheduleError(proposalId);
    }

    const proposalNights = await this.proposalScheduleRepo.findNightsByProposalScheduleId(proposalSchedule.id);
    const proposalExchanges = await this.proposalScheduleRepo.findExchangesByProposalScheduleId(proposalSchedule.id);

    // Create new schedule version from proposal contents
    const newVersionId = crypto.randomUUID() as ScheduleId;

    const nights = proposalNights.map(pn => ({
      id: crypto.randomUUID(),
      scheduleId: newVersionId,
      date: pn.date,
      childId: pn.childId,
      parentId: pn.parentId,
      createdAt: new Date(),
    }));

    const exchanges = proposalExchanges.map(pe => ({
      id: crypto.randomUUID(),
      scheduleId: newVersionId,
      childId: pe.childId,
      date: pe.date,
      fromParentId: pe.fromParentId,
      toParentId: pe.toParentId,
      time: pe.time,
      location: pe.location,
      createdAt: new Date(),
    }));

    const newVersion = await this.scheduleVersionService.createDerivedVersionFromProposal({
      id: newVersionId,
      familyId: baseVersion.familyId as FamilyId,
      baselineVersionId: baseVersion.id as ScheduleId,
      startDate: baseVersion.startDate,
      endDate: baseVersion.endDate,
      derivedFromProposalId: proposalId,
      nights,
      exchanges,
    });

    // Activate new version (archives old)
    await this.scheduleVersionService.activateVersion(baseVersion.familyId, newVersion.id);

    // Mark proposal accepted
    await this.proposalRepo.updateStatus(proposalId, ProposalStatus.ACCEPTED, new Date(), null);

    // Invalidate sibling proposals
    await this.invalidateStaleProposals(baseVersion.familyId, newVersion.id);

    return newVersion;
  }

  async rejectProposal(proposalId: string, reason?: string): Promise<void> {
    const proposal = await this.proposalRepo.findById(proposalId);
    if (!proposal) {
      throw new ProposalNotFoundError(proposalId);
    }
    assertProposalPending(proposal);

    await this.proposalRepo.updateStatus(
      proposalId,
      ProposalStatus.REJECTED,
      new Date(),
      reason ?? null,
    );
  }

  async expireProposal(proposalId: string): Promise<void> {
    const proposal = await this.proposalRepo.findById(proposalId);
    if (!proposal) {
      throw new ProposalNotFoundError(proposalId);
    }
    assertProposalPending(proposal);

    await this.proposalRepo.updateStatus(
      proposalId,
      ProposalStatus.EXPIRED,
      new Date(),
      'Proposal expired',
    );
  }

  async invalidateStaleProposals(
    familyId: string,
    activeScheduleVersionId: string,
  ): Promise<number> {
    // Find all pending proposals whose base version is NOT the current active
    const activeVersion = await this.scheduleVersionRepo.findById(activeScheduleVersionId);
    if (!activeVersion) {
      return 0;
    }

    // Get all schedule versions for this family that are now archived
    // and find pending proposals on them
    // Simpler: find pending proposals on versions other than the active one
    const allPendingOnOldBase = await this.findPendingProposalsOnStaleVersions(familyId, activeScheduleVersionId);

    let count = 0;
    for (const proposal of allPendingOnOldBase) {
      await this.proposalRepo.updateStatus(
        proposal.id,
        ProposalStatus.EXPIRED,
        new Date(),
        `Base schedule version ${proposal.baseScheduleVersionId} is no longer active`,
      );
      count++;
    }
    return count;
  }

  async getProposalSnapshot(proposalId: string): Promise<ProposalSnapshot> {
    const proposal = await this.proposalRepo.findById(proposalId);
    if (!proposal) {
      throw new ProposalNotFoundError(proposalId);
    }

    const schedule = await this.proposalScheduleRepo.findByProposalId(proposalId);
    if (!schedule) {
      throw new ProposalNoScheduleError(proposalId);
    }

    const nights = await this.proposalScheduleRepo.findNightsByProposalScheduleId(schedule.id);
    const exchanges = await this.proposalScheduleRepo.findExchangesByProposalScheduleId(schedule.id);

    return {
      proposalId: proposal.id,
      proposalScheduleId: schedule.id,
      baseScheduleVersionId: proposal.baseScheduleVersionId,
      nights,
      exchanges,
    };
  }

  private async findPendingProposalsOnStaleVersions(
    familyId: string,
    activeScheduleVersionId: string,
  ): Promise<Proposal[]> {
    // Get the active version to find its base
    const activeVersion = await this.scheduleVersionRepo.findById(activeScheduleVersionId);
    if (!activeVersion) return [];

    // Find proposals on the old base (which is now the baseline of the active version)
    if (activeVersion.baselineVersionId) {
      return this.proposalRepo.findPendingByBaseVersion(activeVersion.baselineVersionId);
    }
    return [];
  }
}
