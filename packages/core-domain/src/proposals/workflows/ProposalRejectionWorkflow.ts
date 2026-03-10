import { ProposalRejectionError } from '../errors';
import { IProposalRepository } from '../../repositories/IProposalRepository';
import { ProposalStatus } from '../../enums/ProposalStatus';

/**
 * Handles proposal rejection and expiration.
 */
export class ProposalRejectionWorkflow {
  constructor(private readonly proposalRepo: IProposalRepository) {}

  async reject(input: {
    proposalId: string;
    rejectedBy: string;
    rejectedAt: string;
    reason?: string;
  }): Promise<void> {
    const proposal = await this.proposalRepo.findById(input.proposalId);
    if (!proposal) {
      throw new ProposalRejectionError(`Proposal ${input.proposalId} not found`);
    }
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new ProposalRejectionError(
        `Cannot reject proposal ${input.proposalId}: status is ${proposal.status}`,
      );
    }

    await this.proposalRepo.updateStatus(
      input.proposalId,
      ProposalStatus.REJECTED,
      new Date(input.rejectedAt),
      input.reason ?? null,
    );
  }

  async expire(input: {
    proposalId: string;
    expiredAt: string;
    reason?: string;
  }): Promise<void> {
    const proposal = await this.proposalRepo.findById(input.proposalId);
    if (!proposal) {
      throw new ProposalRejectionError(`Proposal ${input.proposalId} not found`);
    }
    if (proposal.status !== ProposalStatus.PENDING) {
      throw new ProposalRejectionError(
        `Cannot expire proposal ${input.proposalId}: status is ${proposal.status}`,
      );
    }

    await this.proposalRepo.updateStatus(
      input.proposalId,
      ProposalStatus.EXPIRED,
      new Date(input.expiredAt),
      input.reason ?? 'Proposal expired',
    );
  }
}
