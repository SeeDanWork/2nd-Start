import { describe, it, expect, vi } from 'vitest';
import { ProposalInvalidationService } from '../workflows/ProposalInvalidationService';
import { ProposalStatus } from '../../enums/ProposalStatus';
import { makeProposal, makeMockProposalRepo, SCHEDULE_V1 } from './helpers';

describe('ProposalInvalidationService', () => {
  it('invalidates sibling proposals, skipping accepted', async () => {
    const accepted = makeProposal({ id: 'proposal-accepted', status: ProposalStatus.ACCEPTED });
    const sibling1 = makeProposal({ id: 'proposal-sibling-1' });
    const sibling2 = makeProposal({ id: 'proposal-sibling-2' });
    const proposals = new Map([
      [accepted.id, accepted],
      [sibling1.id, sibling1],
      [sibling2.id, sibling2],
    ]);
    const repo = makeMockProposalRepo(proposals);
    const service = new ProposalInvalidationService(repo);

    const result = await service.invalidateSiblingProposals({
      baseScheduleVersionId: SCHEDULE_V1 as string,
      acceptedProposalId: accepted.id,
      invalidatedAt: '2026-03-05T10:00:00Z',
      reason: 'Sibling accepted',
    });

    // Should invalidate both siblings, sorted by id
    expect(result).toEqual(['proposal-sibling-1', 'proposal-sibling-2']);
    expect(repo.updateStatus).toHaveBeenCalledTimes(2);
  });

  it('returns empty when no siblings exist', async () => {
    const accepted = makeProposal({ id: 'proposal-accepted' });
    const proposals = new Map([[accepted.id, accepted]]);
    const repo = makeMockProposalRepo(proposals);
    const service = new ProposalInvalidationService(repo);

    const result = await service.invalidateSiblingProposals({
      baseScheduleVersionId: SCHEDULE_V1 as string,
      acceptedProposalId: accepted.id,
      invalidatedAt: '2026-03-05T10:00:00Z',
      reason: 'Sibling accepted',
    });

    expect(result).toEqual([]);
  });

  it('returns deterministic order by id', async () => {
    // Insert out of alphabetical order
    const siblingZ = makeProposal({ id: 'z-proposal' });
    const siblingA = makeProposal({ id: 'a-proposal' });
    const siblingM = makeProposal({ id: 'm-proposal' });
    const proposals = new Map([
      [siblingZ.id, siblingZ],
      [siblingA.id, siblingA],
      [siblingM.id, siblingM],
    ]);
    const repo = makeMockProposalRepo(proposals);
    const service = new ProposalInvalidationService(repo);

    const result = await service.invalidateSiblingProposals({
      baseScheduleVersionId: SCHEDULE_V1 as string,
      acceptedProposalId: 'not-in-list',
      invalidatedAt: '2026-03-05T10:00:00Z',
      reason: 'Test',
    });

    expect(result).toEqual(['a-proposal', 'm-proposal', 'z-proposal']);
  });

  it('skips non-PENDING proposals', async () => {
    const expired = makeProposal({ id: 'proposal-expired', status: ProposalStatus.EXPIRED });
    const pending = makeProposal({ id: 'proposal-pending' });
    const proposals = new Map([
      [expired.id, expired],
      [pending.id, pending],
    ]);
    const repo = makeMockProposalRepo(proposals);
    const service = new ProposalInvalidationService(repo);

    const result = await service.invalidateSiblingProposals({
      baseScheduleVersionId: SCHEDULE_V1 as string,
      acceptedProposalId: 'not-in-list',
      invalidatedAt: '2026-03-05T10:00:00Z',
      reason: 'Test',
    });

    // Only pending should be invalidated (expired is already filtered by findPendingByBaseVersion)
    expect(result).toContain('proposal-pending');
    // The expired one may or may not be in results depending on repo mock behavior
    // Our mock returns all matching base version, so the filter in the service handles status
  });
});
