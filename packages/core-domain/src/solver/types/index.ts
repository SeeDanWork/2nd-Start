import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';
import { PolicyEvaluationResult } from '../../policy/types/evaluation';
import { Child } from '../../models/Child';
import { Parent } from '../../models/Parent';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';

// ── Planning Window ──

export interface PlanningWindow {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

// ── Solver Input ──

export interface SolverInput {
  familyId: string;
  window: PlanningWindow;
  baselineSchedule?: ScheduleSnapshot;
  children: Child[];
  parents: Parent[];
  activePolicies: TypedPolicyRule[];
  fairnessState?: FairnessState;
  fixedHolidayAssignments?: FixedHolidayAssignment[];
  solverConfig: SolverConfig;
}

export interface SolverConfig {
  candidateCount: number;
  primaryMultiplier: number;
  objectiveWeights: ObjectiveWeights;
  deterministicSeed?: string;
}

export interface ObjectiveWeights {
  stability: number;
  familyStructure: number;
  fairness: number;
  parentPreference: number;
  childPreference: number;
  logistics: number;
  convenience: number;
  nightsFairness: number;
  weekendsFairness: number;
  holidaysFairness: number;
}

export interface FairnessState {
  byParentId: Record<string, {
    nightDeviation: number;
    weekendDeviation: number;
    holidayDeviation: number;
  }>;
}

export interface FixedHolidayAssignment {
  label: string;
  date: string;     // YYYY-MM-DD
  childIds: string[];
  assignedParentId: string;
}

// ── Normalized Solver Input ──

export interface DayInfo {
  date: string;     // YYYY-MM-DD
  index: number;    // 0-based position in window
  weekday: number;  // Luxon weekday: 1=Mon..7=Sun
  isWeekend: boolean;
  isHoliday: boolean;
  holidayLabel?: string;
}

export interface NormalizedSolverInput {
  familyId: string;
  window: PlanningWindow;
  days: DayInfo[];
  parentIds: string[];
  childIds: string[];
  parents: Parent[];
  children: Child[];
  activePolicies: TypedPolicyRule[];
  fairnessState: FairnessState;
  baselineNightLookup: Map<string, string>; // "date:childId" -> parentId
  baselineExchangeLookup: Set<string>;       // "date:childId"
  fixedAssignments: Map<string, string>;     // "date:childId" -> parentId
  holidayDateSet: Set<string>;
  config: SolverConfig;
}

// ── Candidate Types ──

export interface CandidateNight {
  date: string;
  childId: string;
  parentId: string;
}

export interface CandidateExchange {
  date: string;
  childId: string;
  fromParentId: string;
  toParentId: string;
  time: string | null;
  location: string | null;
}

export interface SolverScore {
  total: number;
  primaryScore: number;
  secondaryScore: number;
  breakdown: SolverScoreBreakdown;
}

export interface SolverScoreBreakdown {
  stability: number;
  familyStructure: number;
  fairness: {
    total: number;
    nights: number;
    weekends: number;
    holidays: number;
  };
  parentPreference: number;
  childPreference: number;
  logistics: number;
  convenience: number;
  penalties: number;
}

export interface SolverCandidateMetadata {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  baselineScheduleVersionId?: string;
  weightProfileId: string;
}

export interface SolverCandidate {
  candidateId: string;
  nights: CandidateNight[];
  exchanges: CandidateExchange[];
  score: SolverScore;
  policyEvaluation: PolicyEvaluationResult;
  metadata: SolverCandidateMetadata;
}

// ── Solver Result ──

export interface SolverArtifact {
  type: string;
  data: Record<string, unknown>;
}

export interface SolverResult {
  candidates: SolverCandidate[];
  selectedCandidateId?: string;
  artifacts: SolverArtifact[];
}

// ── Model Types ──

/** Variable representing assignment of a parent to a child on a date */
export interface AssignmentVariable {
  date: string;
  childId: string;
  parentId: string;
  index: number; // unique variable index
}

export interface BuiltScheduleModel {
  variables: AssignmentVariable[];
  /** Map from "date:childId" -> list of variable indices (one per parent) */
  variablesBySlot: Map<string, number[]>;
  /** Map from variable index -> AssignmentVariable */
  variableByIndex: Map<number, AssignmentVariable>;
  /** Fixed variable indices (must be 1) */
  fixedVariables: Set<number>;
  /** Number of total binary variables */
  variableCount: number;
}

// ── Availability (placeholder) ──

export interface UnavailableAssignment {
  date: string;
  childId: string;
  parentId: string;
}

export interface AvailabilityConstraintProvider {
  getUnavailableAssignments(
    familyId: string,
    parentIds: string[],
    childIds: string[],
    window: PlanningWindow,
  ): UnavailableAssignment[];
}

// ── Weight Profile for candidate generation ──

export interface WeightProfile {
  id: string;
  label: string;
  weights: ObjectiveWeights;
}
