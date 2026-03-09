import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { TypedPolicyRule } from './TypedPolicyRule';
import { BasePolicyParameters } from './BasePolicyParameters';

export interface SnapshotNight {
  date: string;
  childId: string;
  parentId: string;
}

export interface SnapshotExchange {
  date: string;
  childId: string;
  fromParentId: string;
  toParentId: string;
  time: string;
  location: string;
}

export interface ScheduleSnapshotLike {
  familyId: string;
  startDate: string;
  endDate: string;
  nights: SnapshotNight[];
  exchanges: SnapshotExchange[];
}

export interface PolicyEvaluationContext {
  familyId: string;
  scheduleVersionId?: string;
  proposalId?: string;
  scheduleStartDate: string;
  scheduleEndDate: string;
}

export interface PolicyViolation {
  ruleId: string;
  ruleType: PolicyRuleType;
  priority: PolicyPriority;
  childId?: string;
  date?: string;
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface PolicyPenalty {
  ruleId: string;
  ruleType: PolicyRuleType;
  priority: PolicyPriority;
  scoreImpact: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface PolicyGuidance {
  ruleId: string;
  ruleType: PolicyRuleType;
  message: string;
  data?: Record<string, unknown>;
}

export type PolicyImpactType = 'VIOLATION' | 'PENALTY' | 'GUIDANCE';

export interface PolicyImpactRecord {
  ruleId: string;
  ruleType: PolicyRuleType;
  priority: PolicyPriority;
  impactType: PolicyImpactType;
  childId?: string;
  date?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface PolicyEvaluationResult {
  isFeasible: boolean;
  hardViolations: PolicyViolation[];
  strongViolations: PolicyViolation[];
  softViolations: PolicyViolation[];
  penalties: PolicyPenalty[];
  guidance: PolicyGuidance[];
  impacts: PolicyImpactRecord[];
}

export interface PolicyRuleEvaluationOutput {
  violations: PolicyViolation[];
  penalties: PolicyPenalty[];
  guidance: PolicyGuidance[];
  impacts: PolicyImpactRecord[];
}

export interface PolicyRuleEvaluationInput<TParams extends BasePolicyParameters = BasePolicyParameters> {
  rule: TypedPolicyRule<TParams>;
  context: PolicyEvaluationContext;
  schedule: ScheduleSnapshotLike;
}
