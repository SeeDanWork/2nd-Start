import { describe, it, expect } from 'vitest';
import { PreferredExchangeDayDetector } from '../detectors/PreferredExchangeDayDetector';
import { PreferredExchangeLocationDetector } from '../detectors/PreferredExchangeLocationDetector';
import { SchoolClosureCoverageDetector } from '../detectors/SchoolClosureCoverageDetector';
import { MinBlockLengthAdjustmentDetector } from '../detectors/MinBlockLengthAdjustmentDetector';
import { ActivityResponsibilityDetector } from '../detectors/ActivityResponsibilityDetector';
import { SiblingDivergencePreferenceDetector } from '../detectors/SiblingDivergencePreferenceDetector';
import { PatternDetectorRegistry } from '../detectors/PatternDetectorRegistry';
import { BehaviorObservationWindow, ObservationEvidenceRecord } from '../types';

const WINDOW: BehaviorObservationWindow = {
  familyId: 'fam-1',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
};

function makeExchangeEvidence(count: number, dayOfWeek: number, location: string): ObservationEvidenceRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    evidenceId: `exchange-e${i + 1}`,
    familyId: 'fam-1',
    evidenceType: 'EXCHANGE_PATTERN',
    date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    data: { dayOfWeek, location, fromParentId: 'p1', toParentId: 'p2' },
    createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
  }));
}

describe('PreferredExchangeDayDetector', () => {
  const detector = new PreferredExchangeDayDetector();

  it('detects preferred exchange day after threshold met', () => {
    // 4 Sunday exchanges (day 0), 1 Wednesday (day 3) = 80% on Sunday
    const evidence = [
      ...makeExchangeEvidence(4, 0, 'School'),
      ...makeExchangeEvidence(1, 3, 'School').map((e, i) => ({ ...e, evidenceId: `exchange-w${i}` })),
    ];

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].suggestionType).toBe('PREFERRED_EXCHANGE_DAY');
    expect(candidates[0].proposedParameters.preferredExchangeDay).toBe(0);
    expect(candidates[0].confidenceScore).toBe(0.8);
  });

  it('does not detect when below threshold', () => {
    // Only 2 exchanges — below MIN_OCCURRENCES
    const evidence = makeExchangeEvidence(2, 0, 'School');
    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });

  it('does not detect when no dominant day', () => {
    // Split evenly: 2 Sunday, 2 Wednesday, 2 Friday = no dominant day
    const evidence = [
      ...makeExchangeEvidence(2, 0, 'School'),
      ...makeExchangeEvidence(2, 3, 'School').map((e, i) => ({ ...e, evidenceId: `w${i}` })),
      ...makeExchangeEvidence(2, 5, 'School').map((e, i) => ({ ...e, evidenceId: `f${i}` })),
    ];
    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });
});

describe('PreferredExchangeLocationDetector', () => {
  const detector = new PreferredExchangeLocationDetector();

  it('detects preferred location when dominant', () => {
    const evidence = [
      ...makeExchangeEvidence(4, 0, 'School'),
      ...makeExchangeEvidence(1, 0, 'Park').map((e, i) => ({ ...e, evidenceId: `park${i}`, data: { ...e.data, location: 'Park' } })),
    ];
    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].proposedParameters.preferredLocation).toBe('School');
  });

  it('does not detect when below occurrence threshold', () => {
    const evidence = makeExchangeEvidence(2, 0, 'School');
    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });

  it('does not detect when no dominant location', () => {
    // 2 School, 2 Park, 2 Library = no location at 70%
    const evidence = [
      ...makeExchangeEvidence(2, 0, 'School'),
      ...makeExchangeEvidence(2, 0, 'Park').map((e, i) => ({ ...e, evidenceId: `park${i}`, data: { ...e.data, location: 'Park' } })),
      ...makeExchangeEvidence(2, 0, 'Library').map((e, i) => ({ ...e, evidenceId: `lib${i}`, data: { ...e.data, location: 'Library' } })),
    ];
    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });

  it('detects at exactly the threshold boundary (3 of 4 = 75%)', () => {
    const evidence = [
      ...makeExchangeEvidence(3, 0, 'School'),
      ...makeExchangeEvidence(1, 0, 'Park').map((e, i) => ({ ...e, evidenceId: `park${i}`, data: { ...e.data, location: 'Park' } })),
    ];
    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidenceScore).toBe(0.75);
  });

  it('does not detect at exactly 70% when occurrences below minimum', () => {
    // 2 of 2 = 100% but only 2 occurrences (below MIN_OCCURRENCES=3)
    const evidence = makeExchangeEvidence(2, 0, 'School');
    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });

  it('ignores empty location strings', () => {
    const evidence = [
      ...makeExchangeEvidence(3, 0, ''),
      ...makeExchangeEvidence(1, 0, 'School').map((e, i) => ({ ...e, evidenceId: `s${i}` })),
    ];
    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    // Empty strings are skipped, so only 1 School exchange — below threshold
    expect(candidates).toHaveLength(0);
  });
});

describe('SchoolClosureCoverageDetector', () => {
  const detector = new SchoolClosureCoverageDetector();

  it('detects school closure coverage with dominant parent', () => {
    const evidence: ObservationEvidenceRecord[] = Array.from({ length: 4 }, (_, i) => ({
      evidenceId: `overlay-o${i + 1}`,
      familyId: 'fam-1',
      evidenceType: 'OVERLAY_COVERAGE',
      date: `2026-03-${String(i + 5).padStart(2, '0')}`,
      childId: 'c1',
      parentId: 'p1',
      data: { disruptionType: 'SCHOOL_CLOSURE', assignedParentId: 'p1' },
      createdAt: `2026-03-${String(i + 5).padStart(2, '0')}T00:00:00Z`,
    }));

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].suggestionType).toBe('SCHOOL_CLOSURE_COVERAGE_PREFERENCE');
    expect(candidates[0].proposedParameters.preferredResponsibleParentId).toBe('p1');
  });

  it('does not detect with weak evidence', () => {
    // Only 2 overlays — below threshold
    const evidence: ObservationEvidenceRecord[] = [
      { evidenceId: 'o1', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE', date: '2026-03-05', childId: 'c1', data: { assignedParentId: 'p1' }, createdAt: '2026-03-05T00:00:00Z' },
      { evidenceId: 'o2', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE', date: '2026-03-12', childId: 'c1', data: { assignedParentId: 'p1' }, createdAt: '2026-03-12T00:00:00Z' },
    ];
    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });
});

describe('MinBlockLengthAdjustmentDetector', () => {
  const detector = new MinBlockLengthAdjustmentDetector();

  it('detects min block adjustment from repeated longer blocks', () => {
    const evidence: ObservationEvidenceRecord[] = Array.from({ length: 4 }, (_, i) => ({
      evidenceId: `prop-block-${i}`,
      familyId: 'fam-1',
      evidenceType: 'ACCEPTED_PROPOSAL',
      date: `2026-03-${String(i * 7 + 1).padStart(2, '0')}`,
      data: { blockLengths: [3, 4], averageBlockLength: 3.5 },
      createdAt: `2026-03-${String(i * 7 + 1).padStart(2, '0')}T00:00:00Z`,
    }));

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].suggestionType).toBe('MIN_BLOCK_LENGTH_ADJUSTMENT');
    expect(candidates[0].proposedParameters.nights).toBeGreaterThanOrEqual(2);
  });

  it('does not detect with short blocks', () => {
    const evidence: ObservationEvidenceRecord[] = Array.from({ length: 4 }, (_, i) => ({
      evidenceId: `prop-block-${i}`,
      familyId: 'fam-1',
      evidenceType: 'ACCEPTED_PROPOSAL',
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      data: { blockLengths: [1, 1], averageBlockLength: 1 },
      createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }));

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });
});

describe('ActivityResponsibilityDetector', () => {
  const detector = new ActivityResponsibilityDetector();

  it('detects activity responsibility when same parent dominates', () => {
    const evidence: ObservationEvidenceRecord[] = Array.from({ length: 4 }, (_, i) => ({
      evidenceId: `activity-a${i + 1}`,
      familyId: 'fam-1',
      evidenceType: 'ACTIVITY_RESPONSIBILITY',
      date: `2026-03-${String(i + 3).padStart(2, '0')}`,
      childId: 'c1',
      parentId: 'p2',
      data: { activityLabel: 'soccer', responsibleParentId: 'p2' },
      createdAt: `2026-03-${String(i + 3).padStart(2, '0')}T00:00:00Z`,
    }));

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].proposedParameters.activityLabel).toBe('soccer');
    expect(candidates[0].proposedParameters.preferredResponsibleParentId).toBe('p2');
  });

  it('does not detect when below occurrence threshold', () => {
    const evidence: ObservationEvidenceRecord[] = Array.from({ length: 2 }, (_, i) => ({
      evidenceId: `activity-a${i + 1}`,
      familyId: 'fam-1',
      evidenceType: 'ACTIVITY_RESPONSIBILITY',
      date: `2026-03-${String(i + 3).padStart(2, '0')}`,
      childId: 'c1',
      parentId: 'p2',
      data: { activityLabel: 'soccer', responsibleParentId: 'p2' },
      createdAt: `2026-03-${String(i + 3).padStart(2, '0')}T00:00:00Z`,
    }));

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });

  it('does not detect when no dominant parent (even split)', () => {
    // 3 by p1, 3 by p2 = 50% each, below 70% threshold
    const evidence: ObservationEvidenceRecord[] = [
      ...Array.from({ length: 3 }, (_, i) => ({
        evidenceId: `act-p1-${i}`,
        familyId: 'fam-1',
        evidenceType: 'ACTIVITY_RESPONSIBILITY',
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        childId: 'c1',
        parentId: 'p1',
        data: { activityLabel: 'soccer', responsibleParentId: 'p1' },
        createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        evidenceId: `act-p2-${i}`,
        familyId: 'fam-1',
        evidenceType: 'ACTIVITY_RESPONSIBILITY',
        date: `2026-03-${String(i + 10).padStart(2, '0')}`,
        childId: 'c1',
        parentId: 'p2',
        data: { activityLabel: 'soccer', responsibleParentId: 'p2' },
        createdAt: `2026-03-${String(i + 10).padStart(2, '0')}T00:00:00Z`,
      })),
    ];

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });

  it('detects at exactly the threshold boundary (3 of 4 = 75%)', () => {
    const evidence: ObservationEvidenceRecord[] = [
      ...Array.from({ length: 3 }, (_, i) => ({
        evidenceId: `act-p2-${i}`,
        familyId: 'fam-1',
        evidenceType: 'ACTIVITY_RESPONSIBILITY',
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        childId: 'c1',
        parentId: 'p2',
        data: { activityLabel: 'soccer', responsibleParentId: 'p2' },
        createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      })),
      {
        evidenceId: 'act-p1-0',
        familyId: 'fam-1',
        evidenceType: 'ACTIVITY_RESPONSIBILITY',
        date: '2026-03-10',
        childId: 'c1',
        parentId: 'p1',
        data: { activityLabel: 'soccer', responsibleParentId: 'p1' },
        createdAt: '2026-03-10T00:00:00Z',
      },
    ];

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidenceScore).toBe(0.75);
    expect(candidates[0].proposedParameters.preferredResponsibleParentId).toBe('p2');
  });

  it('detects separate suggestions for different activities', () => {
    const evidence: ObservationEvidenceRecord[] = [
      ...Array.from({ length: 3 }, (_, i) => ({
        evidenceId: `soccer-${i}`,
        familyId: 'fam-1',
        evidenceType: 'ACTIVITY_RESPONSIBILITY',
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        childId: 'c1',
        parentId: 'p2',
        data: { activityLabel: 'soccer', responsibleParentId: 'p2' },
        createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        evidenceId: `piano-${i}`,
        familyId: 'fam-1',
        evidenceType: 'ACTIVITY_RESPONSIBILITY',
        date: `2026-03-${String(i + 10).padStart(2, '0')}`,
        childId: 'c1',
        parentId: 'p1',
        data: { activityLabel: 'piano', responsibleParentId: 'p1' },
        createdAt: `2026-03-${String(i + 10).padStart(2, '0')}T00:00:00Z`,
      })),
    ];

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(2);

    const soccer = candidates.find(c => c.proposedParameters.activityLabel === 'soccer');
    const piano = candidates.find(c => c.proposedParameters.activityLabel === 'piano');
    expect(soccer).toBeDefined();
    expect(piano).toBeDefined();
    expect(soccer!.proposedParameters.preferredResponsibleParentId).toBe('p2');
    expect(piano!.proposedParameters.preferredResponsibleParentId).toBe('p1');
  });

  it('scopes suggestion to specific child', () => {
    const evidence: ObservationEvidenceRecord[] = Array.from({ length: 3 }, (_, i) => ({
      evidenceId: `act-${i}`,
      familyId: 'fam-1',
      evidenceType: 'ACTIVITY_RESPONSIBILITY',
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      childId: 'c2',
      parentId: 'p1',
      data: { activityLabel: 'swimming', responsibleParentId: 'p1' },
      createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }));

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].proposedScope).toEqual({ scopeType: 'CHILD', childId: 'c2' });
  });
});

describe('SiblingDivergencePreferenceDetector', () => {
  const detector = new SiblingDivergencePreferenceDetector();

  function makeDivergentProposalEvidence(proposalCount: number, divergentCount: number): ObservationEvidenceRecord[] {
    const evidence: ObservationEvidenceRecord[] = [];
    for (let i = 0; i < proposalCount; i++) {
      const isDivergent = i < divergentCount;
      evidence.push({
        evidenceId: `prop-${i}-c1`,
        familyId: 'fam-1',
        evidenceType: 'ACCEPTED_PROPOSAL',
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        childId: 'c1',
        parentId: 'p1',
        relatedEntityType: 'PROPOSAL',
        relatedEntityId: `prop-${i}`,
        data: { blockLengths: [3], averageBlockLength: 3 },
        createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      });
      evidence.push({
        evidenceId: `prop-${i}-c2`,
        familyId: 'fam-1',
        evidenceType: 'ACCEPTED_PROPOSAL',
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        childId: 'c2',
        parentId: isDivergent ? 'p2' : 'p1', // divergent = different parent
        relatedEntityType: 'PROPOSAL',
        relatedEntityId: `prop-${i}`,
        data: { blockLengths: [3], averageBlockLength: 3 },
        createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      });
    }
    return evidence;
  }

  it('detects sibling divergence preference when frequent', () => {
    // 4 proposals, all divergent
    const evidence = makeDivergentProposalEvidence(4, 4);

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].suggestionType).toBe('SIBLING_DIVERGENCE_PREFERENCE');
    expect(candidates[0].proposedParameters.allowDivergence).toBe(true);
  });

  it('does not detect when siblings always stay together', () => {
    // 4 proposals, 0 divergent — both children always with p1
    const evidence = makeDivergentProposalEvidence(4, 0);

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });

  it('does not detect for single-child families', () => {
    // Only 1 child per proposal — no sibling pair to compare
    const evidence: ObservationEvidenceRecord[] = Array.from({ length: 4 }, (_, i) => ({
      evidenceId: `prop-${i}-c1`,
      familyId: 'fam-1',
      evidenceType: 'ACCEPTED_PROPOSAL',
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      childId: 'c1',
      parentId: 'p1',
      relatedEntityType: 'PROPOSAL',
      relatedEntityId: `prop-${i}`,
      data: { blockLengths: [3], averageBlockLength: 3 },
      createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }));

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });

  it('does not detect when below minimum multi-child proposals (< 3)', () => {
    // Only 2 multi-child proposals — below MIN_OCCURRENCES=3
    const evidence = makeDivergentProposalEvidence(2, 2);

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });

  it('detects at threshold boundary (3 divergent of 3 total = 100%)', () => {
    const evidence = makeDivergentProposalEvidence(3, 3);

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidenceScore).toBe(1);
  });

  it('does not detect when divergence ratio is below 30%', () => {
    // 10 proposals, only 2 divergent = 20% < 30% threshold
    const evidence = makeDivergentProposalEvidence(10, 2);

    const candidates = detector.detect({ familyId: 'fam-1', window: WINDOW, evidence });
    expect(candidates).toHaveLength(0);
  });
});

describe('PatternDetectorRegistry', () => {
  it('returns all 6 built-in detectors', () => {
    const registry = new PatternDetectorRegistry();
    expect(registry.getDetectors()).toHaveLength(6);
  });

  it('finds detector by suggestion type', () => {
    const registry = new PatternDetectorRegistry();
    const d = registry.getDetectorBySuggestionType('PREFERRED_EXCHANGE_DAY');
    expect(d).toBeDefined();
    expect(d!.suggestionType).toBe('PREFERRED_EXCHANGE_DAY');
  });
});

describe('Weak/conflicting evidence yields no suggestion', () => {
  it('mixed evidence across detectors produces nothing when insufficient', () => {
    const evidence: ObservationEvidenceRecord[] = [
      { evidenceId: 'e1', familyId: 'fam-1', evidenceType: 'EXCHANGE_PATTERN', date: '2026-03-01', data: { dayOfWeek: 0, location: 'A' }, createdAt: '2026-03-01T00:00:00Z' },
      { evidenceId: 'e2', familyId: 'fam-1', evidenceType: 'EXCHANGE_PATTERN', date: '2026-03-08', data: { dayOfWeek: 3, location: 'B' }, createdAt: '2026-03-08T00:00:00Z' },
      { evidenceId: 'o1', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE', date: '2026-03-05', childId: 'c1', data: { assignedParentId: 'p1' }, createdAt: '2026-03-05T00:00:00Z' },
    ];

    const registry = new PatternDetectorRegistry();
    const allCandidates = registry.getDetectors().flatMap(d =>
      d.detect({ familyId: 'fam-1', window: WINDOW, evidence }),
    );

    expect(allCandidates).toHaveLength(0);
  });
});
