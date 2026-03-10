import { describe, it, expect, vi } from 'vitest';
import { ProposalRejectionWorkflow } from '../workflows/ProposalRejectionWorkflow';
import { ProposalRejectionError } from '../errors';
import { ProposalStatus } from '../../enums/ProposalStatus';
import { makeProposal, makeMockProposalRepo, SCHEDULE_V1 } from './helpers';

describe('ProposalRejectionWorkflow', () => {
  describe('reject', () => {
    it('rejects a pending proposal', async () => {
      const proposal = makeProposal();
      const proposals = new Map([[proposal.id, proposal]]);
      const repo = makeMockProposalRepo(proposals);
      const workflow = new ProposalRejectionWorkflow(repo);

      await workflow.reject({
        proposalId: proposal.id,
        rejectedBy: 'parent-b',
        rejectedAt: '2026-03-05T10:00:00Z',
        reason: 'Not suitable',
      });

      expect(repo.updateStatus).toHaveBeenCalledWith(
        proposal.id,
        ProposalStatus.REJECTED,
        expect.any(Date),
        'Not suitable',
      );
    });

    it('throws when proposal not found', async () => {
      const repo = makeMockProposalRepo();
      const workflow = new ProposalRejectionWorkflow(repo);

      await expect(
        workflow.reject({
          proposalId: 'missing',
          rejectedBy: 'parent-b',
          rejectedAt: '2026-03-05T10:00:00Z',
        }),
      ).rejects.toThrow(ProposalRejectionError);
    });

    it('throws when proposal not PENDING', async () => {
      const proposal = makeProposal({ status: ProposalStatus.ACCEPTED });
      const proposals = new Map([[proposal.id, proposal]]);
      const repo = makeMockProposalRepo(proposals);
      const workflow = new ProposalRejectionWorkflow(repo);

      await expect(
        workflow.reject({
          proposalId: proposal.id,
          rejectedBy: 'parent-b',
          rejectedAt: '2026-03-05T10:00:00Z',
        }),
      ).rejects.toThrow(ProposalRejectionError);
    });
  });

  describe('expire', () => {
    it('expires a pending proposal', async () => {
      const proposal = makeProposal();
      const proposals = new Map([[proposal.id, proposal]]);
      const repo = makeMockProposalRepo(proposals);
      const workflow = new ProposalRejectionWorkflow(repo);

      await workflow.expire({
        proposalId: proposal.id,
        expiredAt: '2026-03-10T00:00:00Z',
      });

      expect(repo.updateStatus).toHaveBeenCalledWith(
        proposal.id,
        ProposalStatus.EXPIRED,
        expect.any(Date),
        'Proposal expired',
      );
    });

    it('throws when proposal already rejected', async () => {
      const proposal = makeProposal({ status: ProposalStatus.REJECTED });
      const proposals = new Map([[proposal.id, proposal]]);
      const repo = makeMockProposalRepo(proposals);
      const workflow = new ProposalRejectionWorkflow(repo);

      await expect(
        workflow.expire({
          proposalId: proposal.id,
          expiredAt: '2026-03-10T00:00:00Z',
        }),
      ).rejects.toThrow(ProposalRejectionError);
    });
  });
});
