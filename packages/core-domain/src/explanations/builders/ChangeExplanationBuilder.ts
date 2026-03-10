import { ScheduleDiff } from '../../diff';
import { PolicyEvaluationResult } from '../../policy';
import {
  ExplanationRecord,
  ExplanationTargetType,
  NormalizedArtifact,
  ScheduleSnapshot,
  SourceArtifactRef,
} from '../types';

let changeCounter = 0;

function makeRecordId(targetId: string, code: string, index: number): string {
  return `${targetId}:${code}:${index}`;
}

/**
 * Builds explanation records for schedule changes (diff-backed).
 * Only emits reasons backed by diff, score, or policy artifacts.
 */
export class ChangeExplanationBuilder {
  buildChangeExplanations(input: {
    targetType: ExplanationTargetType;
    targetId: string;
    baseSchedule?: ScheduleSnapshot;
    candidateSchedule?: ScheduleSnapshot;
    diff?: ScheduleDiff;
    scoreBreakdown?: Record<string, unknown>;
    policyEvaluation?: PolicyEvaluationResult;
    fairnessProjection?: Record<string, unknown>;
    solverArtifacts?: NormalizedArtifact[];
    createdAt: string;
  }): ExplanationRecord[] {
    const records: ExplanationRecord[] = [];
    const { targetType, targetId, diff, scoreBreakdown, policyEvaluation, createdAt } = input;

    // Changed nights from diff
    if (diff && diff.changedNights.length > 0) {
      // Group by childId for sibling cohesion detection
      const byChild = new Map<string, typeof diff.changedNights>();
      for (const cn of diff.changedNights) {
        const list = byChild.get(cn.childId) ?? [];
        list.push(cn);
        byChild.set(cn.childId, list);
      }

      // Check for sibling cohesion pattern: multiple children moved to same parent on same date
      const dateParentMap = new Map<string, Set<string>>();
      for (const cn of diff.changedNights) {
        const key = `${cn.date}:${cn.toParentId}`;
        const children = dateParentMap.get(key) ?? new Set();
        children.add(cn.childId);
        dateParentMap.set(key, children);
      }

      const siblingCohesionDates = new Set<string>();
      for (const [key, children] of dateParentMap) {
        if (children.size > 1) {
          siblingCohesionDates.add(key.split(':')[0]);
        }
      }

      // Emit per-night change records
      let idx = 0;
      for (const cn of [...diff.changedNights].sort((a, b) =>
        a.date.localeCompare(b.date) || a.childId.localeCompare(b.childId),
      )) {
        const isSiblingCohesion = siblingCohesionDates.has(cn.date);

        if (isSiblingCohesion) {
          records.push({
            recordId: makeRecordId(targetId, 'CHANGE_SIBLING_COHESION', idx),
            targetType,
            targetId,
            category: 'CHANGE',
            importance: 'PRIMARY',
            code: 'CHANGE_SIBLING_COHESION',
            messageTemplate: 'Schedule changed on {date} to preserve sibling cohesion.',
            data: {
              fromParentId: cn.fromParentId,
              toParentId: cn.toParentId,
            },
            date: cn.date,
            childId: cn.childId,
            sourceArtifacts: [{ sourceType: 'DIFF', artifactType: 'CHANGED_NIGHT' }],
            createdAt,
          });
        } else {
          records.push({
            recordId: makeRecordId(targetId, 'CHANGE_BASELINE_PRESERVATION', idx),
            targetType,
            targetId,
            category: 'CHANGE',
            importance: 'PRIMARY',
            code: 'CHANGE_BASELINE_PRESERVATION',
            messageTemplate: 'Schedule adjusted on {date} as part of baseline optimization.',
            data: {
              fromParentId: cn.fromParentId,
              toParentId: cn.toParentId,
            },
            date: cn.date,
            childId: cn.childId,
            sourceArtifacts: [{ sourceType: 'DIFF', artifactType: 'CHANGED_NIGHT' }],
            createdAt,
          });
        }
        idx++;
      }
    }

    // Overlay repair explanations from solver artifacts
    if (input.solverArtifacts) {
      const overlayArtifacts = input.solverArtifacts.filter(a => a.type === 'OVERLAY_IMPACT');
      let idx = 0;
      for (const artifact of overlayArtifacts) {
        records.push({
          recordId: makeRecordId(targetId, 'CHANGE_OVERLAY_REPAIR', idx),
          targetType,
          targetId,
          category: 'CHANGE',
          importance: 'PRIMARY',
          code: 'CHANGE_OVERLAY_REPAIR',
          messageTemplate: 'Schedule adjusted to repair disruption overlay.',
          data: artifact.data,
          sourceArtifacts: [artifact.source],
          createdAt,
        });
        idx++;
      }
    }

    // Score breakdown as supporting context
    if (scoreBreakdown) {
      const sourceArtifacts: SourceArtifactRef[] = [
        { sourceType: 'SOLVER', artifactType: 'SCORE_BREAKDOWN' },
      ];
      records.push({
        recordId: makeRecordId(targetId, 'CHANGE_SCORE_CONTEXT', 0),
        targetType,
        targetId,
        category: 'CHANGE',
        importance: 'SUPPORTING',
        code: 'CHANGE_SCORE_CONTEXT',
        messageTemplate: 'Overall score: {totalScore} (fairness: {fairnessScore}, stability: {stabilityScore}).',
        data: scoreBreakdown,
        sourceArtifacts,
        createdAt,
      });
    }

    return records;
  }
}
