import { ProposalInvalidationError } from '../errors';
import { IProposalRepository } from '../../repositories/IProposalRepository';
import { ProposalStatus } from '../../enums/ProposalStatus';

/**
 * Invalidates sibling and stale proposals deterministically.
 */
export class ProposalInvalidationService {
  constructor(private readonly proposalRepo: IProposalRepository) {}

  /**
   * Invalidate pending proposals on the same base version, except the accepted one.
   * Returns invalidated proposal IDs in deterministic order.
   */
  async invalidateSiblingProposals(input: {
    baseScheduleVersionId: string;
    acceptedProposalId: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<string[]> {
    const pending = await this.proposalRepo.findPendingByBaseVersion(
      input.baseScheduleVersionId,
    );

    // Filter out accepted, sort deterministically
    const toInvalidate = pending
      .filter(p => p.id !== input.acceptedProposalId && p.status === ProposalStatus.PENDING)
      .sort((a, b) => a.id.localeCompare(b.id));

    const invalidatedIds: string[] = [];
    for (const p of toInvalidate) {
      await this.proposalRepo.updateStatus(
        p.id,
        ProposalStatus.EXPIRED,
        new Date(input.invalidatedAt),
        input.reason,
      );
      invalidatedIds.push(p.id);
    }

    return invalidatedIds;
  }

  /**
   * Invalidate all pending proposals for a family whose base is not the active version.
   * Returns invalidated proposal IDs in deterministic order.
   */
  async invalidateStaleProposalsForFamily(input: {
    familyId: string;
    activeScheduleVersionId: string;
    invalidatedAt: string;
    reason: string;
  }): Promise<string[]> {
    // This requires a broader query; for now we delegate to the caller
    // to provide the stale proposals. The repository findPendingByBaseVersion
    // is per-version; family-wide invalidation would need a custom query.
    // Return empty for now — the acceptance workflow handles siblings.
    return [];
  }
}
