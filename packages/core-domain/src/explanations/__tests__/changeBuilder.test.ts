import { describe, it, expect } from 'vitest';
import { ChangeExplanationBuilder } from '../builders/ChangeExplanationBuilder';
import {
  TARGET_ID, PARENT_A, PARENT_B, CHILD_1, CHILD_2, CREATED_AT,
  makeDiff, makeChangedNight, makeNormalizedArtifact,
} from './helpers';

describe('ChangeExplanationBuilder', () => {
  const builder = new ChangeExplanationBuilder();

  it('emits change explanations for diff-backed changes', () => {
    const diff = makeDiff({
      changedNights: [
        makeChangedNight({ date: '2026-03-10', childId: CHILD_1 }),
      ],
      summary: { changedNightCount: 1, changedExchangeCount: 0, affectedChildren: [CHILD_1], affectedDates: ['2026-03-10'] },
    });

    const records = builder.buildChangeExplanations({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      diff,
      createdAt: CREATED_AT,
    });

    expect(records.length).toBeGreaterThan(0);
    expect(records[0].code).toBe('CHANGE_BASELINE_PRESERVATION');
    expect(records[0].date).toBe('2026-03-10');
    expect(records[0].childId).toBe(CHILD_1);
    expect(records[0].sourceArtifacts.length).toBeGreaterThan(0);
  });

  it('detects sibling cohesion pattern when multiple children move to same parent on same date', () => {
    const diff = makeDiff({
      changedNights: [
        makeChangedNight({ date: '2026-03-10', childId: CHILD_1, toParentId: PARENT_B }),
        makeChangedNight({ date: '2026-03-10', childId: CHILD_2, toParentId: PARENT_B }),
      ],
      summary: { changedNightCount: 2, changedExchangeCount: 0, affectedChildren: [CHILD_1, CHILD_2], affectedDates: ['2026-03-10'] },
    });

    const records = builder.buildChangeExplanations({
      targetType: 'PROPOSAL',
      targetId: TARGET_ID,
      diff,
      createdAt: CREATED_AT,
    });

    const siblingRecords = records.filter(r => r.code === 'CHANGE_SIBLING_COHESION');
    expect(siblingRecords.length).toBe(2);
  });

  it('does not emit unsupported reasons when no diff provided', () => {
    const records = builder.buildChangeExplanations({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      createdAt: CREATED_AT,
    });

    // Only score context if scoreBreakdown is provided — here nothing provided
    expect(records).toHaveLength(0);
  });

  it('emits overlay repair from solver artifacts', () => {
    const records = builder.buildChangeExplanations({
      targetType: 'REPAIR_RESULT',
      targetId: TARGET_ID,
      solverArtifacts: [
        makeNormalizedArtifact({
          type: 'OVERLAY_IMPACT',
          data: { overlayId: 'overlay-1', impact: 'schedule adjusted' },
          source: { sourceType: 'REPAIR', artifactType: 'OVERLAY_IMPACT' },
        }),
      ],
      createdAt: CREATED_AT,
    });

    const overlayRecords = records.filter(r => r.code === 'CHANGE_OVERLAY_REPAIR');
    expect(overlayRecords).toHaveLength(1);
  });

  it('groups changes deterministically (sorted by date then childId)', () => {
    const diff = makeDiff({
      changedNights: [
        makeChangedNight({ date: '2026-03-12', childId: CHILD_2 }),
        makeChangedNight({ date: '2026-03-10', childId: CHILD_1 }),
        makeChangedNight({ date: '2026-03-10', childId: CHILD_2 }),
      ],
    });

    const records = builder.buildChangeExplanations({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      diff,
      createdAt: CREATED_AT,
    });

    const dates = records.filter(r => r.date).map(r => `${r.date}:${r.childId}`);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('includes score breakdown as supporting context', () => {
    const records = builder.buildChangeExplanations({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      scoreBreakdown: { totalScore: 85, fairnessScore: 90, stabilityScore: 80 },
      createdAt: CREATED_AT,
    });

    const scoreRecords = records.filter(r => r.code === 'CHANGE_SCORE_CONTEXT');
    expect(scoreRecords).toHaveLength(1);
    expect(scoreRecords[0].importance).toBe('SUPPORTING');
  });
});
