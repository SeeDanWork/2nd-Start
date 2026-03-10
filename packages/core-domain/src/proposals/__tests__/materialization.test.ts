import { describe, it, expect } from 'vitest';
import { materializeCandidate } from '../core/ProposalCandidateMaterializer';
import { collectCandidateArtifacts } from '../core/ProposalArtifactCollector';
import { buildDiffArtifact, buildChangedNightArtifact, buildExchangeArtifact, buildScoreArtifact, buildFairnessArtifact, buildAcceptanceArtifact } from '../materialization/ProposalArtifactBuilder';
import { buildReviewArtifacts } from '../materialization/ProposalReviewArtifactBuilder';
import { buildScoreSummary } from '../review/ProposalScoreSummaryBuilder';
import { buildFairnessSummary } from '../review/ProposalFairnessSummaryBuilder';
import { makeCandidate, PARENT_A, PARENT_B, CHILD_1 } from './helpers';
import { ScheduleDiff } from '../../diff';

describe('materializeCandidate', () => {
  it('maps candidate nights in sorted order', () => {
    const candidate = makeCandidate({
      nights: [
        { date: '2026-03-02', childId: CHILD_1 as string, parentId: PARENT_B as string },
        { date: '2026-03-01', childId: CHILD_1 as string, parentId: PARENT_A as string },
      ],
    });

    const result = materializeCandidate({ candidate, proposalScheduleId: 'ps-1' });

    expect(result.nights).toHaveLength(2);
    expect(result.nights[0].date).toBe('2026-03-01');
    expect(result.nights[1].date).toBe('2026-03-02');
  });

  it('assigns deterministic IDs to nights and exchanges', () => {
    const candidate = makeCandidate({
      exchanges: [
        { date: '2026-03-01', childId: CHILD_1 as string, fromParentId: PARENT_A as string, toParentId: PARENT_B as string },
      ],
    });

    const result = materializeCandidate({ candidate, proposalScheduleId: 'ps-test' });

    expect(result.nights[0].id).toBe('ps-test-night-0');
    expect(result.exchanges[0].id).toBe('ps-test-exchange-0');
  });

  it('throws on missing candidateId', () => {
    expect(() =>
      materializeCandidate({
        candidate: { ...makeCandidate(), candidateId: '' },
        proposalScheduleId: 'ps-1',
      }),
    ).toThrow('candidateId');
  });

  it('preserves scoreBreakdown and stabilityDelta', () => {
    const candidate = makeCandidate({
      scoreBreakdown: { totalScore: 90, custom: true },
      stabilityDelta: 0.12,
    });

    const result = materializeCandidate({ candidate, proposalScheduleId: 'ps-1' });
    expect(result.scoreBreakdown).toEqual({ totalScore: 90, custom: true });
    expect(result.stabilityDelta).toBe(0.12);
  });
});

describe('collectCandidateArtifacts', () => {
  it('returns empty when no artifacts on candidate', () => {
    const candidate = makeCandidate({ artifacts: undefined });
    expect(collectCandidateArtifacts(candidate)).toEqual([]);
  });

  it('returns candidate artifacts', () => {
    const candidate = makeCandidate({
      artifacts: [{ type: 'CUSTOM', data: { key: 'val' } }],
    });
    const result = collectCandidateArtifacts(candidate);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('CUSTOM');
  });
});

describe('buildScoreSummary', () => {
  it('extracts numeric fields', () => {
    const summary = buildScoreSummary({ totalScore: 85, primaryScore: 80, penalties: 2 });
    expect(summary.totalScore).toBe(85);
    expect(summary.primaryScore).toBe(80);
    expect(summary.penalties).toBe(2);
  });

  it('returns empty object for undefined input', () => {
    expect(buildScoreSummary(undefined)).toEqual({});
  });
});

describe('buildFairnessSummary', () => {
  it('extracts projected deviations', () => {
    const summary = buildFairnessSummary({
      projectedNightDeviationByParentId: { 'p-a': 0.5 },
      projectedWeekendDeviationByParentId: { 'p-a': 0.2 },
    });
    expect(summary).toBeDefined();
    expect(summary!.projectedNightDeviationByParentId).toEqual({ 'p-a': 0.5 });
  });

  it('returns undefined for empty input', () => {
    expect(buildFairnessSummary({})).toBeUndefined();
    expect(buildFairnessSummary(undefined)).toBeUndefined();
  });
});

describe('ProposalArtifactBuilder', () => {
  const baseDiff: ScheduleDiff = {
    changedNights: [{ date: '2026-03-01', childId: 'c1', fromParentId: 'pA', toParentId: 'pB' }],
    addedExchanges: [],
    removedExchanges: [],
    changedExchanges: [],
    summary: {
      changedNightCount: 1,
      changedExchangeCount: 0,
      affectedChildren: ['c1'],
      affectedDates: ['2026-03-01'],
    },
  };

  it('buildDiffArtifact includes summary data', () => {
    const art = buildDiffArtifact(baseDiff);
    expect(art.type).toBe('DIFF_SUMMARY');
    expect(art.data.changedNightCount).toBe(1);
  });

  it('buildChangedNightArtifact includes nights', () => {
    const art = buildChangedNightArtifact(baseDiff);
    expect(art.type).toBe('CHANGED_NIGHT_SUMMARY');
    expect((art.data.nights as any[]).length).toBe(1);
  });

  it('buildScoreArtifact wraps score data', () => {
    const art = buildScoreArtifact({ totalScore: 90 });
    expect(art.type).toBe('SCORE_SUMMARY');
    expect(art.data.totalScore).toBe(90);
  });

  it('buildAcceptanceArtifact includes counts', () => {
    const art = buildAcceptanceArtifact({
      newScheduleVersionId: 'sv-new',
      newVersionNumber: 2,
      archivedScheduleVersionId: 'sv-old',
      acceptedProposalId: 'p-1',
      invalidatedProposalIds: ['p-2', 'p-3'],
      resolvedOverlayIds: ['o-1'],
      fairnessArtifacts: [],
    });
    expect(art.type).toBe('ACCEPTANCE_OUTCOME');
    expect(art.data.invalidatedProposalCount).toBe(2);
    expect(art.data.resolvedOverlayCount).toBe(1);
  });
});

describe('buildReviewArtifacts', () => {
  it('includes diff and score artifacts', () => {
    const diff: ScheduleDiff = {
      changedNights: [{ date: '2026-03-01', childId: 'c1', fromParentId: 'pA', toParentId: 'pB' }],
      addedExchanges: [],
      removedExchanges: [],
      changedExchanges: [],
      summary: { changedNightCount: 1, changedExchangeCount: 0, affectedChildren: ['c1'], affectedDates: ['2026-03-01'] },
    };

    const artifacts = buildReviewArtifacts({
      proposalId: 'p-1',
      proposalStatus: 'PENDING',
      baseScheduleVersionId: 'sv-1',
      proposalScheduleId: 'ps-1',
      diff,
      scoreSummary: { totalScore: 85 },
      fairnessSummary: { projectedNightDeviationByParentId: { 'pA': 0.5 } },
      artifacts: [],
      metadata: { generatedAt: '2026-03-01T00:00:00Z', origin: 'BASELINE_SOLVER' },
    });

    const types = artifacts.map(a => a.type);
    expect(types).toContain('DIFF_SUMMARY');
    expect(types).toContain('CHANGED_NIGHT_SUMMARY');
    expect(types).toContain('SCORE_SUMMARY');
    expect(types).toContain('FAIRNESS_SUMMARY');
  });

  it('skips changed night artifact when no changed nights', () => {
    const diff: ScheduleDiff = {
      changedNights: [],
      addedExchanges: [],
      removedExchanges: [],
      changedExchanges: [],
      summary: { changedNightCount: 0, changedExchangeCount: 0, affectedChildren: [], affectedDates: [] },
    };

    const artifacts = buildReviewArtifacts({
      proposalId: 'p-1',
      proposalStatus: 'PENDING',
      baseScheduleVersionId: 'sv-1',
      proposalScheduleId: 'ps-1',
      diff,
      scoreSummary: { totalScore: 85 },
      artifacts: [],
      metadata: { generatedAt: '2026-03-01T00:00:00Z', origin: 'BASELINE_SOLVER' },
    });

    const types = artifacts.map(a => a.type);
    expect(types).not.toContain('CHANGED_NIGHT_SUMMARY');
  });
});
