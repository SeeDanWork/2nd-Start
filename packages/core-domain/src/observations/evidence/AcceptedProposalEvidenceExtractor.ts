import { ObservationEvidenceExtractor } from './ObservationEvidenceExtractor';
import { BehaviorObservationWindow, ObservationEvidenceRecord } from '../types';

export interface AcceptedProposalRecord {
  proposalId: string;
  familyId: string;
  acceptedAt: string;
  acceptedByParentId: string;
  scheduleNights: Array<{ date: string; childId: string; parentId: string }>;
}

/**
 * Extracts evidence from accepted proposals.
 * Looks for patterns in which proposals were accepted and what
 * schedule configurations they established.
 */
export class AcceptedProposalEvidenceExtractor implements ObservationEvidenceExtractor {
  readonly evidenceType = 'ACCEPTED_PROPOSAL';

  constructor(private readonly proposals: AcceptedProposalRecord[]) {}

  extractEvidence(input: {
    window: BehaviorObservationWindow;
  }): ObservationEvidenceRecord[] {
    const { window } = input;
    const records: ObservationEvidenceRecord[] = [];

    const filtered = this.proposals
      .filter(p =>
        p.familyId === window.familyId &&
        p.acceptedAt >= window.startDate &&
        p.acceptedAt <= window.endDate,
      )
      .sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt));

    for (const proposal of filtered) {
      // Extract block lengths per child per parent from the accepted schedule
      const blocksByChild = this.computeBlockLengths(proposal.scheduleNights);

      for (const [childId, parentBlocks] of Object.entries(blocksByChild)) {
        for (const [parentId, lengths] of Object.entries(parentBlocks)) {
          records.push({
            evidenceId: `${proposal.proposalId}-block-${childId}-${parentId}`,
            familyId: window.familyId,
            evidenceType: this.evidenceType,
            date: proposal.acceptedAt.slice(0, 10),
            childId,
            parentId,
            relatedEntityType: 'PROPOSAL',
            relatedEntityId: proposal.proposalId,
            data: {
              blockLengths: lengths,
              averageBlockLength: lengths.length > 0
                ? lengths.reduce((a, b) => a + b, 0) / lengths.length
                : 0,
              acceptedByParentId: proposal.acceptedByParentId,
            },
            createdAt: proposal.acceptedAt,
          });
        }
      }
    }

    return records.sort((a, b) =>
      a.date.localeCompare(b.date) || a.evidenceId.localeCompare(b.evidenceId),
    );
  }

  private computeBlockLengths(
    nights: Array<{ date: string; childId: string; parentId: string }>,
  ): Record<string, Record<string, number[]>> {
    const result: Record<string, Record<string, number[]>> = {};
    const sorted = [...nights].sort((a, b) => a.date.localeCompare(b.date));

    const byChild: Record<string, Array<{ date: string; parentId: string }>> = {};
    for (const n of sorted) {
      if (!byChild[n.childId]) byChild[n.childId] = [];
      byChild[n.childId].push({ date: n.date, parentId: n.parentId });
    }

    for (const [childId, childNights] of Object.entries(byChild)) {
      result[childId] = {};
      if (childNights.length === 0) continue;

      let currentParent = childNights[0].parentId;
      let blockLen = 1;

      for (let i = 1; i < childNights.length; i++) {
        if (childNights[i].parentId === currentParent) {
          blockLen++;
        } else {
          if (!result[childId][currentParent]) result[childId][currentParent] = [];
          result[childId][currentParent].push(blockLen);
          currentParent = childNights[i].parentId;
          blockLen = 1;
        }
      }
      if (!result[childId][currentParent]) result[childId][currentParent] = [];
      result[childId][currentParent].push(blockLen);
    }

    return result;
  }
}
