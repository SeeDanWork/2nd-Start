import {
  ExplanationRecord,
  ExplanationTargetType,
  NormalizedArtifact,
  SourceArtifactRef,
} from '../types';

function makeRecordId(targetId: string, code: string, index: number): string {
  return `${targetId}:${code}:${index}`;
}

/**
 * Builds explanation records for fairness-related decisions.
 * Only emits reasons backed by fairness projection or fairness artifacts.
 */
export class FairnessExplanationBuilder {
  buildFairnessExplanations(input: {
    targetType: ExplanationTargetType;
    targetId: string;
    fairnessProjection?: Record<string, unknown>;
    fairnessArtifacts?: NormalizedArtifact[];
    createdAt: string;
  }): ExplanationRecord[] {
    const records: ExplanationRecord[] = [];
    const { targetType, targetId, fairnessProjection, fairnessArtifacts, createdAt } = input;

    // Fairness projection data
    if (fairnessProjection) {
      const nightDelta = fairnessProjection['parentANightDelta'] as number | undefined;
      const weekendDelta = fairnessProjection['weekendParityDelta'] as number | undefined;
      const deviation = fairnessProjection['projectedDeviationAfter'] as number | undefined;

      // Gradual restitution: non-zero night delta indicates balancing
      if (nightDelta !== undefined && nightDelta !== 0) {
        records.push({
          recordId: makeRecordId(targetId, 'FAIRNESS_GRADUAL_RESTITUTION', 0),
          targetType,
          targetId,
          category: 'FAIRNESS',
          importance: 'PRIMARY',
          code: 'FAIRNESS_GRADUAL_RESTITUTION',
          messageTemplate: 'Fairness was restored gradually with a night delta of {nightDelta}.',
          data: { nightDelta, projectedDeviationAfter: deviation },
          sourceArtifacts: [{ sourceType: 'FAIRNESS', artifactType: 'FAIRNESS_PROJECTION' }],
          createdAt,
        });
      }

      // Weekend balance
      if (weekendDelta !== undefined && weekendDelta !== 0) {
        records.push({
          recordId: makeRecordId(targetId, 'FAIRNESS_WEEKEND_BALANCE', 0),
          targetType,
          targetId,
          category: 'FAIRNESS',
          importance: 'SECONDARY',
          code: 'FAIRNESS_WEEKEND_BALANCE',
          messageTemplate: 'Weekend balance was adjusted by {weekendDelta}.',
          data: { weekendDelta },
          sourceArtifacts: [{ sourceType: 'FAIRNESS', artifactType: 'FAIRNESS_PROJECTION' }],
          createdAt,
        });
      }
    }

    // Fairness artifacts
    if (fairnessArtifacts) {
      let driftIdx = 0;
      let restitutionIdx = 0;
      let holidayIdx = 0;

      for (const artifact of fairnessArtifacts) {
        if (artifact.type === 'FAIRNESS_DRIFT') {
          records.push({
            recordId: makeRecordId(targetId, 'FAIRNESS_DRIFT_RECORDED', driftIdx),
            targetType,
            targetId,
            category: 'FAIRNESS',
            importance: 'SECONDARY',
            code: 'FAIRNESS_DRIFT_RECORDED',
            messageTemplate: 'Fairness drift was recorded and will be addressed in future scheduling.',
            data: artifact.data,
            sourceArtifacts: [artifact.source],
            createdAt,
          });
          driftIdx++;
        }

        if (artifact.type === 'RESTITUTION_TARGET') {
          records.push({
            recordId: makeRecordId(targetId, 'FAIRNESS_GRADUAL_RESTITUTION', restitutionIdx + 1),
            targetType,
            targetId,
            category: 'FAIRNESS',
            importance: 'PRIMARY',
            code: 'FAIRNESS_GRADUAL_RESTITUTION',
            messageTemplate: 'Fairness was restored gradually after disruption on {date}.',
            data: artifact.data,
            date: artifact.data['date'] as string | undefined,
            sourceArtifacts: [artifact.source],
            createdAt,
          });
          restitutionIdx++;
        }

        if (artifact.type === 'FAIRNESS_LEDGER_UPDATE' && artifact.data['holidayBalance']) {
          records.push({
            recordId: makeRecordId(targetId, 'FAIRNESS_HOLIDAY_BALANCE', holidayIdx),
            targetType,
            targetId,
            category: 'FAIRNESS',
            importance: 'SECONDARY',
            code: 'FAIRNESS_HOLIDAY_BALANCE',
            messageTemplate: 'Holiday balance was factored into fairness calculation.',
            data: artifact.data,
            sourceArtifacts: [artifact.source],
            createdAt,
          });
          holidayIdx++;
        }
      }
    }

    return records;
  }
}
