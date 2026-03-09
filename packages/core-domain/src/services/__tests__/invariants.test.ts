import { describe, it, expect } from 'vitest';
import { assertScheduleWritable, assertProposalPending, assertProposalNotResolved } from '../../versioning/invariants';
import { ScheduleVersion } from '../../models/ScheduleVersion';
import { Proposal } from '../../models/Proposal';
import { ScheduleStatus } from '../../enums/ScheduleStatus';
import { ProposalStatus } from '../../enums/ProposalStatus';
import { ScheduleId, FamilyId } from '../../types';

function makeVersion(overrides?: Partial<ScheduleVersion>): ScheduleVersion {
  return {
    id: 'v1' as ScheduleId,
    familyId: 'f1' as FamilyId,
    baselineVersionId: null,
    status: ScheduleStatus.ACTIVE,
    startDate: '2026-03-01',
    endDate: '2026-05-31',
    createdAt: new Date(),
    solverRunId: null,
    activatedAt: null,
    archivedAt: null,
    derivedFromProposalId: null,
    versionNumber: 1,
    ...overrides,
  };
}

function makeProposal(overrides?: Partial<Proposal>): Proposal {
  return {
    id: 'p1',
    baseScheduleVersionId: 'v1' as ScheduleId,
    createdBy: 'parent-a',
    type: 'swap',
    status: ProposalStatus.PENDING,
    createdAt: new Date(),
    expiresAt: null,
    resolvedAt: null,
    invalidatedReason: null,
    ...overrides,
  };
}

describe('Invariants', () => {
  describe('assertScheduleWritable', () => {
    it('allows writing to non-activated schedule', () => {
      const version = makeVersion({ activatedAt: null });
      expect(() => assertScheduleWritable(version)).not.toThrow();
    });

    it('throws for activated schedule', () => {
      const version = makeVersion({ activatedAt: new Date() });
      expect(() => assertScheduleWritable(version)).toThrow('is immutable');
    });
  });

  describe('assertProposalPending', () => {
    it('allows pending proposals', () => {
      const proposal = makeProposal({ status: ProposalStatus.PENDING });
      expect(() => assertProposalPending(proposal)).not.toThrow();
    });

    it('throws for accepted proposals', () => {
      const proposal = makeProposal({ status: ProposalStatus.ACCEPTED });
      expect(() => assertProposalPending(proposal)).toThrow('cannot be resolved');
    });

    it('throws for rejected proposals', () => {
      const proposal = makeProposal({ status: ProposalStatus.REJECTED });
      expect(() => assertProposalPending(proposal)).toThrow('cannot be resolved');
    });

    it('throws for expired proposals', () => {
      const proposal = makeProposal({ status: ProposalStatus.EXPIRED });
      expect(() => assertProposalPending(proposal)).toThrow('cannot be resolved');
    });
  });

  describe('assertProposalNotResolved', () => {
    it('allows unresolved proposals', () => {
      const proposal = makeProposal({ resolvedAt: null });
      expect(() => assertProposalNotResolved(proposal)).not.toThrow();
    });

    it('throws for resolved proposals', () => {
      const proposal = makeProposal({ resolvedAt: new Date() });
      expect(() => assertProposalNotResolved(proposal)).toThrow('cannot be resolved');
    });
  });
});
