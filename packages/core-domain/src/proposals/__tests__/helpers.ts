import { vi } from 'vitest';
import { Proposal } from '../../models/Proposal';
import { ProposalSchedule } from '../../models/ProposalSchedule';
import { ProposalNightOwnership } from '../../models/ProposalNightOwnership';
import { ProposalExchange } from '../../models/ProposalExchange';
import { ProposalSnapshot } from '../../models/ProposalSnapshot';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { NightOwnership } from '../../models/NightOwnership';
import { ProposalStatus } from '../../enums/ProposalStatus';
import { ScheduleId, FamilyId, ChildId, ParentId, SolverScoreBreakdown, FairnessProjection } from '../../types';
import { IProposalRepository } from '../../repositories/IProposalRepository';
import { IProposalScheduleRepository } from '../../repositories/IProposalScheduleRepository';
import { ProposalCandidateInput } from '../types';

export const FAMILY_ID = 'family-1' as FamilyId;
export const PARENT_A = 'parent-a' as ParentId;
export const PARENT_B = 'parent-b' as ParentId;
export const CHILD_1 = 'child-1' as ChildId;
export const SCHEDULE_V1 = 'sv-1' as ScheduleId;
export const SCHEDULE_V2 = 'sv-2' as ScheduleId;

export function makeProposal(overrides?: Partial<Proposal>): Proposal {
  return {
    id: 'proposal-1',
    baseScheduleVersionId: SCHEDULE_V1,
    createdBy: PARENT_A as string,
    type: 'BASELINE',
    status: ProposalStatus.PENDING,
    createdAt: new Date('2026-03-01'),
    expiresAt: null,
    resolvedAt: null,
    invalidatedReason: null,
    ...overrides,
  };
}

export function makeProposalSchedule(overrides?: Partial<ProposalSchedule>): ProposalSchedule {
  return {
    id: 'ps-1',
    proposalId: 'proposal-1',
    scoreBreakdown: {
      fairnessScore: 0.8,
      stabilityScore: 0.9,
      transitionPenalty: 0.1,
      policyViolationPenalty: 0,
      totalScore: 85,
    },
    fairnessProjection: {
      parentANightDelta: -1,
      parentBNightDelta: 1,
      weekendParityDelta: 0,
      projectedDeviationAfter: 0.5,
    },
    stabilityDelta: 0.05,
    createdAt: new Date('2026-03-01'),
    ...overrides,
  };
}

export function makeNight(date: string, childId: string, parentId: string, scheduleId: string = SCHEDULE_V1 as string): NightOwnership {
  return {
    id: `night-${date}-${childId}-${scheduleId}`,
    scheduleId: scheduleId as ScheduleId,
    date,
    childId: childId as ChildId,
    parentId: parentId as ParentId,
    createdAt: new Date('2026-01-01'),
  };
}

export function makeProposalNight(date: string, childId: string, parentId: string, proposalScheduleId: string = 'ps-1'): ProposalNightOwnership {
  return {
    id: `pn-${date}-${childId}`,
    proposalScheduleId,
    date,
    childId: childId as ChildId,
    parentId: parentId as ParentId,
    createdAt: new Date('2026-03-01'),
  };
}

export function makeProposalExchange(date: string, childId: string, fromParentId: string, toParentId: string, proposalScheduleId: string = 'ps-1'): ProposalExchange {
  return {
    id: `pe-${date}-${childId}`,
    proposalScheduleId,
    childId: childId as ChildId,
    date,
    fromParentId: fromParentId as ParentId,
    toParentId: toParentId as ParentId,
    time: '18:00',
    location: 'School',
    createdAt: new Date('2026-03-01'),
  };
}

export function makeScheduleSnapshot(nights: NightOwnership[], versionId: string = SCHEDULE_V1 as string): ScheduleSnapshot {
  return {
    scheduleVersionId: versionId as ScheduleId,
    familyId: FAMILY_ID,
    startDate: '2026-03-01',
    endDate: '2026-03-14',
    nights,
    exchanges: [],
  };
}

export function makeCandidate(overrides?: Partial<ProposalCandidateInput>): ProposalCandidateInput {
  return {
    candidateId: 'cand-0',
    nights: [
      { date: '2026-03-01', childId: CHILD_1 as string, parentId: PARENT_A as string },
      { date: '2026-03-02', childId: CHILD_1 as string, parentId: PARENT_B as string },
    ],
    exchanges: [],
    scoreBreakdown: { totalScore: 85, primaryScore: 80, secondaryScore: 5 },
    fairnessProjection: { projectedNightDeviationByParentId: { [PARENT_A as string]: -0.5, [PARENT_B as string]: 0.5 } },
    stabilityDelta: 0.05,
    ...overrides,
  };
}

export function makeMockProposalRepo(proposals: Map<string, Proposal> = new Map()): IProposalRepository {
  return {
    findById: vi.fn(async (id: string) => proposals.get(id) ?? null),
    findPendingByBaseVersion: vi.fn(async (baseVersionId: string) =>
      [...proposals.values()].filter(p => p.baseScheduleVersionId === baseVersionId && p.status === ProposalStatus.PENDING),
    ),
    create: vi.fn(async (p: Proposal) => {
      proposals.set(p.id, p);
      return p;
    }),
    updateStatus: vi.fn(async (id: string, status: ProposalStatus, resolvedAt: Date | null, reason: string | null) => {
      const p = proposals.get(id);
      if (p) {
        p.status = status;
        p.resolvedAt = resolvedAt;
        p.invalidatedReason = reason;
      }
    }),
  };
}

export function makeMockProposalScheduleRepo(
  schedules: Map<string, ProposalSchedule> = new Map(),
  nights: ProposalNightOwnership[] = [],
  exchanges: ProposalExchange[] = [],
): IProposalScheduleRepository {
  return {
    findByProposalId: vi.fn(async (proposalId: string) =>
      [...schedules.values()].find(s => s.proposalId === proposalId) ?? null,
    ),
    create: vi.fn(async (s: ProposalSchedule) => {
      schedules.set(s.id, s);
      return s;
    }),
    findNightsByProposalScheduleId: vi.fn(async (psId: string) =>
      nights.filter(n => n.proposalScheduleId === psId),
    ),
    findExchangesByProposalScheduleId: vi.fn(async (psId: string) =>
      exchanges.filter(e => e.proposalScheduleId === psId),
    ),
    createNights: vi.fn(async (n: ProposalNightOwnership[]) => {
      nights.push(...n);
    }),
    createExchanges: vi.fn(async (e: ProposalExchange[]) => {
      exchanges.push(...e);
    }),
  };
}
