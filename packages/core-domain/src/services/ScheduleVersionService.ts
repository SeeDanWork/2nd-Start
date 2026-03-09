import { ScheduleVersion } from '../models/ScheduleVersion';
import { ScheduleSnapshot } from '../models/ScheduleSnapshot';
import { NightOwnership } from '../models/NightOwnership';
import { Exchange } from '../models/Exchange';
import { ScheduleStatus } from '../enums/ScheduleStatus';
import { IScheduleVersionRepository } from '../repositories/IScheduleVersionRepository';
import { INightOwnershipRepository } from '../repositories/INightOwnershipRepository';
import { IExchangeRepository } from '../repositories/IExchangeRepository';
import {
  ScheduleNotFoundError,
  FamilyMismatchError,
  InvalidScheduleActivationError,
} from '../errors';
import { ScheduleId, FamilyId } from '../types';

export interface CreateInitialVersionInput {
  id: ScheduleId;
  familyId: FamilyId;
  startDate: string;
  endDate: string;
  solverRunId?: string | null;
  nights: NightOwnership[];
  exchanges: Exchange[];
}

export interface CreateDerivedVersionInput {
  id: ScheduleId;
  familyId: FamilyId;
  baselineVersionId: ScheduleId;
  startDate: string;
  endDate: string;
  derivedFromProposalId: string;
  nights: NightOwnership[];
  exchanges: Exchange[];
}

export class ScheduleVersionService {
  constructor(
    private readonly scheduleRepo: IScheduleVersionRepository,
    private readonly nightRepo: INightOwnershipRepository,
    private readonly exchangeRepo: IExchangeRepository,
  ) {}

  async createInitialVersion(input: CreateInitialVersionInput): Promise<ScheduleVersion> {
    if (input.startDate >= input.endDate) {
      throw new Error('Start date must be before end date');
    }

    const versionNumber = await this.scheduleRepo.getNextVersionNumber(input.familyId);

    const version: ScheduleVersion = {
      id: input.id,
      familyId: input.familyId,
      baselineVersionId: null,
      status: ScheduleStatus.ACTIVE,
      startDate: input.startDate,
      endDate: input.endDate,
      createdAt: new Date(),
      solverRunId: input.solverRunId ?? null,
      activatedAt: null,
      archivedAt: null,
      derivedFromProposalId: null,
      versionNumber,
    };

    const created = await this.scheduleRepo.create(version);

    if (input.nights.length > 0) {
      await this.nightRepo.createMany(input.nights);
    }
    if (input.exchanges.length > 0) {
      await this.exchangeRepo.createMany(input.exchanges);
    }

    return created;
  }

  async createDerivedVersionFromProposal(input: CreateDerivedVersionInput): Promise<ScheduleVersion> {
    if (input.startDate >= input.endDate) {
      throw new Error('Start date must be before end date');
    }

    const versionNumber = await this.scheduleRepo.getNextVersionNumber(input.familyId);

    const version: ScheduleVersion = {
      id: input.id,
      familyId: input.familyId,
      baselineVersionId: input.baselineVersionId,
      status: ScheduleStatus.ACTIVE,
      startDate: input.startDate,
      endDate: input.endDate,
      createdAt: new Date(),
      solverRunId: null,
      activatedAt: null,
      archivedAt: null,
      derivedFromProposalId: input.derivedFromProposalId,
      versionNumber,
    };

    const created = await this.scheduleRepo.create(version);

    if (input.nights.length > 0) {
      await this.nightRepo.createMany(input.nights);
    }
    if (input.exchanges.length > 0) {
      await this.exchangeRepo.createMany(input.exchanges);
    }

    return created;
  }

  async activateVersion(familyId: string, scheduleVersionId: string): Promise<void> {
    const version = await this.scheduleRepo.findById(scheduleVersionId);
    if (!version) {
      throw new ScheduleNotFoundError(scheduleVersionId);
    }
    if (version.familyId !== familyId) {
      throw new FamilyMismatchError('ScheduleVersion', scheduleVersionId, familyId);
    }
    if (version.status === ScheduleStatus.ARCHIVED) {
      throw new InvalidScheduleActivationError(
        `Cannot activate archived schedule version ${scheduleVersionId}`,
      );
    }

    // Archive current active version
    const currentActive = await this.scheduleRepo.findActiveByFamilyId(familyId);
    if (currentActive && currentActive.id !== scheduleVersionId) {
      await this.scheduleRepo.archive(currentActive.id, new Date());
    }

    await this.scheduleRepo.activate(scheduleVersionId, new Date());
  }

  async getActiveVersion(familyId: string): Promise<ScheduleVersion | null> {
    return this.scheduleRepo.findActiveByFamilyId(familyId);
  }

  async getScheduleSnapshot(scheduleVersionId: string): Promise<ScheduleSnapshot> {
    const version = await this.scheduleRepo.findById(scheduleVersionId);
    if (!version) {
      throw new ScheduleNotFoundError(scheduleVersionId);
    }

    const nights = await this.nightRepo.findByScheduleId(scheduleVersionId);
    const exchanges = await this.exchangeRepo.findByScheduleId(scheduleVersionId);

    return {
      scheduleVersionId: version.id,
      familyId: version.familyId,
      startDate: version.startDate,
      endDate: version.endDate,
      nights,
      exchanges,
    };
  }
}
