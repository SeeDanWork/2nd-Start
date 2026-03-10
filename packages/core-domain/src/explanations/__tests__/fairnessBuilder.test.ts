import { describe, it, expect } from 'vitest';
import { FairnessExplanationBuilder } from '../builders/FairnessExplanationBuilder';
import { TARGET_ID, CREATED_AT, makeNormalizedArtifact } from './helpers';

describe('FairnessExplanationBuilder', () => {
  const builder = new FairnessExplanationBuilder();

  it('emits gradual restitution explanation when supported', () => {
    const records = builder.buildFairnessExplanations({
      targetType: 'PROPOSAL',
      targetId: TARGET_ID,
      fairnessProjection: {
        parentANightDelta: 2,
        parentBNightDelta: -2,
        weekendParityDelta: 0,
        projectedDeviationAfter: 0.5,
      },
      createdAt: CREATED_AT,
    });

    const restitution = records.filter(r => r.code === 'FAIRNESS_GRADUAL_RESTITUTION');
    expect(restitution).toHaveLength(1);
    expect(restitution[0].importance).toBe('PRIMARY');
    expect(restitution[0].data['nightDelta']).toBe(2);
  });

  it('emits no fairness explanation when no supporting data exists', () => {
    const records = builder.buildFairnessExplanations({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      createdAt: CREATED_AT,
    });

    expect(records).toHaveLength(0);
  });

  it('emits weekend balance when weekendParityDelta is non-zero', () => {
    const records = builder.buildFairnessExplanations({
      targetType: 'PROPOSAL',
      targetId: TARGET_ID,
      fairnessProjection: {
        parentANightDelta: 0,
        weekendParityDelta: 1,
      },
      createdAt: CREATED_AT,
    });

    const weekend = records.filter(r => r.code === 'FAIRNESS_WEEKEND_BALANCE');
    expect(weekend).toHaveLength(1);
    expect(weekend[0].importance).toBe('SECONDARY');
  });

  it('emits drift recorded from fairness artifacts', () => {
    const records = builder.buildFairnessExplanations({
      targetType: 'REPAIR_RESULT',
      targetId: TARGET_ID,
      fairnessArtifacts: [
        makeNormalizedArtifact({
          type: 'FAIRNESS_DRIFT',
          data: { driftAmount: 3 },
          source: { sourceType: 'FAIRNESS', artifactType: 'FAIRNESS_DRIFT' },
        }),
      ],
      createdAt: CREATED_AT,
    });

    const drift = records.filter(r => r.code === 'FAIRNESS_DRIFT_RECORDED');
    expect(drift).toHaveLength(1);
  });

  it('deterministic ordering of outputs', () => {
    const records = builder.buildFairnessExplanations({
      targetType: 'PROPOSAL',
      targetId: TARGET_ID,
      fairnessProjection: {
        parentANightDelta: 1,
        weekendParityDelta: 1,
      },
      fairnessArtifacts: [
        makeNormalizedArtifact({
          type: 'FAIRNESS_DRIFT',
          data: {},
          source: { sourceType: 'FAIRNESS', artifactType: 'FAIRNESS_DRIFT' },
        }),
      ],
      createdAt: CREATED_AT,
    });

    // Run again to verify determinism
    const records2 = builder.buildFairnessExplanations({
      targetType: 'PROPOSAL',
      targetId: TARGET_ID,
      fairnessProjection: {
        parentANightDelta: 1,
        weekendParityDelta: 1,
      },
      fairnessArtifacts: [
        makeNormalizedArtifact({
          type: 'FAIRNESS_DRIFT',
          data: {},
          source: { sourceType: 'FAIRNESS', artifactType: 'FAIRNESS_DRIFT' },
        }),
      ],
      createdAt: CREATED_AT,
    });

    expect(records.map(r => r.code)).toEqual(records2.map(r => r.code));
  });
});
