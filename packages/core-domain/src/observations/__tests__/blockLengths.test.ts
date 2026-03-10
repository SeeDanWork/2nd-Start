import { describe, it, expect } from 'vitest';
import { AcceptedProposalEvidenceExtractor, AcceptedProposalRecord } from '../evidence/AcceptedProposalEvidenceExtractor';
import { BehaviorObservationWindow } from '../types';

const WINDOW: BehaviorObservationWindow = {
  familyId: 'fam-1',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
};

describe('AcceptedProposalEvidenceExtractor — block length computation', () => {
  it('computes correct block lengths for a single child alternating parents', () => {
    // p1 x3, p2 x2 => p1: [3], p2: [2]
    const proposals: AcceptedProposalRecord[] = [{
      proposalId: 'prop-1',
      familyId: 'fam-1',
      acceptedAt: '2026-03-05T10:00:00Z',
      acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-09', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-11', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-12', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-13', childId: 'c1', parentId: 'p2' },
      ],
    }];

    const extractor = new AcceptedProposalEvidenceExtractor(proposals);
    const evidence = extractor.extractEvidence({ window: WINDOW });

    // Should produce 2 evidence records: one for c1-p1, one for c1-p2
    expect(evidence).toHaveLength(2);

    const p1Record = evidence.find(e => e.parentId === 'p1')!;
    const p2Record = evidence.find(e => e.parentId === 'p2')!;

    expect(p1Record).toBeDefined();
    expect(p1Record.data.blockLengths).toEqual([3]);
    expect(p1Record.data.averageBlockLength).toBe(3);

    expect(p2Record).toBeDefined();
    expect(p2Record.data.blockLengths).toEqual([2]);
    expect(p2Record.data.averageBlockLength).toBe(2);
  });

  it('computes multiple blocks for the same parent', () => {
    // p1(2), p2(1), p1(2) => p1: [2, 2], p2: [1]
    const proposals: AcceptedProposalRecord[] = [{
      proposalId: 'prop-2',
      familyId: 'fam-1',
      acceptedAt: '2026-03-05T10:00:00Z',
      acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-09', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-11', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-12', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-13', childId: 'c1', parentId: 'p1' },
      ],
    }];

    const extractor = new AcceptedProposalEvidenceExtractor(proposals);
    const evidence = extractor.extractEvidence({ window: WINDOW });

    const p1Record = evidence.find(e => e.parentId === 'p1')!;
    const p2Record = evidence.find(e => e.parentId === 'p2')!;

    expect(p1Record.data.blockLengths).toEqual([2, 2]);
    expect(p1Record.data.averageBlockLength).toBe(2);

    expect(p2Record.data.blockLengths).toEqual([1]);
    expect(p2Record.data.averageBlockLength).toBe(1);
  });

  it('handles a single night correctly', () => {
    const proposals: AcceptedProposalRecord[] = [{
      proposalId: 'prop-3',
      familyId: 'fam-1',
      acceptedAt: '2026-03-05T10:00:00Z',
      acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-09', childId: 'c1', parentId: 'p1' },
      ],
    }];

    const extractor = new AcceptedProposalEvidenceExtractor(proposals);
    const evidence = extractor.extractEvidence({ window: WINDOW });

    expect(evidence).toHaveLength(1);
    expect(evidence[0].data.blockLengths).toEqual([1]);
    expect(evidence[0].data.averageBlockLength).toBe(1);
  });

  it('computes block lengths per child independently', () => {
    // c1: p1(2), p2(1)  |  c2: p2(3)
    const proposals: AcceptedProposalRecord[] = [{
      proposalId: 'prop-4',
      familyId: 'fam-1',
      acceptedAt: '2026-03-05T10:00:00Z',
      acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-09', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-11', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-09', childId: 'c2', parentId: 'p2' },
        { date: '2026-03-10', childId: 'c2', parentId: 'p2' },
        { date: '2026-03-11', childId: 'c2', parentId: 'p2' },
      ],
    }];

    const extractor = new AcceptedProposalEvidenceExtractor(proposals);
    const evidence = extractor.extractEvidence({ window: WINDOW });

    // 3 records: c1-p1, c1-p2, c2-p2
    expect(evidence).toHaveLength(3);

    const c1p1 = evidence.find(e => e.childId === 'c1' && e.parentId === 'p1')!;
    const c1p2 = evidence.find(e => e.childId === 'c1' && e.parentId === 'p2')!;
    const c2p2 = evidence.find(e => e.childId === 'c2' && e.parentId === 'p2')!;

    expect(c1p1.data.blockLengths).toEqual([2]);
    expect(c1p2.data.blockLengths).toEqual([1]);
    expect(c2p2.data.blockLengths).toEqual([3]);
    expect(c2p2.data.averageBlockLength).toBe(3);
  });

  it('sorts nights by date before computing blocks', () => {
    // Out-of-order nights — same result as ordered
    const proposals: AcceptedProposalRecord[] = [{
      proposalId: 'prop-5',
      familyId: 'fam-1',
      acceptedAt: '2026-03-05T10:00:00Z',
      acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-13', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-09', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-11', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-12', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
      ],
    }];

    const extractor = new AcceptedProposalEvidenceExtractor(proposals);
    const evidence = extractor.extractEvidence({ window: WINDOW });

    const p1Record = evidence.find(e => e.parentId === 'p1')!;
    const p2Record = evidence.find(e => e.parentId === 'p2')!;

    expect(p1Record.data.blockLengths).toEqual([3]);
    expect(p2Record.data.blockLengths).toEqual([2]);
  });

  it('produces correct evidenceId format', () => {
    const proposals: AcceptedProposalRecord[] = [{
      proposalId: 'prop-x',
      familyId: 'fam-1',
      acceptedAt: '2026-03-05T10:00:00Z',
      acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-09', childId: 'c1', parentId: 'p1' },
      ],
    }];

    const extractor = new AcceptedProposalEvidenceExtractor(proposals);
    const evidence = extractor.extractEvidence({ window: WINDOW });

    expect(evidence[0].evidenceId).toBe('prop-x-block-c1-p1');
    expect(evidence[0].relatedEntityType).toBe('PROPOSAL');
    expect(evidence[0].relatedEntityId).toBe('prop-x');
  });

  it('handles empty scheduleNights gracefully', () => {
    const proposals: AcceptedProposalRecord[] = [{
      proposalId: 'prop-empty',
      familyId: 'fam-1',
      acceptedAt: '2026-03-05T10:00:00Z',
      acceptedByParentId: 'p1',
      scheduleNights: [],
    }];

    const extractor = new AcceptedProposalEvidenceExtractor(proposals);
    const evidence = extractor.extractEvidence({ window: WINDOW });
    expect(evidence).toHaveLength(0);
  });
});
