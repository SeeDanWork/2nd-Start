import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { TypedPolicyRule } from '../types/TypedPolicyRule';
import { PolicyEvaluationContext, ScheduleSnapshotLike, SnapshotNight, SnapshotExchange } from '../types/evaluation';
import { PolicyScope } from '../types/PolicyScope';
import { BasePolicyParameters } from '../types/BasePolicyParameters';

export const FAMILY_ID = 'family-1';
export const PARENT_A = 'parent-a';
export const PARENT_B = 'parent-b';
export const CHILD_1 = 'child-1';
export const CHILD_2 = 'child-2';

export function makeRule<TParams extends BasePolicyParameters>(
  overrides: Partial<TypedPolicyRule<TParams>> & { ruleType: PolicyRuleType; parameters: TParams },
): TypedPolicyRule<TParams> {
  return {
    id: overrides.id ?? 'rule-1',
    familyId: overrides.familyId ?? FAMILY_ID,
    ruleType: overrides.ruleType,
    priority: overrides.priority ?? PolicyPriority.HARD,
    active: overrides.active ?? true,
    label: overrides.label,
    scope: overrides.scope ?? { scopeType: 'FAMILY' },
    parameters: overrides.parameters,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00Z',
  };
}

export function makeContext(overrides?: Partial<PolicyEvaluationContext>): PolicyEvaluationContext {
  return {
    familyId: overrides?.familyId ?? FAMILY_ID,
    scheduleStartDate: overrides?.scheduleStartDate ?? '2026-03-01',
    scheduleEndDate: overrides?.scheduleEndDate ?? '2026-03-14',
    scheduleVersionId: overrides?.scheduleVersionId,
    proposalId: overrides?.proposalId,
  };
}

export function makeNight(date: string, childId: string, parentId: string): SnapshotNight {
  return { date, childId, parentId };
}

export function makeExchange(
  date: string,
  childId: string,
  fromParentId: string,
  toParentId: string,
  time: string = '18:00',
  location: string = 'School',
): SnapshotExchange {
  return { date, childId, fromParentId, toParentId, time, location };
}

export function makeSchedule(overrides?: Partial<ScheduleSnapshotLike>): ScheduleSnapshotLike {
  return {
    familyId: overrides?.familyId ?? FAMILY_ID,
    startDate: overrides?.startDate ?? '2026-03-01',
    endDate: overrides?.endDate ?? '2026-03-14',
    nights: overrides?.nights ?? [],
    exchanges: overrides?.exchanges ?? [],
  };
}
