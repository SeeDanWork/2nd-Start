import { TypedPolicyRule } from '../types/TypedPolicyRule';

export interface IPolicyRuleRepository {
  findById(id: string): Promise<TypedPolicyRule | null>;
  findByFamilyId(familyId: string): Promise<TypedPolicyRule[]>;
  findActiveByFamilyId(familyId: string): Promise<TypedPolicyRule[]>;
  save(rule: TypedPolicyRule): Promise<void>;
  update(rule: TypedPolicyRule): Promise<void>;
  delete(id: string): Promise<void>;
}
