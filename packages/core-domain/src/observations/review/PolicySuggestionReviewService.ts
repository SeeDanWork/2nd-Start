import { PolicySuggestionReviewBundle } from '../types';
import { IPolicySuggestionRepository } from '../repositories/IPolicySuggestionRepository';
import { IPolicySuggestionEvidenceLinkRepository } from '../repositories/IPolicySuggestionEvidenceLinkRepository';
import { IObservationEvidenceRepository } from '../repositories/IObservationEvidenceRepository';
import { PolicySuggestionReviewError } from '../errors';
import { PolicySuggestionArtifactBuilder } from './PolicySuggestionArtifactBuilder';

export interface PolicySuggestionReviewServiceDeps {
  suggestionRepository: IPolicySuggestionRepository;
  evidenceLinkRepository: IPolicySuggestionEvidenceLinkRepository;
  evidenceRepository: IObservationEvidenceRepository;
}

/**
 * Builds deterministic review bundles for policy suggestions.
 */
export class PolicySuggestionReviewService {
  private readonly suggestionRepo: IPolicySuggestionRepository;
  private readonly linkRepo: IPolicySuggestionEvidenceLinkRepository;
  private readonly evidenceRepo: IObservationEvidenceRepository;
  private readonly artifactBuilder = new PolicySuggestionArtifactBuilder();

  constructor(deps: PolicySuggestionReviewServiceDeps) {
    this.suggestionRepo = deps.suggestionRepository;
    this.linkRepo = deps.evidenceLinkRepository;
    this.evidenceRepo = deps.evidenceRepository;
  }

  async getReviewBundle(suggestionId: string): Promise<PolicySuggestionReviewBundle> {
    const suggestion = await this.suggestionRepo.findById(suggestionId);
    if (!suggestion) {
      throw new PolicySuggestionReviewError(`Suggestion not found: ${suggestionId}`);
    }

    const links = await this.linkRepo.findBySuggestionId(suggestionId);
    const evidenceIds = links.map(l => l.evidenceId);
    const linkedEvidence = evidenceIds.length > 0
      ? await this.evidenceRepo.findByIds(evidenceIds)
      : [];

    // Sort evidence deterministically
    linkedEvidence.sort((a, b) =>
      a.date.localeCompare(b.date) || a.evidenceId.localeCompare(b.evidenceId),
    );

    const artifacts = this.artifactBuilder.buildArtifacts({
      suggestion,
      linkedEvidence,
    });

    return {
      suggestionId: suggestion.suggestionId,
      suggestionType: suggestion.suggestionType,
      status: suggestion.status,
      confidenceScore: suggestion.confidenceScore,
      proposedRuleType: suggestion.proposedRuleType,
      proposedPriority: suggestion.proposedPriority,
      proposedParameters: suggestion.proposedParameters,
      evidenceSummary: suggestion.evidenceSummary,
      artifacts,
    };
  }

  async getPendingReviewBundles(familyId: string): Promise<PolicySuggestionReviewBundle[]> {
    const pending = await this.suggestionRepo.findPendingByFamilyId(familyId);

    // Deterministic order
    pending.sort((a, b) =>
      b.confidenceScore - a.confidenceScore ||
      a.suggestionType.localeCompare(b.suggestionType) ||
      a.suggestionId.localeCompare(b.suggestionId),
    );

    const bundles: PolicySuggestionReviewBundle[] = [];
    for (const suggestion of pending) {
      const bundle = await this.getReviewBundle(suggestion.suggestionId);
      bundles.push(bundle);
    }

    return bundles;
  }
}
