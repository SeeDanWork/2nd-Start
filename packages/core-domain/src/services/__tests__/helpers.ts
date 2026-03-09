import { ScheduleVersion } from '../../models/ScheduleVersion';
import { Proposal } from '../../models/Proposal';
import { ProposalSchedule } from '../../models/ProposalSchedule';
import { NightOwnership } from '../../models/NightOwnership';
import { Exchange } from '../../models/Exchange';
import { ProposalNightOwnership } from '../../models/ProposalNightOwnership';
import { ProposalExchange } from '../../models/ProposalExchange';
import { ProposalStatus } from '../../enums/ProposalStatus';
import { ScheduleStatus } from '../../enums/ScheduleStatus';
import { IScheduleVersionRepository } from '../../repositories/IScheduleVersionRepository';
import { IProposalRepository } from '../../repositories/IProposalRepository';
import { IProposalScheduleRepository } from '../../repositories/IProposalScheduleRepository';
import { INightOwnershipRepository } from '../../repositories/INightOwnershipRepository';
import { IExchangeRepository } from '../../repositories/IExchangeRepository';
import { FamilyId, ScheduleId, ChildId, ParentId } from '../../types';

// ── In-memory repositories for testing ──

export class InMemoryScheduleVersionRepository implements IScheduleVersionRepository {
  private versions: ScheduleVersion[] = [];

  async findById(id: string): Promise<ScheduleVersion | null> {
    return this.versions.find(v => v.id === id) ?? null;
  }

  async findActiveByFamilyId(familyId: string): Promise<ScheduleVersion | null> {
    return this.versions.find(v => v.familyId === familyId && v.status === ScheduleStatus.ACTIVE && v.activatedAt !== null) ?? null;
  }

  async getNextVersionNumber(familyId: string): Promise<number> {
    const familyVersions = this.versions.filter(v => v.familyId === familyId);
    if (familyVersions.length === 0) return 1;
    return Math.max(...familyVersions.map(v => v.versionNumber)) + 1;
  }

  async create(version: ScheduleVersion): Promise<ScheduleVersion> {
    this.versions.push({ ...version });
    return version;
  }

  async activate(id: string, activatedAt: Date): Promise<void> {
    const v = this.versions.find(v => v.id === id);
    if (v) {
      v.activatedAt = activatedAt;
      v.status = ScheduleStatus.ACTIVE;
    }
  }

  async archive(id: string, archivedAt: Date): Promise<void> {
    const v = this.versions.find(v => v.id === id);
    if (v) {
      v.archivedAt = archivedAt;
      v.status = ScheduleStatus.ARCHIVED;
    }
  }

  // Test helper
  getAll(): ScheduleVersion[] {
    return [...this.versions];
  }
}

export class InMemoryProposalRepository implements IProposalRepository {
  private proposals: Proposal[] = [];

  async findById(id: string): Promise<Proposal | null> {
    return this.proposals.find(p => p.id === id) ?? null;
  }

  async findPendingByBaseVersion(baseScheduleVersionId: string): Promise<Proposal[]> {
    return this.proposals.filter(
      p => p.baseScheduleVersionId === baseScheduleVersionId && p.status === ProposalStatus.PENDING,
    );
  }

  async create(proposal: Proposal): Promise<Proposal> {
    this.proposals.push({ ...proposal });
    return proposal;
  }

  async updateStatus(id: string, status: ProposalStatus, resolvedAt: Date | null, invalidatedReason: string | null): Promise<void> {
    const p = this.proposals.find(p => p.id === id);
    if (p) {
      p.status = status;
      p.resolvedAt = resolvedAt;
      p.invalidatedReason = invalidatedReason;
    }
  }

  // Test helper
  getAll(): Proposal[] {
    return [...this.proposals];
  }
}

export class InMemoryProposalScheduleRepository implements IProposalScheduleRepository {
  private schedules: ProposalSchedule[] = [];
  private nights: ProposalNightOwnership[] = [];
  private exchanges: ProposalExchange[] = [];

  async findByProposalId(proposalId: string): Promise<ProposalSchedule | null> {
    return this.schedules.find(s => s.proposalId === proposalId) ?? null;
  }

  async create(schedule: ProposalSchedule): Promise<ProposalSchedule> {
    this.schedules.push({ ...schedule });
    return schedule;
  }

  async findNightsByProposalScheduleId(proposalScheduleId: string): Promise<ProposalNightOwnership[]> {
    return this.nights.filter(n => n.proposalScheduleId === proposalScheduleId);
  }

  async findExchangesByProposalScheduleId(proposalScheduleId: string): Promise<ProposalExchange[]> {
    return this.exchanges.filter(e => e.proposalScheduleId === proposalScheduleId);
  }

  async createNights(nights: ProposalNightOwnership[]): Promise<void> {
    this.nights.push(...nights.map(n => ({ ...n })));
  }

  async createExchanges(exchanges: ProposalExchange[]): Promise<void> {
    this.exchanges.push(...exchanges.map(e => ({ ...e })));
  }
}

export class InMemoryNightOwnershipRepository implements INightOwnershipRepository {
  private nights: NightOwnership[] = [];

  async findByScheduleId(scheduleId: string): Promise<NightOwnership[]> {
    return this.nights.filter(n => n.scheduleId === scheduleId);
  }

  async createMany(nights: NightOwnership[]): Promise<void> {
    this.nights.push(...nights.map(n => ({ ...n })));
  }

  getAll(): NightOwnership[] {
    return [...this.nights];
  }
}

export class InMemoryExchangeRepository implements IExchangeRepository {
  private exchanges: Exchange[] = [];

  async findByScheduleId(scheduleId: string): Promise<Exchange[]> {
    return this.exchanges.filter(e => e.scheduleId === scheduleId);
  }

  async createMany(exchanges: Exchange[]): Promise<void> {
    this.exchanges.push(...exchanges.map(e => ({ ...e })));
  }

  getAll(): Exchange[] {
    return [...this.exchanges];
  }
}

// ── Test data factories ──

export const FAMILY_ID = 'family-001' as FamilyId;
export const PARENT_A = 'parent-a' as ParentId;
export const PARENT_B = 'parent-b' as ParentId;
export const CHILD_1 = 'child-1' as ChildId;
export const CHILD_2 = 'child-2' as ChildId;

export function makeNight(
  scheduleId: string,
  date: string,
  childId: string,
  parentId: string,
): NightOwnership {
  return {
    id: `night-${scheduleId}-${date}-${childId}`,
    scheduleId: scheduleId as ScheduleId,
    date,
    childId: childId as ChildId,
    parentId: parentId as ParentId,
    createdAt: new Date(),
  };
}

export function makeExchange(
  scheduleId: string,
  date: string,
  childId: string,
  fromParentId: string,
  toParentId: string,
  time = '08:00',
  location = 'School',
): Exchange {
  return {
    id: `exchange-${scheduleId}-${date}-${childId}`,
    scheduleId: scheduleId as ScheduleId,
    childId: childId as ChildId,
    date,
    fromParentId: fromParentId as ParentId,
    toParentId: toParentId as ParentId,
    time,
    location,
    createdAt: new Date(),
  };
}

export function makeProposalNight(
  proposalScheduleId: string,
  date: string,
  childId: string,
  parentId: string,
): ProposalNightOwnership {
  return {
    id: `pnight-${proposalScheduleId}-${date}-${childId}`,
    proposalScheduleId,
    date,
    childId: childId as ChildId,
    parentId: parentId as ParentId,
    createdAt: new Date(),
  };
}

export function makeProposalExchange(
  proposalScheduleId: string,
  date: string,
  childId: string,
  fromParentId: string,
  toParentId: string,
  time = '08:00',
  location = 'School',
): ProposalExchange {
  return {
    id: `pexchange-${proposalScheduleId}-${date}-${childId}`,
    proposalScheduleId,
    childId: childId as ChildId,
    date,
    fromParentId: fromParentId as ParentId,
    toParentId: toParentId as ParentId,
    time,
    location,
    createdAt: new Date(),
  };
}
