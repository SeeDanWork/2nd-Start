import { describe, it, expect } from 'vitest';
import { buildSolverInput } from '../core/SolverInputBuilder';
import { computeCandidateScore, rankCandidates, deduplicateCandidates, RankedCandidate } from '../scoring/CandidateRanker';
import { makeSolverInput, makeWindow, PARENT_A, PARENT_B, CHILD_1, CHILD_2 } from './helpers';
import { CandidateNight, SolverScore, SolverScoreBreakdown } from '../types';

function makeScore(total: number): SolverScore {
  return {
    total,
    primaryScore: total,
    secondaryScore: 0,
    breakdown: {
      stability: 0, familyStructure: 0,
      fairness: { total: 0, nights: 0, weekends: 0, holidays: 0 },
      parentPreference: 0, childPreference: 0,
      logistics: 0, convenience: 0, penalties: 0,
    },
  };
}

describe('CandidateRanker', () => {
  it('higher primary score dominates secondary score', () => {
    const input = makeSolverInput({ window: makeWindow('2026-03-02', '2026-03-03') });
    const normalized = buildSolverInput(input);

    // Even nights → better fairness
    const evenNights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-02', childId: CHILD_2, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_B },
      { date: '2026-03-03', childId: CHILD_2, parentId: PARENT_B },
    ];

    // All one parent → worse fairness
    const unevenNights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-02', childId: CHILD_2, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_2, parentId: PARENT_A },
    ];

    const evenScore = computeCandidateScore(
      { candidateId: 'even', nights: evenNights, exchanges: [], penaltyScore: 0 },
      normalized,
    );
    const unevenScore = computeCandidateScore(
      { candidateId: 'uneven', nights: unevenNights, exchanges: [], penaltyScore: 0 },
      normalized,
    );

    // With primaryMultiplier=100, primary objectives dominate
    // Even distribution should score higher
    expect(evenScore.total).toBeGreaterThan(unevenScore.total);
  });

  it('tie-breaks are deterministic', () => {
    const input = makeSolverInput({ window: makeWindow('2026-03-02', '2026-03-02') });
    const normalized = buildSolverInput(input);

    const candidates: RankedCandidate[] = [
      {
        candidateId: 'b',
        nights: [{ date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A }],
        exchanges: [],
        penaltyScore: 0,
        score: makeScore(100),
      },
      {
        candidateId: 'a',
        nights: [{ date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A }],
        exchanges: [],
        penaltyScore: 0,
        score: makeScore(100),
      },
    ];

    const ranked = rankCandidates(candidates, normalized);
    // Same score, same stats → lexical candidateId: 'a' before 'b'
    expect(ranked[0].candidateId).toBe('a');
    expect(ranked[1].candidateId).toBe('b');
  });

  it('duplicate candidates are removed deterministically', () => {
    const candidates: RankedCandidate[] = [
      {
        candidateId: 'first',
        nights: [{ date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A }],
        exchanges: [],
        penaltyScore: 0,
        score: makeScore(100),
      },
      {
        candidateId: 'second',
        nights: [{ date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A }],
        exchanges: [],
        penaltyScore: 0,
        score: makeScore(100),
      },
    ];

    const deduped = deduplicateCandidates(candidates);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].candidateId).toBe('first'); // first occurrence kept
  });
});
