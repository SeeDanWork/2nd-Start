import { ScheduleDiff } from '../../diff';
import { PolicyEvaluationResult } from '../../policy';

// ─── Target & Importance ──────────────────────────────────────

export type ExplanationTargetType =
  | 'SCHEDULE_VERSION'
  | 'PROPOSAL'
  | 'REPAIR_RESULT'
  | 'PROPOSAL_ACCEPTANCE'
  | 'CALENDAR_EVENT_CLASSIFICATION';

export type ExplanationImportance = 'PRIMARY' | 'SECONDARY' | 'SUPPORTING';

// ─── Explanation Categories & Codes ───────────────────────────

export type ExplanationCategory =
  | 'CHANGE'
  | 'FAIRNESS'
  | 'POLICY'
  | 'CALENDAR'
  | 'ACCEPTANCE';

// ─── Source Artifact Reference ────────────────────────────────

export interface SourceArtifactRef {
  sourceType: string;
  sourceId?: string;
  artifactType: string;
  artifactId?: string;
}

// ─── Explanation Record ───────────────────────────────────────

export interface ExplanationRecord {
  recordId: string;
  targetType: ExplanationTargetType;
  targetId: string;
  category: ExplanationCategory;
  importance: ExplanationImportance;
  code: string;
  messageTemplate: string;
  data: Record<string, unknown>;
  date?: string;
  childId?: string;
  parentId?: string;
  sourceArtifacts: SourceArtifactRef[];
  createdAt: string;
}

// ─── Explanation Summary ──────────────────────────────────────

export interface ExplanationSummary {
  targetType: ExplanationTargetType;
  targetId: string;
  primaryReasons: ExplanationRecord[];
  secondaryReasons: ExplanationRecord[];
  supportingReasons: ExplanationRecord[];
  generatedAt: string;
}

// ─── Explanation Artifact ─────────────────────────────────────

export interface ExplanationArtifact {
  type: string;
  data: Record<string, unknown>;
}

// ─── Explanation Bundle ───────────────────────────────────────

export interface ExplanationBundle {
  targetType: ExplanationTargetType;
  targetId: string;
  summary: ExplanationSummary;
  changeExplanations: ExplanationRecord[];
  fairnessExplanations: ExplanationRecord[];
  policyExplanations: ExplanationRecord[];
  calendarExplanations: ExplanationRecord[];
  acceptanceExplanations: ExplanationRecord[];
  artifacts: ExplanationArtifact[];
}

// ─── Normalized Artifact ──────────────────────────────────────

export interface NormalizedArtifact {
  type: string;
  data: Record<string, unknown>;
  source: SourceArtifactRef;
}

// ─── Schedule Snapshot (for explanation inputs) ───────────────

export interface ScheduleSnapshot {
  familyId: string;
  startDate: string;
  endDate: string;
  nights: Array<{ date: string; childId: string; parentId: string }>;
  exchanges: Array<{
    date: string;
    childId: string;
    fromParentId: string;
    toParentId: string;
    time: string;
    location: string;
  }>;
}

// ─── Input Types ──────────────────────────────────────────────

export interface ChangeExplanationInput {
  baseSchedule?: ScheduleSnapshot;
  candidateSchedule?: ScheduleSnapshot;
  diff?: ScheduleDiff;
  scoreBreakdown?: Record<string, unknown>;
  policyEvaluation?: PolicyEvaluationResult;
  fairnessProjection?: Record<string, unknown>;
  solverArtifacts?: Array<{ type: string; data: Record<string, unknown> }>;
}

export interface ExplanationBuildInput {
  targetType: ExplanationTargetType;
  targetId: string;
  baseSchedule?: ScheduleSnapshot;
  candidateSchedule?: ScheduleSnapshot;
  diff?: ScheduleDiff;
  policyEvaluation?: PolicyEvaluationResult;
  scoreBreakdown?: Record<string, unknown>;
  fairnessProjection?: Record<string, unknown>;
  rawArtifacts?: Array<{
    type: string;
    data: Record<string, unknown>;
    sourceType?: string;
    sourceId?: string;
    artifactId?: string;
  }>;
  createdAt: string;
  persist?: boolean;
}

export interface ExplanationQueryResult {
  bundle: ExplanationBundle;
}

// ─── Repository Interfaces ───────────────────────────────────

export interface IExplanationRecordRepository {
  insert(records: ExplanationRecord[]): Promise<void>;
  findByTarget(targetType: ExplanationTargetType, targetId: string): Promise<ExplanationRecord[]>;
}

export interface IExplanationSourceArtifactRepository {
  insertSourceRefs(recordId: string, refs: SourceArtifactRef[]): Promise<void>;
  findByRecordId(recordId: string): Promise<SourceArtifactRef[]>;
}
