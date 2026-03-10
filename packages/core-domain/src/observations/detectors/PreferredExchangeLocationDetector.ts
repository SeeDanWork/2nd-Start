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
 * Detects when exchanges consistently use the same location.
 * Requires at least 3 exchanges with 70%+ at the same location.
 */
export class PreferredExchangeLocationDetector implements PatternDetector {
  readonly suggestionType: PolicySuggestionType = 'PREFERRED_EXCHANGE_LOCATION';

  detect(input: {
    familyId: string;
    window: BehaviorObservationWindow;
    evidence: ObservationEvidenceRecord[];
  }): PolicySuggestionCandidate[] {
    const exchangeEvidence = input.evidence.filter(
      e => e.evidenceType === 'EXCHANGE_PATTERN',
    );

    if (exchangeEvidence.length < MIN_OCCURRENCES) return [];

    // Count exchanges by location
    const locationCount: Record<string, string[]> = {};
    for (const e of exchangeEvidence) {
      const loc = String(e.data.location || '').trim();
      if (!loc) continue;
      if (!locationCount[loc]) locationCount[loc] = [];
      locationCount[loc].push(e.evidenceId);
    }

    const candidates: PolicySuggestionCandidate[] = [];
    const total = exchangeEvidence.length;

    for (const [location, ids] of Object.entries(locationCount)) {
      const ratio = ids.length / total;

      if (ids.length >= MIN_OCCURRENCES && ratio >= MIN_DOMINANCE_RATIO) {
        candidates.push({
          suggestionType: this.suggestionType,
          confidenceScore: Math.round(ratio * 100) / 100,
          proposedRuleType: 'EXCHANGE_LOCATION',
          proposedPriority: 'SOFT',
          proposedParameters: { preferredLocation: location },
          proposedScope: { scopeType: 'FAMILY' },
          supportingEvidenceIds: ids.sort(),
          metadata: { location, occurrences: ids.length, total },
        });
      }
    }

    return candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
}
