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
 * Detects when exchanges consistently happen on the same day of the week.
 * Requires at least 3 exchanges with 70%+ on the same day.
 */
export class PreferredExchangeDayDetector implements PatternDetector {
  readonly suggestionType: PolicySuggestionType = 'PREFERRED_EXCHANGE_DAY';

  detect(input: {
    familyId: string;
    window: BehaviorObservationWindow;
    evidence: ObservationEvidenceRecord[];
  }): PolicySuggestionCandidate[] {
    const exchangeEvidence = input.evidence.filter(
      e => e.evidenceType === 'EXCHANGE_PATTERN',
    );

    if (exchangeEvidence.length < MIN_OCCURRENCES) return [];

    // Count exchanges by day of week
    const dayCount: Record<number, string[]> = {};
    for (const e of exchangeEvidence) {
      const dow = e.data.dayOfWeek as number;
      if (dayCount[dow] === undefined) dayCount[dow] = [];
      dayCount[dow].push(e.evidenceId);
    }

    const candidates: PolicySuggestionCandidate[] = [];
    const total = exchangeEvidence.length;

    for (const [dayStr, ids] of Object.entries(dayCount)) {
      const day = Number(dayStr);
      const ratio = ids.length / total;

      if (ids.length >= MIN_OCCURRENCES && ratio >= MIN_DOMINANCE_RATIO) {
        candidates.push({
          suggestionType: this.suggestionType,
          confidenceScore: Math.round(ratio * 100) / 100,
          proposedRuleType: 'EXCHANGE_LOCATION',
          proposedPriority: 'SOFT',
          proposedParameters: { preferredExchangeDay: day },
          proposedScope: { scopeType: 'FAMILY' },
          supportingEvidenceIds: ids.sort(),
          metadata: { dayOfWeek: day, occurrences: ids.length, total },
        });
      }
    }

    return candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
}
