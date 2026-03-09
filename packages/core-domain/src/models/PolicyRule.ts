import { FamilyId, PolicyParameters } from '../types';
import { PolicyRuleType, PolicyPriority } from '../enums';

export interface PolicyRule {
  id: string;
  familyId: FamilyId;
  ruleType: PolicyRuleType;
  priority: PolicyPriority;
  parameters: PolicyParameters;
  active: boolean;
  createdAt: Date;
}

export function createPolicyRule(
  id: string,
  familyId: FamilyId,
  ruleType: PolicyRuleType,
  priority: PolicyPriority,
  parameters: PolicyParameters,
): PolicyRule {
  return {
    id,
    familyId,
    ruleType,
    priority,
    parameters,
    active: true,
    createdAt: new Date(),
  };
}
