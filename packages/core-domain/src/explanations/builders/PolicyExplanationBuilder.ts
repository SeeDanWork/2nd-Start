import { PolicyEvaluationResult } from '../../policy';
import {
  ExplanationRecord,
  ExplanationTargetType,
  NormalizedArtifact,
} from '../types';

function makeRecordId(targetId: string, code: string, index: number): string {
  return `${targetId}:${code}:${index}`;
}

const RULE_TYPE_TO_CODE: Record<string, string> = {
  SIBLING_COHESION: 'POLICY_SIBLING_COHESION',
  SCHOOL_NIGHT_ROUTINE: 'POLICY_SCHOOL_NIGHT_ROUTINE',
  MIN_BLOCK_LENGTH: 'POLICY_MIN_BLOCK_LENGTH',
  EXCHANGE_LOCATION: 'POLICY_EXCHANGE_LOCATION',
  TRAVEL_DISTANCE_LIMIT: 'POLICY_TRAVEL_DISTANCE',
  ACTIVITY_COMMITMENT: 'POLICY_ACTIVITY_COMMITMENT',
};

const RULE_TYPE_TO_TEMPLATE: Record<string, string> = {
  SIBLING_COHESION: 'Sibling cohesion rule impacted scheduling on {date}.',
  SCHOOL_NIGHT_ROUTINE: 'School-night routine protection was applied on {date}.',
  MIN_BLOCK_LENGTH: 'Minimum block length requirement was enforced.',
  EXCHANGE_LOCATION: 'Exchange location preference was factored into the schedule.',
  TRAVEL_DISTANCE_LIMIT: 'Travel distance limit was considered.',
  ACTIVITY_COMMITMENT: 'Activity commitment was preserved in the schedule.',
};

/**
 * Builds explanation records from policy evaluation results.
 * Only emits records for policy violations, penalties, and guidance that actually occurred.
 */
export class PolicyExplanationBuilder {
  buildPolicyExplanations(input: {
    targetType: ExplanationTargetType;
    targetId: string;
    policyEvaluation?: PolicyEvaluationResult;
    policyArtifacts?: NormalizedArtifact[];
    createdAt: string;
  }): ExplanationRecord[] {
    const records: ExplanationRecord[] = [];
    const { targetType, targetId, policyEvaluation, policyArtifacts, createdAt } = input;

    if (policyEvaluation) {
      // All violations across tiers
      const allViolations = [
        ...policyEvaluation.hardViolations,
        ...policyEvaluation.strongViolations,
        ...policyEvaluation.softViolations,
      ].sort((a, b) => {
        const rt = a.ruleType.localeCompare(b.ruleType);
        if (rt !== 0) return rt;
        return (a.date ?? '').localeCompare(b.date ?? '');
      });

      let idx = 0;
      for (const violation of allViolations) {
        const code = RULE_TYPE_TO_CODE[violation.ruleType] ?? `POLICY_${violation.ruleType}`;
        const template = RULE_TYPE_TO_TEMPLATE[violation.ruleType]
          ?? `Policy rule ${violation.ruleType} was applied.`;
        const importance = violation.priority === 'HARD' ? 'PRIMARY' as const
          : violation.priority === 'STRONG' ? 'SECONDARY' as const
          : 'SUPPORTING' as const;

        records.push({
          recordId: makeRecordId(targetId, code, idx),
          targetType,
          targetId,
          category: 'POLICY',
          importance,
          code,
          messageTemplate: template,
          data: {
            ruleId: violation.ruleId,
            ruleType: violation.ruleType,
            priority: violation.priority,
            violationMessage: violation.message,
            ...violation.data,
          },
          date: violation.date,
          childId: violation.childId,
          sourceArtifacts: [{
            sourceType: 'POLICY',
            sourceId: violation.ruleId,
            artifactType: 'POLICY_VIOLATION',
          }],
          createdAt,
        });
        idx++;
      }

      // Penalties as supporting
      let penaltyIdx = 0;
      for (const penalty of policyEvaluation.penalties) {
        records.push({
          recordId: makeRecordId(targetId, 'POLICY_PENALTY', penaltyIdx),
          targetType,
          targetId,
          category: 'POLICY',
          importance: 'SUPPORTING',
          code: 'POLICY_PENALTY',
          messageTemplate: 'Policy penalty of {scoreImpact} applied for {ruleType}.',
          data: {
            ruleId: penalty.ruleId,
            ruleType: penalty.ruleType,
            scoreImpact: penalty.scoreImpact,
            ...penalty.data,
          },
          sourceArtifacts: [{
            sourceType: 'POLICY',
            sourceId: penalty.ruleId,
            artifactType: 'POLICY_PENALTY',
          }],
          createdAt,
        });
        penaltyIdx++;
      }
    }

    // Additional policy artifacts
    if (policyArtifacts) {
      let artifactIdx = 0;
      for (const artifact of policyArtifacts) {
        if (artifact.type === 'POLICY_GUIDANCE') {
          records.push({
            recordId: makeRecordId(targetId, 'POLICY_GUIDANCE', artifactIdx),
            targetType,
            targetId,
            category: 'POLICY',
            importance: 'SUPPORTING',
            code: 'POLICY_GUIDANCE',
            messageTemplate: 'Policy guidance was provided: {message}.',
            data: artifact.data,
            sourceArtifacts: [artifact.source],
            createdAt,
          });
          artifactIdx++;
        }
      }
    }

    return records;
  }
}
