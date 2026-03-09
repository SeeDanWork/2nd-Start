import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { PolicyScope } from './PolicyScope';
import { BasePolicyParameters } from './BasePolicyParameters';

export interface TypedPolicyRule<TParams extends BasePolicyParameters = BasePolicyParameters> {
  id: string;
  familyId: string;
  ruleType: PolicyRuleType;
  priority: PolicyPriority;
  active: boolean;
  label?: string;
  scope: PolicyScope;
  parameters: TParams;
  createdAt: string;
  updatedAt: string;
}
