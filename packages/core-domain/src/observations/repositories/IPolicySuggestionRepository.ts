import { PolicySuggestion } from '../types';

export interface IPolicySuggestionRepository {
  save(suggestion: PolicySuggestion): Promise<void>;
  findById(suggestionId: string): Promise<PolicySuggestion | null>;
  findByFamilyId(familyId: string): Promise<PolicySuggestion[]>;
  findPendingByFamilyId(familyId: string): Promise<PolicySuggestion[]>;
  update(suggestion: PolicySuggestion): Promise<void>;
}
