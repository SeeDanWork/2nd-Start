import { describe, it, expect } from 'vitest';
import { ArtifactNormalizer } from '../core/ArtifactNormalizer';
import { TARGET_ID } from './helpers';

describe('ArtifactNormalizer', () => {
  const normalizer = new ArtifactNormalizer();

  it('preserves source refs through normalization', () => {
    const result = normalizer.normalizeArtifacts({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      rawArtifacts: [{
        type: 'SCORE_BREAKDOWN',
        data: { totalScore: 85 },
        sourceType: 'SOLVER',
        sourceId: 'solver-run-1',
        artifactId: 'art-1',
      }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].source.sourceType).toBe('SOLVER');
    expect(result[0].source.sourceId).toBe('solver-run-1');
    expect(result[0].source.artifactType).toBe('SCORE_BREAKDOWN');
    expect(result[0].source.artifactId).toBe('art-1');
  });

  it('normalizes mixed artifacts deterministically', () => {
    const result = normalizer.normalizeArtifacts({
      targetType: 'PROPOSAL',
      targetId: TARGET_ID,
      rawArtifacts: [
        { type: 'FAIRNESS_PROJECTION', data: { delta: 2 }, sourceType: 'FAIRNESS' },
        { type: 'CALENDAR_CLASSIFICATION', data: { kind: 'SCHOOL' }, sourceType: 'CALENDAR' },
        { type: 'ACCEPTANCE_RESULT', data: { versionId: 'v2' }, sourceType: 'ACCEPTANCE' },
      ],
    });

    expect(result).toHaveLength(3);
    // Should be sorted by type alphabetically
    expect(result[0].type).toBe('ACCEPTANCE_RESULT');
    expect(result[1].type).toBe('CALENDAR_CLASSIFICATION');
    expect(result[2].type).toBe('FAIRNESS_PROJECTION');
  });

  it('preserves unknown artifact types as generic supporting inputs', () => {
    const result = normalizer.normalizeArtifacts({
      targetType: 'REPAIR_RESULT',
      targetId: TARGET_ID,
      rawArtifacts: [
        { type: 'CUSTOM_UNKNOWN_TYPE', data: { foo: 'bar' }, sourceType: 'CUSTOM' },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('CUSTOM_UNKNOWN_TYPE');
    expect(result[0].data).toEqual({ foo: 'bar' });
    expect(result[0].source.sourceType).toBe('CUSTOM');
  });

  it('defaults sourceType to targetType when not provided', () => {
    const result = normalizer.normalizeArtifacts({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      rawArtifacts: [
        { type: 'SCORE_BREAKDOWN', data: { totalScore: 90 } },
      ],
    });

    expect(result[0].source.sourceType).toBe('SCHEDULE_VERSION');
  });

  it('repeated identical input yields identical output', () => {
    const input = {
      targetType: 'PROPOSAL' as const,
      targetId: TARGET_ID,
      rawArtifacts: [
        { type: 'B_TYPE', data: { x: 1 }, sourceType: 'SRC' },
        { type: 'A_TYPE', data: { y: 2 }, sourceType: 'SRC' },
      ],
    };

    const r1 = normalizer.normalizeArtifacts(input);
    const r2 = normalizer.normalizeArtifacts(input);
    expect(r1).toEqual(r2);
  });
});
