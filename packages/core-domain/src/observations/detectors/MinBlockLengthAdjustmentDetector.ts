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
 * Detects when accepted proposals consistently use longer block lengths
 * than the default. Requires 3+ proposals where 70%+ have average block
 * length >= a detected threshold.
 */
export class MinBlockLengthAdjustmentDetector implements PatternDetector {
  readonly suggestionType: PolicySuggestionType = 'MIN_BLOCK_LENGTH_ADJUSTMENT';

  detect(input: {
    familyId: string;
    window: BehaviorObservationWindow;
    evidence: ObservationEvidenceRecord[];
  }): PolicySuggestionCandidate[] {
    const proposalEvidence = input.evidence.filter(
      e => e.evidenceType === 'ACCEPTED_PROPOSAL',
    );

    if (proposalEvidence.length < MIN_OCCURRENCES) return [];

    // Extract average block lengths from proposals
    const blockLengths: Array<{ evidenceId: string; avg: number }> = [];
    for (const e of proposalEvidence) {
      const avg = e.data.averageBlockLength as number;
      if (typeof avg === 'number' && avg > 0) {
        blockLengths.push({ evidenceId: e.evidenceId, avg });
      }
    }

    if (blockLengths.length < MIN_OCCURRENCES) return [];

    // Check if there's a dominant minimum block length pattern
    // Round to nearest integer for threshold detection
    const thresholdCounts: Record<number, string[]> = {};
    for (const bl of blockLengths) {
      const threshold = Math.floor(bl.avg);
      if (threshold < 2) continue; // Only meaningful for 2+ night blocks
      for (let t = 2; t <= threshold; t++) {
        if (!thresholdCounts[t]) thresholdCounts[t] = [];
        thresholdCounts[t].push(bl.evidenceId);
      }
    }

    const candidates: PolicySuggestionCandidate[] = [];
    const total = blockLengths.length;

    // Find the highest threshold that still meets dominance
    const thresholds = Object.keys(thresholdCounts)
      .map(Number)
      .sort((a, b) => b - a);

    for (const threshold of thresholds) {
      const ids = [...new Set(thresholdCounts[threshold])];
      const ratio = ids.length / total;

      if (ids.length >= MIN_OCCURRENCES && ratio >= MIN_DOMINANCE_RATIO) {
        candidates.push({
          suggestionType: this.suggestionType,
          confidenceScore: Math.round(ratio * 100) / 100,
          proposedRuleType: 'MIN_BLOCK_LENGTH',
          proposedPriority: 'SOFT',
          proposedParameters: { nights: threshold },
          proposedScope: { scopeType: 'FAMILY' },
          supportingEvidenceIds: ids.sort(),
          metadata: { threshold, occurrences: ids.length, total },
        });
        break; // Take the highest threshold that meets criteria
      }
    }

    return candidates;
  }
}
