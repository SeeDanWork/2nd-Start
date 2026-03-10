import {
  BehaviorObservationWindow,
  ObservationEvidenceRecord,
  PolicySuggestion,
} from '../types';
import { ObservationEvidenceExtractor } from '../evidence/ObservationEvidenceExtractor';
import { PatternDetectorRegistry } from '../detectors/PatternDetectorRegistry';
import { SuggestionDeduplicator } from './SuggestionDeduplicator';
import { SuggestionEvidenceSummarizer } from './SuggestionEvidenceSummarizer';
import { IObservationEvidenceRepository } from '../repositories/IObservationEvidenceRepository';
import { IPolicySuggestionRepository } from '../repositories/IPolicySuggestionRepository';
import { IPolicySuggestionEvidenceLinkRepository } from '../repositories/IPolicySuggestionEvidenceLinkRepository';
import { PolicySuggestionError } from '../errors';

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

export interface PolicySuggestionServiceDeps {
  extractors: ObservationEvidenceExtractor[];
  detectorRegistry: PatternDetectorRegistry;
  evidenceRepository: IObservationEvidenceRepository;
  suggestionRepository: IPolicySuggestionRepository;
  evidenceLinkRepository: IPolicySuggestionEvidenceLinkRepository;
  idGenerator?: (prefix: string) => string;
}

/**
 * Main service for generating policy suggestions from observed behavior.
 *
 * Flow:
 * 1. Extract evidence from all registered extractors
 * 2. Run all registered pattern detectors
 * 3. Deduplicate candidates against existing pending suggestions
 * 4. Persist evidence, suggestions, and links
 * 5. Return generated suggestions in deterministic order
 */
export class PolicySuggestionService {
  private readonly extractors: ObservationEvidenceExtractor[];
  private readonly detectorRegistry: PatternDetectorRegistry;
  private readonly deduplicator = new SuggestionDeduplicator();
  private readonly summarizer = new SuggestionEvidenceSummarizer();
  private readonly evidenceRepo: IObservationEvidenceRepository;
  private readonly suggestionRepo: IPolicySuggestionRepository;
  private readonly linkRepo: IPolicySuggestionEvidenceLinkRepository;
  private readonly genId: (prefix: string) => string;

  constructor(deps: PolicySuggestionServiceDeps) {
    this.extractors = deps.extractors;
    this.detectorRegistry = deps.detectorRegistry;
    this.evidenceRepo = deps.evidenceRepository;
    this.suggestionRepo = deps.suggestionRepository;
    this.linkRepo = deps.evidenceLinkRepository;
    this.genId = deps.idGenerator ?? generateId;
  }

  async generateSuggestions(input: {
    window: BehaviorObservationWindow;
  }): Promise<PolicySuggestion[]> {
    const { window } = input;

    // 1. Extract evidence from all extractors (deterministic order)
    const allEvidence: ObservationEvidenceRecord[] = [];
    for (const extractor of this.extractors) {
      const records = extractor.extractEvidence({ window });
      allEvidence.push(...records);
    }

    // Sort deterministically
    allEvidence.sort((a, b) =>
      a.date.localeCompare(b.date) ||
      a.evidenceType.localeCompare(b.evidenceType) ||
      a.evidenceId.localeCompare(b.evidenceId),
    );

    // 2. Persist evidence
    if (allEvidence.length > 0) {
      await this.evidenceRepo.saveBatch(allEvidence);
    }

    // 3. Run all detectors
    const detectors = this.detectorRegistry.getDetectors();
    const allCandidates = detectors.flatMap(detector =>
      detector.detect({
        familyId: window.familyId,
        window,
        evidence: allEvidence,
      }),
    );

    // 4. Deduplicate within batch
    const uniqueCandidates = this.deduplicator.deduplicateWithinBatch(allCandidates);

    // 5. Deduplicate against existing pending suggestions
    const existingPending = await this.suggestionRepo.findPendingByFamilyId(window.familyId);
    const newCandidates = this.deduplicator.deduplicate({
      candidates: uniqueCandidates,
      existingPending,
    });

    if (newCandidates.length === 0) return [];

    // 6. Build and persist suggestions
    const now = new Date().toISOString();
    const suggestions: PolicySuggestion[] = [];

    for (const candidate of newCandidates) {
      const suggestionId = this.genId('suggestion');

      const evidenceSummary = this.summarizer.buildSummary({
        window,
        evidenceIds: candidate.supportingEvidenceIds,
        allEvidence,
      });

      const suggestion: PolicySuggestion = {
        suggestionId,
        familyId: window.familyId,
        suggestionType: candidate.suggestionType,
        status: 'PENDING_REVIEW',
        confidenceScore: candidate.confidenceScore,
        evidenceSummary,
        proposedRuleType: candidate.proposedRuleType,
        proposedPriority: candidate.proposedPriority,
        proposedParameters: candidate.proposedParameters,
        proposedScope: candidate.proposedScope,
        createdAt: now,
        metadata: candidate.metadata,
      };

      await this.suggestionRepo.save(suggestion);

      // Link evidence
      const links = candidate.supportingEvidenceIds.map(evidenceId => ({
        id: this.genId('link'),
        suggestionId,
        evidenceId,
        createdAt: now,
      }));

      if (links.length > 0) {
        await this.linkRepo.saveBatch(links);
      }

      suggestions.push(suggestion);
    }

    // Return in deterministic order
    return suggestions.sort((a, b) =>
      b.confidenceScore - a.confidenceScore ||
      a.suggestionType.localeCompare(b.suggestionType) ||
      a.suggestionId.localeCompare(b.suggestionId),
    );
  }

  async getPendingSuggestions(input: {
    familyId: string;
  }): Promise<PolicySuggestion[]> {
    const suggestions = await this.suggestionRepo.findPendingByFamilyId(input.familyId);
    return suggestions.sort((a, b) =>
      b.confidenceScore - a.confidenceScore ||
      a.suggestionType.localeCompare(b.suggestionType) ||
      a.suggestionId.localeCompare(b.suggestionId),
    );
  }
}
