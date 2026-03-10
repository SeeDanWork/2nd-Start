import {
  ObservationEvidenceRecord,
  SuggestionEvidenceSummary,
  BehaviorObservationWindow,
} from '../types';

const MAX_REPRESENTATIVE_EXAMPLES = 5;

/**
 * Builds concise, deterministic evidence summaries with stable representative examples.
 */
export class SuggestionEvidenceSummarizer {
  buildSummary(input: {
    window: BehaviorObservationWindow;
    evidenceIds: string[];
    allEvidence: ObservationEvidenceRecord[];
  }): SuggestionEvidenceSummary {
    const { window, evidenceIds, allEvidence } = input;

    const matching = allEvidence
      .filter(e => evidenceIds.includes(e.evidenceId))
      .sort((a, b) => a.date.localeCompare(b.date) || a.evidenceId.localeCompare(b.evidenceId));

    const examples = matching
      .slice(0, MAX_REPRESENTATIVE_EXAMPLES)
      .map(e => ({ date: e.date, data: e.data }));

    return {
      occurrenceCount: matching.length,
      windowStart: window.startDate,
      windowEnd: window.endDate,
      representativeExamples: examples,
    };
  }
}
