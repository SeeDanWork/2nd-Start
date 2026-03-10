import { ProposalCandidateInput, ProposalOrigin } from '../types';
import { ProposalGenerationError } from '../errors';
import { ChildId, ParentId } from '../../types';
import { ProposalNightOwnership } from '../../models/ProposalNightOwnership';
import { ProposalExchange } from '../../models/ProposalExchange';

export interface MaterializedCandidate {
  proposalScheduleId: string;
  candidateId: string;
  nights: ProposalNightOwnership[];
  exchanges: ProposalExchange[];
  scoreBreakdown: Record<string, unknown>;
  fairnessProjection: Record<string, unknown>;
  stabilityDelta: number;
}

/**
 * Maps solver candidate outputs into proposal schedule structures.
 * Preserves deterministic ordering.
 */
export function materializeCandidate(input: {
  candidate: ProposalCandidateInput;
  proposalScheduleId: string;
}): MaterializedCandidate {
  const { candidate, proposalScheduleId } = input;

  if (!candidate.candidateId) {
    throw new ProposalGenerationError('Candidate must have a candidateId');
  }

  const nights: ProposalNightOwnership[] = candidate.nights
    .slice()
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : a.childId.localeCompare(b.childId);
    })
    .map((n, i) => ({
      id: `${proposalScheduleId}-night-${i}`,
      proposalScheduleId,
      date: n.date,
      childId: n.childId as ChildId,
      parentId: n.parentId as ParentId,
      createdAt: new Date(),
    }));

  const exchanges: ProposalExchange[] = candidate.exchanges
    .slice()
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : a.childId.localeCompare(b.childId);
    })
    .map((e, i) => ({
      id: `${proposalScheduleId}-exchange-${i}`,
      proposalScheduleId,
      childId: e.childId as ChildId,
      date: e.date,
      fromParentId: e.fromParentId as ParentId,
      toParentId: e.toParentId as ParentId,
      time: e.time ?? '',
      location: e.location ?? '',
      createdAt: new Date(),
    }));

  return {
    proposalScheduleId,
    candidateId: candidate.candidateId,
    nights,
    exchanges,
    scoreBreakdown: candidate.scoreBreakdown ?? {},
    fairnessProjection: candidate.fairnessProjection ?? {},
    stabilityDelta: candidate.stabilityDelta ?? 0,
  };
}
