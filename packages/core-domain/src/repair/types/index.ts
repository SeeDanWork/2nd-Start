import { DisruptionType } from '../../enums/DisruptionType';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';
import { PolicyEvaluationResult } from '../../policy/types/evaluation';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { FairnessState, FixedHolidayAssignment, DayInfo } from '../../solver/types';
import { Parent } from '../../models/Parent';
import { Child } from '../../models/Child';

// ── Repair Window ──

export interface RepairWindow {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

// ── Disruption Overlay ──

export interface DisruptionOverlaySnapshot {
  overlayId: string;
  scheduleVersionId: string;
  childId: string;
  date: string;     // YYYY-MM-DD
  assignedParentId: string;
  type: DisruptionType;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ── Overlay Application ──

export interface AppliedOverlayResult {
  overlaidSchedule: ScheduleSnapshot;
  overlayImpacts: OverlayImpact[];
}

export interface OverlayImpact {
  overlayId: string;
  childId: string;
  date: string;
  fromParentId: string;
  toParentId: string;
  type: DisruptionType;
}

// ── Fairness Drift ──

export interface FairnessDriftRecord {
  parentId: string;
  nightDelta: number;
  weekendDelta: number;
  holidayDelta: number;
  sourceOverlayIds: string[];
}

export interface FairnessDriftSummary {
  byParentId: Record<string, {
    nightDelta: number;
    weekendDelta: number;
    holidayDelta: number;
  }>;
}

// ── Restitution ──

export interface RestitutionTarget {
  date: string;
  childId: string;
  fromParentId: string;
  toParentId: string;
  priority: number;
  reason: string;
}

// ── Repair Input ──

export interface RepairInput {
  familyId: string;
  activeSchedule: ScheduleSnapshot;
  disruptionOverlays: DisruptionOverlaySnapshot[];
  repairWindow?: RepairWindow;
  activePolicies: TypedPolicyRule[];
  fairnessState?: FairnessState;
  fixedHolidayAssignments?: FixedHolidayAssignment[];
  parents: Parent[];
  children: Child[];
  solverConfig: RepairSolverConfig;
}

export interface RepairSolverConfig {
  candidateCount: number;
  primaryMultiplier: number;
  maxRepairDays: number;
  maxChangedNightsFromBaseline?: number;
  objectiveWeights: RepairObjectiveWeights;
}

export interface RepairObjectiveWeights {
  stability: number;
  familyStructure: number;
  fairnessRestitution: number;
  nearTermCalmness: number;
  parentPreference: number;
  childPreference: number;
  logistics: number;
  convenience: number;
}

// ── Normalized Repair Input ──

export interface NormalizedRepairInput {
  familyId: string;
  activeSchedule: ScheduleSnapshot;
  overlaidSchedule: ScheduleSnapshot;
  overlayImpacts: OverlayImpact[];
  repairWindow: RepairWindow;
  days: DayInfo[];
  parentIds: string[];
  childIds: string[];
  parents: Parent[];
  children: Child[];
  activePolicies: TypedPolicyRule[];
  fairnessState: FairnessState;
  driftSummary: FairnessDriftSummary;
  /** Map "date:childId" -> parentId from active schedule */
  activeNightLookup: Map<string, string>;
  /** Map "date:childId" -> parentId from overlaid schedule */
  overlaidNightLookup: Map<string, string>;
  /** Set of "date:childId" keys that are overlay-fixed */
  overlayFixedSlots: Set<string>;
  fixedHolidayAssignments: Map<string, string>;
  holidayDateSet: Set<string>;
  config: RepairSolverConfig;
}

// ── Repair Candidate ──

export interface RepairScore {
  total: number;
  primaryScore: number;
  secondaryScore: number;
  breakdown: RepairScoreBreakdown;
}

export interface RepairScoreBreakdown {
  stability: number;
  familyStructure: number;
  fairnessRestitution: number;
  nearTermCalmness: number;
  parentPreference: number;
  childPreference: number;
  logistics: number;
  convenience: number;
  penalties: number;
  changedNightCount: number;
  changedExchangeCount: number;
  restitutionNightCount: number;
}

export interface RepairCandidateMetadata {
  generatedAt: string;
  repairWindowStart: string;
  repairWindowEnd: string;
  baseScheduleVersionId: string;
  overlayIds: string[];
}

export interface RepairCandidate {
  candidateId: string;
  repairedSchedule: ScheduleSnapshot;
  score: RepairScore;
  policyEvaluation: PolicyEvaluationResult;
  fairnessDrift: FairnessDriftSummary;
  metadata: RepairCandidateMetadata;
}

// ── Repair Result ──

export interface RepairArtifact {
  type: string;
  data: Record<string, unknown>;
}

export interface RepairResult {
  overlaidSchedule: ScheduleSnapshot;
  candidates: RepairCandidate[];
  selectedCandidateId?: string;
  driftSummary: FairnessDriftSummary;
  artifacts: RepairArtifact[];
}

// ── Repair Model ──

export interface RepairAssignmentVariable {
  date: string;
  childId: string;
  parentId: string;
  index: number;
}

export interface BuiltRepairModel {
  variables: RepairAssignmentVariable[];
  variablesBySlot: Map<string, number[]>;
  variableByIndex: Map<number, RepairAssignmentVariable>;
  fixedVariables: Set<number>;
  overlayFixedVariables: Set<number>;
  variableCount: number;
}

// ── Weight Profile ──

export interface RepairWeightProfile {
  id: string;
  label: string;
  weights: RepairObjectiveWeights;
}
