import { describe, it, expect } from 'vitest';
import { AcceptanceExplanationBuilder } from '../builders/AcceptanceExplanationBuilder';
import { TARGET_ID, CREATED_AT, makeNormalizedArtifact } from './helpers';

describe('AcceptanceExplanationBuilder', () => {
  const builder = new AcceptanceExplanationBuilder();

  it('explains new active version creation', () => {
    const records = builder.buildAcceptanceExplanations({
      targetType: 'PROPOSAL_ACCEPTANCE',
      targetId: TARGET_ID,
      acceptanceArtifacts: [
        makeNormalizedArtifact({
          type: 'ACCEPTANCE_RESULT',
          data: { newVersionId: 'v2', previousVersionId: 'v1' },
          source: { sourceType: 'ACCEPTANCE', artifactType: 'ACCEPTANCE_RESULT' },
        }),
      ],
      createdAt: CREATED_AT,
    });

    expect(records).toHaveLength(1);
    expect(records[0].code).toBe('ACCEPTANCE_NEW_ACTIVE_VERSION');
    expect(records[0].importance).toBe('PRIMARY');
  });

  it('explains sibling proposal invalidation', () => {
    const records = builder.buildAcceptanceExplanations({
      targetType: 'PROPOSAL_ACCEPTANCE',
      targetId: TARGET_ID,
      acceptanceArtifacts: [
        makeNormalizedArtifact({
          type: 'INVALIDATED_PROPOSALS',
          data: { invalidatedIds: ['p2', 'p3'] },
          source: { sourceType: 'ACCEPTANCE', artifactType: 'INVALIDATED_PROPOSALS' },
        }),
      ],
      createdAt: CREATED_AT,
    });

    expect(records).toHaveLength(1);
    expect(records[0].code).toBe('ACCEPTANCE_INVALIDATED_SIBLINGS');
    expect(records[0].importance).toBe('SECONDARY');
  });

  it('explains overlay resolution when artifacts support it', () => {
    const records = builder.buildAcceptanceExplanations({
      targetType: 'PROPOSAL_ACCEPTANCE',
      targetId: TARGET_ID,
      acceptanceArtifacts: [
        makeNormalizedArtifact({
          type: 'OVERLAY_RESOLUTION',
          data: { resolvedOverlayIds: ['o1'] },
          source: { sourceType: 'ACCEPTANCE', artifactType: 'OVERLAY_RESOLUTION' },
        }),
      ],
      createdAt: CREATED_AT,
    });

    expect(records).toHaveLength(1);
    expect(records[0].code).toBe('ACCEPTANCE_RESOLVED_OVERLAYS');
  });

  it('returns empty when no acceptance artifacts', () => {
    const records = builder.buildAcceptanceExplanations({
      targetType: 'PROPOSAL_ACCEPTANCE',
      targetId: TARGET_ID,
      createdAt: CREATED_AT,
    });

    expect(records).toHaveLength(0);
  });
});
