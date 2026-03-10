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
 * Detects when school closures / disruptions are consistently covered
 * by the same parent. Requires at least 3 overlays with 70%+ by same parent.
 */
export class SchoolClosureCoverageDetector implements PatternDetector {
  readonly suggestionType: PolicySuggestionType = 'SCHOOL_CLOSURE_COVERAGE_PREFERENCE';

  detect(input: {
    familyId: string;
    window: BehaviorObservationWindow;
    evidence: ObservationEvidenceRecord[];
  }): PolicySuggestionCandidate[] {
    const overlayEvidence = input.evidence.filter(
      e => e.evidenceType === 'OVERLAY_COVERAGE',
    );

    if (overlayEvidence.length < MIN_OCCURRENCES) return [];

    // Group by child, then count by parent
    const byChild: Record<string, ObservationEvidenceRecord[]> = {};
    for (const e of overlayEvidence) {
      const childId = e.childId || '_all';
      if (!byChild[childId]) byChild[childId] = [];
      byChild[childId].push(e);
    }

    const candidates: PolicySuggestionCandidate[] = [];

    for (const [childId, childEvidence] of Object.entries(byChild)) {
      if (childEvidence.length < MIN_OCCURRENCES) continue;

      const parentCount: Record<string, string[]> = {};
      for (const e of childEvidence) {
        const pid = String(e.data.assignedParentId);
        if (!parentCount[pid]) parentCount[pid] = [];
        parentCount[pid].push(e.evidenceId);
      }

      const total = childEvidence.length;

      for (const [parentId, ids] of Object.entries(parentCount)) {
        const ratio = ids.length / total;

        if (ids.length >= MIN_OCCURRENCES && ratio >= MIN_DOMINANCE_RATIO) {
          candidates.push({
            suggestionType: this.suggestionType,
            confidenceScore: Math.round(ratio * 100) / 100,
            proposedRuleType: 'ACTIVITY_COMMITMENT',
            proposedPriority: 'SOFT',
            proposedParameters: {
              activityLabel: 'school_closure_coverage',
              preferredResponsibleParentId: parentId,
            },
            proposedScope: childId === '_all'
              ? { scopeType: 'FAMILY' }
              : { scopeType: 'CHILD', childId },
            supportingEvidenceIds: ids.sort(),
            metadata: {
              dominantParentId: parentId,
              occurrences: ids.length,
              total,
              childId: childId === '_all' ? undefined : childId,
            },
          });
        }
      }
    }

    return candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
}
