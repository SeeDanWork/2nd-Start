import {
  ExplanationRecord,
  ExplanationTargetType,
  NormalizedArtifact,
} from '../types';

function makeRecordId(targetId: string, code: string, index: number): string {
  return `${targetId}:${code}:${index}`;
}

/**
 * Builds explanation records for proposal acceptance outcomes.
 */
export class AcceptanceExplanationBuilder {
  buildAcceptanceExplanations(input: {
    targetType: ExplanationTargetType;
    targetId: string;
    acceptanceArtifacts?: NormalizedArtifact[];
    createdAt: string;
  }): ExplanationRecord[] {
    const records: ExplanationRecord[] = [];
    const { targetType, targetId, acceptanceArtifacts, createdAt } = input;

    if (!acceptanceArtifacts || acceptanceArtifacts.length === 0) {
      return records;
    }

    let versionIdx = 0;
    let invalidationIdx = 0;
    let overlayIdx = 0;
    let fairnessIdx = 0;

    for (const artifact of acceptanceArtifacts) {
      switch (artifact.type) {
        case 'ACCEPTANCE_RESULT':
          records.push({
            recordId: makeRecordId(targetId, 'ACCEPTANCE_NEW_ACTIVE_VERSION', versionIdx),
            targetType,
            targetId,
            category: 'ACCEPTANCE',
            importance: 'PRIMARY',
            code: 'ACCEPTANCE_NEW_ACTIVE_VERSION',
            messageTemplate: 'Proposal acceptance created a new active schedule version.',
            data: artifact.data,
            sourceArtifacts: [artifact.source],
            createdAt,
          });
          versionIdx++;
          break;

        case 'INVALIDATED_PROPOSALS':
          records.push({
            recordId: makeRecordId(targetId, 'ACCEPTANCE_INVALIDATED_SIBLINGS', invalidationIdx),
            targetType,
            targetId,
            category: 'ACCEPTANCE',
            importance: 'SECONDARY',
            code: 'ACCEPTANCE_INVALIDATED_SIBLINGS',
            messageTemplate: 'Sibling proposals were invalidated after acceptance.',
            data: artifact.data,
            sourceArtifacts: [artifact.source],
            createdAt,
          });
          invalidationIdx++;
          break;

        case 'OVERLAY_RESOLUTION':
          records.push({
            recordId: makeRecordId(targetId, 'ACCEPTANCE_RESOLVED_OVERLAYS', overlayIdx),
            targetType,
            targetId,
            category: 'ACCEPTANCE',
            importance: 'SECONDARY',
            code: 'ACCEPTANCE_RESOLVED_OVERLAYS',
            messageTemplate: 'Disruption overlays were resolved as part of acceptance.',
            data: artifact.data,
            sourceArtifacts: [artifact.source],
            createdAt,
          });
          overlayIdx++;
          break;

        case 'FAIRNESS_LEDGER_UPDATE':
          records.push({
            recordId: makeRecordId(targetId, 'ACCEPTANCE_FAIRNESS_UPDATED', fairnessIdx),
            targetType,
            targetId,
            category: 'ACCEPTANCE',
            importance: 'SECONDARY',
            code: 'ACCEPTANCE_FAIRNESS_UPDATED',
            messageTemplate: 'Fairness ledger was updated after proposal acceptance.',
            data: artifact.data,
            sourceArtifacts: [artifact.source],
            createdAt,
          });
          fairnessIdx++;
          break;
      }
    }

    return records;
  }
}
