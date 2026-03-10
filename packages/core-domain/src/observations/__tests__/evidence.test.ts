import { describe, it, expect } from 'vitest';
import { ExchangePatternEvidenceExtractor, ExchangeRecord } from '../evidence/ExchangePatternEvidenceExtractor';
import { OverlayCoverageEvidenceExtractor, OverlayCoverageRecord } from '../evidence/OverlayCoverageEvidenceExtractor';
import { ActivityResponsibilityEvidenceExtractor, ActivityRecord } from '../evidence/ActivityResponsibilityEvidenceExtractor';
import { AcceptedProposalEvidenceExtractor, AcceptedProposalRecord } from '../evidence/AcceptedProposalEvidenceExtractor';
import { BehaviorObservationWindow } from '../types';

const WINDOW: BehaviorObservationWindow = {
  familyId: 'fam-1',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
};

describe('ExchangePatternEvidenceExtractor', () => {
  it('extracts repeated exchange evidence correctly', () => {
    const exchanges: ExchangeRecord[] = [
      { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-01', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
      { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-08', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
      { exchangeId: 'e3', familyId: 'fam-1', date: '2026-03-15', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    ];

    const extractor = new ExchangePatternEvidenceExtractor(exchanges);
    const evidence = extractor.extractEvidence({ window: WINDOW });

    expect(evidence).toHaveLength(3);
    expect(evidence[0].evidenceType).toBe('EXCHANGE_PATTERN');
    expect(evidence[0].data.location).toBe('School');
    expect(evidence.every(e => e.familyId === 'fam-1')).toBe(true);
  });

  it('filters by window dates', () => {
    const exchanges: ExchangeRecord[] = [
      { exchangeId: 'e1', familyId: 'fam-1', date: '2026-02-28', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
      { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-01', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    ];

    const extractor = new ExchangePatternEvidenceExtractor(exchanges);
    const evidence = extractor.extractEvidence({ window: WINDOW });
    expect(evidence).toHaveLength(1);
    expect(evidence[0].date).toBe('2026-03-01');
  });

  it('produces deterministic ordering', () => {
    const exchanges: ExchangeRecord[] = [
      { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-08', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
      { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-01', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    ];

    const extractor = new ExchangePatternEvidenceExtractor(exchanges);
    const e1 = extractor.extractEvidence({ window: WINDOW });
    const e2 = extractor.extractEvidence({ window: WINDOW });
    expect(e1).toEqual(e2);
    expect(e1[0].date).toBe('2026-03-01');
  });
});

describe('OverlayCoverageEvidenceExtractor', () => {
  it('extracts overlay coverage evidence correctly', () => {
    const overlays: OverlayCoverageRecord[] = [
      { overlayId: 'o1', familyId: 'fam-1', date: '2026-03-05', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
      { overlayId: 'o2', familyId: 'fam-1', date: '2026-03-12', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
      { overlayId: 'o3', familyId: 'fam-1', date: '2026-03-19', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    ];

    const extractor = new OverlayCoverageEvidenceExtractor(overlays);
    const evidence = extractor.extractEvidence({ window: WINDOW });

    expect(evidence).toHaveLength(3);
    expect(evidence[0].evidenceType).toBe('OVERLAY_COVERAGE');
    expect(evidence[0].data.disruptionType).toBe('SCHOOL_CLOSURE');
    expect(evidence[0].parentId).toBe('p1');
  });
});

describe('ActivityResponsibilityEvidenceExtractor', () => {
  it('extracts activity responsibility evidence correctly', () => {
    const activities: ActivityRecord[] = [
      { activityId: 'a1', familyId: 'fam-1', date: '2026-03-03', childId: 'c1', responsibleParentId: 'p2', activityLabel: 'soccer' },
      { activityId: 'a2', familyId: 'fam-1', date: '2026-03-10', childId: 'c1', responsibleParentId: 'p2', activityLabel: 'soccer' },
      { activityId: 'a3', familyId: 'fam-1', date: '2026-03-17', childId: 'c1', responsibleParentId: 'p2', activityLabel: 'soccer' },
    ];

    const extractor = new ActivityResponsibilityEvidenceExtractor(activities);
    const evidence = extractor.extractEvidence({ window: WINDOW });

    expect(evidence).toHaveLength(3);
    expect(evidence[0].evidenceType).toBe('ACTIVITY_RESPONSIBILITY');
    expect(evidence[0].data.activityLabel).toBe('soccer');
    expect(evidence[0].data.responsibleParentId).toBe('p2');
  });
});

describe('AcceptedProposalEvidenceExtractor', () => {
  it('extracts block length evidence from accepted proposals', () => {
    const proposals: AcceptedProposalRecord[] = [
      {
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
      },
    ];

    const extractor = new AcceptedProposalEvidenceExtractor(proposals);
    const evidence = extractor.extractEvidence({ window: WINDOW });

    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0].evidenceType).toBe('ACCEPTED_PROPOSAL');
    expect(evidence[0].data.blockLengths).toBeDefined();
  });

  it('produces deterministic ordering', () => {
    const proposals: AcceptedProposalRecord[] = [
      {
        proposalId: 'prop-2',
        familyId: 'fam-1',
        acceptedAt: '2026-03-15T10:00:00Z',
        acceptedByParentId: 'p1',
        scheduleNights: [
          { date: '2026-03-16', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-17', childId: 'c1', parentId: 'p2' },
        ],
      },
      {
        proposalId: 'prop-1',
        familyId: 'fam-1',
        acceptedAt: '2026-03-05T10:00:00Z',
        acceptedByParentId: 'p1',
        scheduleNights: [
          { date: '2026-03-09', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-10', childId: 'c1', parentId: 'p2' },
        ],
      },
    ];

    const extractor = new AcceptedProposalEvidenceExtractor(proposals);
    const e1 = extractor.extractEvidence({ window: WINDOW });
    const e2 = extractor.extractEvidence({ window: WINDOW });
    expect(e1).toEqual(e2);
  });
});
