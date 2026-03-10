import { PatternDetector } from './PatternDetector';
import {
  BehaviorObservationWindow,
  ObservationEvidenceRecord,
  PolicySuggestionCandidate,
  PolicySuggestionType,
} from '../types';

const MIN_OCCURRENCES = 3;
const MIN_DOMINANCE_RATIO = 0.7;

/**
 * Detects when the same parent consistently handles a specific activity
 * for a child. Requires 3+ instances with 70%+ by same parent.
 */
export class ActivityResponsibilityDetector implements PatternDetector {
  readonly suggestionType: PolicySuggestionType = 'ACTIVITY_RESPONSIBILITY_RULE';

  detect(input: {
    familyId: string;
    window: BehaviorObservationWindow;
    evidence: ObservationEvidenceRecord[];
  }): PolicySuggestionCandidate[] {
    const activityEvidence = input.evidence.filter(
      e => e.evidenceType === 'ACTIVITY_RESPONSIBILITY',
    );

    if (activityEvidence.length < MIN_OCCURRENCES) return [];

    // Group by activity label + child
    const groups: Record<string, ObservationEvidenceRecord[]> = {};
    for (const e of activityEvidence) {
      const label = String(e.data.activityLabel);
      const childId = e.childId || '_all';
      const key = `${label}::${childId}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }

    const candidates: PolicySuggestionCandidate[] = [];

    for (const [key, groupEvidence] of Object.entries(groups)) {
      if (groupEvidence.length < MIN_OCCURRENCES) continue;

      const [activityLabel, childId] = key.split('::');

      // Count by responsible parent
      const parentCount: Record<string, string[]> = {};
      for (const e of groupEvidence) {
        const pid = String(e.data.responsibleParentId);
        if (!parentCount[pid]) parentCount[pid] = [];
        parentCount[pid].push(e.evidenceId);
      }

      const total = groupEvidence.length;

      for (const [parentId, ids] of Object.entries(parentCount)) {
        const ratio = ids.length / total;

        if (ids.length >= MIN_OCCURRENCES && ratio >= MIN_DOMINANCE_RATIO) {
          candidates.push({
            suggestionType: this.suggestionType,
            confidenceScore: Math.round(ratio * 100) / 100,
            proposedRuleType: 'ACTIVITY_COMMITMENT',
            proposedPriority: 'SOFT',
            proposedParameters: {
              activityLabel,
              preferredResponsibleParentId: parentId,
            },
            proposedScope: childId === '_all'
              ? { scopeType: 'FAMILY' }
              : { scopeType: 'CHILD', childId },
            supportingEvidenceIds: ids.sort(),
            metadata: {
              activityLabel,
              dominantParentId: parentId,
              occurrences: ids.length,
              total,
            },
          });
        }
      }
    }

    return candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
}
