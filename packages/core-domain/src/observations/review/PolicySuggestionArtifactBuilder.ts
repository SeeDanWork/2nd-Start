import { PolicySuggestion, ObservationEvidenceRecord } from '../types';

/**
 * Builds deterministic artifacts for suggestion review bundles.
 */
export class PolicySuggestionArtifactBuilder {
  buildArtifacts(input: {
    suggestion: PolicySuggestion;
    linkedEvidence: ObservationEvidenceRecord[];
  }): Array<{ type: string; data: Record<string, unknown> }> {
    const { suggestion, linkedEvidence } = input;
    const artifacts: Array<{ type: string; data: Record<string, unknown> }> = [];

    // Evidence count summary
    artifacts.push({
      type: 'EVIDENCE_COUNT_SUMMARY',
      data: {
        totalEvidenceCount: linkedEvidence.length,
        evidenceTypes: this.countByType(linkedEvidence),
        windowStart: suggestion.evidenceSummary.windowStart,
        windowEnd: suggestion.evidenceSummary.windowEnd,
      },
    });

    // Representative examples
    artifacts.push({
      type: 'REPRESENTATIVE_EXAMPLES',
      data: {
        examples: suggestion.evidenceSummary.representativeExamples,
      },
    });

    // Confidence explanation inputs
    artifacts.push({
      type: 'CONFIDENCE_INPUTS',
      data: {
        confidenceScore: suggestion.confidenceScore,
        occurrenceCount: suggestion.evidenceSummary.occurrenceCount,
        suggestionType: suggestion.suggestionType,
        proposedRuleType: suggestion.proposedRuleType,
        proposedPriority: suggestion.proposedPriority,
      },
    });

    // Proposed rule details
    artifacts.push({
      type: 'PROPOSED_RULE',
      data: {
        ruleType: suggestion.proposedRuleType,
        priority: suggestion.proposedPriority,
        parameters: suggestion.proposedParameters,
        scope: suggestion.proposedScope ?? null,
      },
    });

    return artifacts;
  }

  private countByType(evidence: ObservationEvidenceRecord[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of evidence) {
      counts[e.evidenceType] = (counts[e.evidenceType] || 0) + 1;
    }
    return counts;
  }
}
