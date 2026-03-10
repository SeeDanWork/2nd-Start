import { describe, it, expect } from 'vitest';
import { SuggestionDeduplicator } from '../core/SuggestionDeduplicator';
import { PolicySuggestion, PolicySuggestionCandidate } from '../types';

const deduplicator = new SuggestionDeduplicator();

function makeCandidate(overrides?: Partial<PolicySuggestionCandidate>): PolicySuggestionCandidate {
  return {
    suggestionType: 'MIN_BLOCK_LENGTH_ADJUSTMENT',
    confidenceScore: 0.8,
    proposedRuleType: 'MIN_BLOCK_LENGTH',
    proposedPriority: 'SOFT',
    proposedParameters: { nights: 3 },
    proposedScope: { scopeType: 'FAMILY' },
    supportingEvidenceIds: ['ev-1'],
    ...overrides,
  };
}

function makePendingSuggestion(overrides?: Partial<PolicySuggestion>): PolicySuggestion {
  return {
    suggestionId: 'sug-existing',
    familyId: 'fam-1',
    suggestionType: 'MIN_BLOCK_LENGTH_ADJUSTMENT',
    status: 'PENDING_REVIEW',
    confidenceScore: 0.8,
    evidenceSummary: {
      occurrenceCount: 3,
      windowStart: '2026-03-01',
      windowEnd: '2026-03-31',
      representativeExamples: [],
    },
    proposedRuleType: 'MIN_BLOCK_LENGTH',
    proposedPriority: 'SOFT',
    proposedParameters: { nights: 3 },
    proposedScope: { scopeType: 'FAMILY' },
    createdAt: '2026-03-20T10:00:00Z',
    ...overrides,
  };
}

describe('SuggestionDeduplicator', () => {
  describe('deduplicateWithinBatch', () => {
    it('keeps the highest confidence when candidates share same material key', () => {
      const low = makeCandidate({ confidenceScore: 0.7 });
      const high = makeCandidate({ confidenceScore: 0.95 });

      const result = deduplicator.deduplicateWithinBatch([low, high]);
      expect(result).toHaveLength(1);
      expect(result[0].confidenceScore).toBe(0.95);
    });

    it('keeps both when candidates differ by suggestion type', () => {
      const a = makeCandidate({ suggestionType: 'MIN_BLOCK_LENGTH_ADJUSTMENT' });
      const b = makeCandidate({ suggestionType: 'PREFERRED_EXCHANGE_DAY', proposedRuleType: 'EXCHANGE_LOCATION', proposedParameters: { preferredExchangeDay: 0 } });

      const result = deduplicator.deduplicateWithinBatch([a, b]);
      expect(result).toHaveLength(2);
    });

    it('keeps both when candidates differ by proposed parameters', () => {
      const a = makeCandidate({ proposedParameters: { nights: 2 } });
      const b = makeCandidate({ proposedParameters: { nights: 3 } });

      const result = deduplicator.deduplicateWithinBatch([a, b]);
      expect(result).toHaveLength(2);
    });

    it('treats parameter key order as irrelevant', () => {
      const a = makeCandidate({ proposedParameters: { alpha: 1, beta: 2 } });
      const b = makeCandidate({ proposedParameters: { beta: 2, alpha: 1 }, confidenceScore: 0.9 });

      const result = deduplicator.deduplicateWithinBatch([a, b]);
      expect(result).toHaveLength(1);
      expect(result[0].confidenceScore).toBe(0.9);
    });

    it('keeps both when scopes differ by childId', () => {
      const a = makeCandidate({ proposedScope: { scopeType: 'CHILD', childId: 'c1' } });
      const b = makeCandidate({ proposedScope: { scopeType: 'CHILD', childId: 'c2' } });

      const result = deduplicator.deduplicateWithinBatch([a, b]);
      expect(result).toHaveLength(2);
    });

    it('keeps both when scope types differ', () => {
      const a = makeCandidate({ proposedScope: { scopeType: 'FAMILY' } });
      const b = makeCandidate({ proposedScope: { scopeType: 'CHILD', childId: 'c1' } });

      const result = deduplicator.deduplicateWithinBatch([a, b]);
      expect(result).toHaveLength(2);
    });

    it('deduplicates when both have undefined scope', () => {
      const a = makeCandidate({ proposedScope: undefined, confidenceScore: 0.6 });
      const b = makeCandidate({ proposedScope: undefined, confidenceScore: 0.9 });

      const result = deduplicator.deduplicateWithinBatch([a, b]);
      expect(result).toHaveLength(1);
      expect(result[0].confidenceScore).toBe(0.9);
    });

    it('returns empty array for empty input', () => {
      expect(deduplicator.deduplicateWithinBatch([])).toEqual([]);
    });
  });

  describe('deduplicate against existing pending', () => {
    it('filters out candidate matching an existing pending suggestion', () => {
      const candidate = makeCandidate();
      const existing = makePendingSuggestion();

      const result = deduplicator.deduplicate({
        candidates: [candidate],
        existingPending: [existing],
      });
      expect(result).toHaveLength(0);
    });

    it('keeps candidate when parameters differ from existing', () => {
      const candidate = makeCandidate({ proposedParameters: { nights: 5 } });
      const existing = makePendingSuggestion({ proposedParameters: { nights: 3 } });

      const result = deduplicator.deduplicate({
        candidates: [candidate],
        existingPending: [existing],
      });
      expect(result).toHaveLength(1);
    });

    it('keeps candidate when suggestion type differs from existing', () => {
      const candidate = makeCandidate({
        suggestionType: 'ACTIVITY_RESPONSIBILITY_RULE',
        proposedRuleType: 'ACTIVITY_COMMITMENT',
        proposedParameters: { activityLabel: 'soccer' },
      });
      const existing = makePendingSuggestion();

      const result = deduplicator.deduplicate({
        candidates: [candidate],
        existingPending: [existing],
      });
      expect(result).toHaveLength(1);
    });

    it('keeps candidate when scope childId differs from existing', () => {
      const candidate = makeCandidate({ proposedScope: { scopeType: 'CHILD', childId: 'c1' } });
      const existing = makePendingSuggestion({ proposedScope: { scopeType: 'CHILD', childId: 'c2' } });

      const result = deduplicator.deduplicate({
        candidates: [candidate],
        existingPending: [existing],
      });
      expect(result).toHaveLength(1);
    });

    it('filters correctly with multiple candidates and multiple pending', () => {
      const dup = makeCandidate();
      const novel = makeCandidate({
        suggestionType: 'PREFERRED_EXCHANGE_LOCATION',
        proposedRuleType: 'EXCHANGE_LOCATION',
        proposedParameters: { preferredLocation: 'School' },
      });

      const result = deduplicator.deduplicate({
        candidates: [dup, novel],
        existingPending: [makePendingSuggestion()],
      });
      expect(result).toHaveLength(1);
      expect(result[0].suggestionType).toBe('PREFERRED_EXCHANGE_LOCATION');
    });

    it('returns all candidates when no existing pending', () => {
      const result = deduplicator.deduplicate({
        candidates: [makeCandidate(), makeCandidate({ proposedParameters: { nights: 5 } })],
        existingPending: [],
      });
      expect(result).toHaveLength(2);
    });
  });
});
