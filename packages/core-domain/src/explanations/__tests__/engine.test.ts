import { describe, it, expect } from 'vitest';
import { ExplanationEngine } from '../core/ExplanationEngine';
import {
  TARGET_ID, PARENT_A, PARENT_B, CHILD_1, CHILD_2, CREATED_AT,
  makeDiff, makeChangedNight, makePolicyEvaluation, makePolicyViolation,
  makeMockRecordRepo, makeMockSourceArtifactRepo,
} from './helpers';

describe('ExplanationEngine', () => {
  it('builds full bundle from mixed subsystem inputs', async () => {
    const engine = new ExplanationEngine();

    const bundle = await engine.buildBundle({
      targetType: 'PROPOSAL',
      targetId: TARGET_ID,
      diff: makeDiff({
        changedNights: [
          makeChangedNight({ date: '2026-03-10', childId: CHILD_1 }),
        ],
      }),
      policyEvaluation: makePolicyEvaluation({
        hardViolations: [
          makePolicyViolation({ ruleType: 'SIBLING_COHESION' as any, date: '2026-03-10' }),
        ],
      }),
      fairnessProjection: {
        parentANightDelta: 1,
        weekendParityDelta: 0,
        projectedDeviationAfter: 0.3,
      },
      rawArtifacts: [
        {
          type: 'CALENDAR_CLASSIFICATION',
          data: { kind: 'SCHOOL', constraintLevel: 'HARD', date: '2026-03-10' },
          sourceType: 'CALENDAR',
        },
        {
          type: 'ACCEPTANCE_RESULT',
          data: { newVersionId: 'v2' },
          sourceType: 'ACCEPTANCE',
        },
      ],
      createdAt: CREATED_AT,
    });

    expect(bundle.targetType).toBe('PROPOSAL');
    expect(bundle.targetId).toBe(TARGET_ID);
    expect(bundle.changeExplanations.length).toBeGreaterThan(0);
    expect(bundle.policyExplanations.length).toBeGreaterThan(0);
    expect(bundle.fairnessExplanations.length).toBeGreaterThan(0);
    expect(bundle.calendarExplanations.length).toBeGreaterThan(0);
    expect(bundle.acceptanceExplanations.length).toBeGreaterThan(0);
    expect(bundle.summary.primaryReasons.length).toBeGreaterThan(0);
    expect(bundle.artifacts.length).toBe(2);
  });

  it('persists explanation records when requested', async () => {
    const recordRepo = makeMockRecordRepo();
    const sourceRepo = makeMockSourceArtifactRepo();
    const engine = new ExplanationEngine({
      recordRepository: recordRepo,
      sourceArtifactRepository: sourceRepo,
    });

    await engine.buildBundle({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      diff: makeDiff({
        changedNights: [makeChangedNight()],
      }),
      createdAt: CREATED_AT,
      persist: true,
    });

    expect(recordRepo.records.length).toBeGreaterThan(0);
    expect(sourceRepo.refs.size).toBeGreaterThan(0);
  });

  it('returns empty category arrays when inputs absent', async () => {
    const engine = new ExplanationEngine();

    const bundle = await engine.buildBundle({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      createdAt: CREATED_AT,
    });

    expect(bundle.changeExplanations).toHaveLength(0);
    expect(bundle.fairnessExplanations).toHaveLength(0);
    expect(bundle.policyExplanations).toHaveLength(0);
    expect(bundle.calendarExplanations).toHaveLength(0);
    expect(bundle.acceptanceExplanations).toHaveLength(0);
    expect(bundle.summary.primaryReasons).toHaveLength(0);
  });

  it('identical input yields identical bundle', async () => {
    const engine = new ExplanationEngine();
    const input = {
      targetType: 'PROPOSAL' as const,
      targetId: TARGET_ID,
      diff: makeDiff({
        changedNights: [makeChangedNight()],
      }),
      fairnessProjection: { parentANightDelta: 1, weekendParityDelta: 0 },
      createdAt: CREATED_AT,
    };

    const b1 = await engine.buildBundle(input);
    const b2 = await engine.buildBundle(input);

    expect(b1.changeExplanations).toEqual(b2.changeExplanations);
    expect(b1.fairnessExplanations).toEqual(b2.fairnessExplanations);
    expect(b1.summary).toEqual(b2.summary);
  });
});
