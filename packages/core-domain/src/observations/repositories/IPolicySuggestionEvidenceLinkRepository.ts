import { PolicySuggestionEvidenceLink } from '../types';

export interface IPolicySuggestionEvidenceLinkRepository {
  save(link: PolicySuggestionEvidenceLink): Promise<void>;
  saveBatch(links: PolicySuggestionEvidenceLink[]): Promise<void>;
  findBySuggestionId(suggestionId: string): Promise<PolicySuggestionEvidenceLink[]>;
  findByEvidenceId(evidenceId: string): Promise<PolicySuggestionEvidenceLink[]>;
}
