import { TypedPolicyRule } from '../types/TypedPolicyRule';

export interface IPolicyRuleRepository {
  findById(id: string): Promise<TypedPolicyRule | null>;
  findByFamilyId(familyId: string): Promise<TypedPolicyRule[]>;
  findActiveByFamilyId(familyId: string): Promise<TypedPolicyRule[]>;
  /** Find a rule created from a specific suggestion (for idempotent acceptance). */
  findBySourceSuggestionId(suggestionId: string): Promise<TypedPolicyRule | null>;
  save(rule: TypedPolicyRule): Promise<void>;
  update(rule: TypedPolicyRule): Promise<void>;
  delete(id: string): Promise<void>;
}
