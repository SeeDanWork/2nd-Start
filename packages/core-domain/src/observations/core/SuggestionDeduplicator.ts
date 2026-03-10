import { PolicySuggestion, PolicySuggestionCandidate } from '../types';

/**
 * Prevents duplicate pending suggestions for materially identical proposals.
 * Deterministic matching considers suggestion type, proposed rule type,
 * proposed parameters, and scope.
 */
export class SuggestionDeduplicator {
  /**
   * Filters out candidates that already have a matching pending suggestion.
   */
  deduplicate(input: {
    candidates: PolicySuggestionCandidate[];
    existingPending: PolicySuggestion[];
  }): PolicySuggestionCandidate[] {
    const { candidates, existingPending } = input;

    return candidates.filter(candidate => {
      const isDuplicate = existingPending.some(existing =>
        this.isMateriallyIdentical(candidate, existing),
      );
      return !isDuplicate;
    });
  }

  /**
   * Also deduplicates within a batch of new candidates, keeping the highest confidence.
   */
  deduplicateWithinBatch(candidates: PolicySuggestionCandidate[]): PolicySuggestionCandidate[] {
    const seen = new Map<string, PolicySuggestionCandidate>();

    for (const c of candidates) {
      const key = this.buildMaterialKey(c);
      const existing = seen.get(key);
      if (!existing || c.confidenceScore > existing.confidenceScore) {
        seen.set(key, c);
      }
    }

    return [...seen.values()];
  }

  private isMateriallyIdentical(
    candidate: PolicySuggestionCandidate,
    existing: PolicySuggestion,
  ): boolean {
    if (candidate.suggestionType !== existing.suggestionType) return false;
    if (candidate.proposedRuleType !== existing.proposedRuleType) return false;
    if (!this.paramsMatch(candidate.proposedParameters, existing.proposedParameters)) return false;
    if (!this.scopeMatch(candidate.proposedScope, existing.proposedScope)) return false;
    return true;
  }

  private buildMaterialKey(candidate: PolicySuggestionCandidate): string {
    const parts = [
      candidate.suggestionType,
      candidate.proposedRuleType,
      JSON.stringify(this.sortedParams(candidate.proposedParameters)),
      JSON.stringify(candidate.proposedScope || null),
    ];
    return parts.join('::');
  }

  private paramsMatch(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ): boolean {
    return JSON.stringify(this.sortedParams(a)) === JSON.stringify(this.sortedParams(b));
  }

  private sortedParams(params: Record<string, unknown>): Record<string, unknown> {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(params).sort()) {
      sorted[key] = params[key];
    }
    return sorted;
  }

  private scopeMatch(
    a?: PolicySuggestionCandidate['proposedScope'],
    b?: PolicySuggestion['proposedScope'],
  ): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.scopeType === b.scopeType &&
      a.childId === b.childId &&
      a.dateStart === b.dateStart &&
      a.dateEnd === b.dateEnd;
  }
}
