import { PatternDetector } from './PatternDetector';
import {
  BehaviorObservationWindow,
  ObservationEvidenceRecord,
  PolicySuggestionCandidate,
  PolicySuggestionType,
} from '../types';

const MIN_OCCURRENCES = 3;
const MIN_DIVERGENCE_RATIO = 0.3;

/**
 * Detects when accepted proposals consistently allow sibling divergence
 * (children at different parents on the same night). If siblings are frequently
 * split, this may indicate a preference for allowing divergence.
 *
 * This detector looks at accepted proposal evidence and checks for
 * repeated schedule patterns where siblings are assigned to different parents.
 */
export class SiblingDivergencePreferenceDetector implements PatternDetector {
  readonly suggestionType: PolicySuggestionType = 'SIBLING_DIVERGENCE_PREFERENCE';

  detect(input: {
    familyId: string;
    window: BehaviorObservationWindow;
    evidence: ObservationEvidenceRecord[];
  }): PolicySuggestionCandidate[] {
    const proposalEvidence = input.evidence.filter(
      e => e.evidenceType === 'ACCEPTED_PROPOSAL',
    );

    if (proposalEvidence.length < MIN_OCCURRENCES) return [];

    // Group evidence by related proposal to reconstruct per-proposal child placements
    const byProposal: Record<string, ObservationEvidenceRecord[]> = {};
    for (const e of proposalEvidence) {
      const pid = String(e.relatedEntityId);
      if (!byProposal[pid]) byProposal[pid] = [];
      byProposal[pid].push(e);
    }

    // For each proposal, check if multiple children were involved and diverged
    let divergentProposals = 0;
    const supportingIds: string[] = [];
    let totalMultiChildProposals = 0;

    for (const [, records] of Object.entries(byProposal)) {
      // Get unique children in this proposal
      const childIds = [...new Set(records.map(r => r.childId).filter(Boolean))];
      if (childIds.length < 2) continue;

      totalMultiChildProposals++;

      // Check if different children have different parents in block data
      const childParents: Record<string, Set<string>> = {};
      for (const r of records) {
        if (r.childId && r.parentId) {
          if (!childParents[r.childId]) childParents[r.childId] = new Set();
          childParents[r.childId].add(r.parentId);
        }
      }

      // If children have different parent assignments, that's divergence
      const parentSets = Object.values(childParents);
      if (parentSets.length >= 2) {
        const allParents = parentSets.map(s => [...s].sort().join(','));
        const hasDivergence = new Set(allParents).size > 1;
        if (hasDivergence) {
          divergentProposals++;
          for (const r of records) supportingIds.push(r.evidenceId);
        }
      }
    }

    if (totalMultiChildProposals < MIN_OCCURRENCES) return [];

    const ratio = divergentProposals / totalMultiChildProposals;
    if (ratio < MIN_DIVERGENCE_RATIO || divergentProposals < MIN_OCCURRENCES) return [];

    return [{
      suggestionType: this.suggestionType,
      confidenceScore: Math.round(ratio * 100) / 100,
      proposedRuleType: 'SIBLING_COHESION',
      proposedPriority: 'SOFT',
      proposedParameters: { allowDivergence: true },
      proposedScope: { scopeType: 'FAMILY' },
      supportingEvidenceIds: [...new Set(supportingIds)].sort(),
      metadata: {
        divergentProposals,
        totalMultiChildProposals,
      },
    }];
  }
}
