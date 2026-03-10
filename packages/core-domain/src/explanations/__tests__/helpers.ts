import {
  ExplanationRecord,
  ExplanationTargetType,
  NormalizedArtifact,
  ScheduleSnapshot,
  SourceArtifactRef,
  IExplanationRecordRepository,
  IExplanationSourceArtifactRepository,
} from '../types';
import { ScheduleDiff, ChangedNight } from '../../diff';
import { PolicyEvaluationResult, PolicyViolation } from '../../policy';

export const TARGET_ID = 'target-001';
export const FAMILY_ID = 'family-001';
export const PARENT_A = 'parent-a';
export const PARENT_B = 'parent-b';
export const CHILD_1 = 'child-1';
export const CHILD_2 = 'child-2';
export const CREATED_AT = '2026-03-09T00:00:00.000Z';

export function makeScheduleSnapshot(overrides: Partial<ScheduleSnapshot> = {}): ScheduleSnapshot {
  return {
    familyId: FAMILY_ID,
    startDate: '2026-03-09',
    endDate: '2026-03-15',
    nights: [
      { date: '2026-03-09', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-10', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-11', childId: CHILD_1, parentId: PARENT_B },
    ],
    exchanges: [],
    ...overrides,
  };
}

export function makeDiff(overrides: Partial<ScheduleDiff> = {}): ScheduleDiff {
  return {
    changedNights: [],
    addedExchanges: [],
    removedExchanges: [],
    changedExchanges: [],
    summary: {
      changedNightCount: 0,
      changedExchangeCount: 0,
      affectedChildren: [],
      affectedDates: [],
    },
    ...overrides,
  };
}

export function makeChangedNight(overrides: Partial<ChangedNight> = {}): ChangedNight {
  return {
    date: '2026-03-10',
    childId: CHILD_1,
    fromParentId: PARENT_A,
    toParentId: PARENT_B,
    ...overrides,
  };
}

export function makeNormalizedArtifact(overrides: Partial<NormalizedArtifact> = {}): NormalizedArtifact {
  return {
    type: 'SCORE_BREAKDOWN',
    data: { totalScore: 85 },
    source: {
      sourceType: 'SOLVER',
      artifactType: 'SCORE_BREAKDOWN',
    },
    ...overrides,
  };
}

export function makePolicyEvaluation(overrides: Partial<PolicyEvaluationResult> = {}): PolicyEvaluationResult {
  return {
    isFeasible: true,
    hardViolations: [],
    strongViolations: [],
    softViolations: [],
    penalties: [],
    guidance: [],
    impacts: [],
    ...overrides,
  };
}

export function makePolicyViolation(overrides: Partial<PolicyViolation> = {}): PolicyViolation {
  return {
    ruleId: 'rule-001',
    ruleType: 'SIBLING_COHESION' as any,
    priority: 'HARD' as any,
    code: 'SIBLING_COHESION_VIOLATION',
    message: 'Siblings must be together',
    ...overrides,
  };
}

export function makeMockRecordRepo(): IExplanationRecordRepository & { records: ExplanationRecord[] } {
  const records: ExplanationRecord[] = [];
  return {
    records,
    insert: async (newRecords: ExplanationRecord[]) => { records.push(...newRecords); },
    findByTarget: async (targetType: ExplanationTargetType, targetId: string) =>
      records.filter(r => r.targetType === targetType && r.targetId === targetId),
  };
}

export function makeMockSourceArtifactRepo(): IExplanationSourceArtifactRepository & { refs: Map<string, SourceArtifactRef[]> } {
  const refs = new Map<string, SourceArtifactRef[]>();
  return {
    refs,
    insertSourceRefs: async (recordId: string, newRefs: SourceArtifactRef[]) => {
      const existing = refs.get(recordId) ?? [];
      refs.set(recordId, [...existing, ...newRefs]);
    },
    findByRecordId: async (recordId: string) => refs.get(recordId) ?? [],
  };
}
