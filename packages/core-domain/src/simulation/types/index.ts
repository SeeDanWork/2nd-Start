import type { ScenarioFixture } from '../../scenarios/types';

// ─── Simulation Fixture ───────────────────────────────────────

export interface SimulationFixture {
  simulationId: string;
  label: string;
  description?: string;
  seedScenario: ScenarioFixture;
  config: SimulationConfig;
  personas: SimulationPersonaAssignment[];
  eventPolicies: SimulationEventPolicy[];
  expectations?: SimulationExpectation[];
  metadata?: Record<string, unknown>;
}

export interface SimulationConfig {
  startDate: string;
  endDate: string;
  stepGranularity: 'DAY';
  deterministicSeed: string;
  maxEventsPerStep?: number;
  enableBaselineSolveAtStart: boolean;
  enableRepairOnOverlay: boolean;
  enableProposalGeneration: boolean;
  autoAcceptStrategy?: 'NONE' | 'FIRST' | 'BEST_SCORE';
}

export type SimulationPersonaType =
  | 'STRUCTURED_CO_PARENT'
  | 'HIGH_CONFLICT'
  | 'LOGISTICS_HEAVY'
  | 'FLEXIBLE_CO_PARENT';

export interface SimulationPersonaAssignment {
  parentName: string;
  personaType: SimulationPersonaType;
  parameters?: Record<string, unknown>;
}

export interface SimulationEventPolicy {
  policyType:
    | 'DISRUPTION_GENERATION'
    | 'SWAP_REQUEST_GENERATION'
    | 'CALENDAR_EVENT_GENERATION'
    | 'FAIRNESS_ADJUSTMENT_GENERATION';
  enabled: boolean;
  parameters?: Record<string, unknown>;
}

// ─── Simulation Steps ─────────────────────────────────────────

export interface SimulationStep {
  stepIndex: number;
  date: string;
}

// ─── Generated Events ─────────────────────────────────────────

export interface SimulationOverlayEvent {
  type: 'OVERLAY';
  date: string;
  childName: string;
  assignedParentName: string;
  disruptionType: string;
  reason?: string;
}

export interface SimulationSwapIntentEvent {
  type: 'SWAP_INTENT';
  date: string;
  senderParentName: string;
  targetDate?: string;
  reason?: string;
}

export interface SimulationCalendarImportEvent {
  type: 'CALENDAR_IMPORT';
  date: string;
  events: Array<{
    source: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    allDay?: boolean;
    scopeType?: 'PARENT' | 'CHILD' | 'FAMILY';
    parentName?: string;
    childName?: string;
  }>;
}

export interface SimulationFairnessAdjustmentEvent {
  type: 'FAIRNESS_ADJUSTMENT';
  effectiveDate: string;
  deltas: Array<{
    parentName: string;
    nightDelta: number;
    weekendDelta: number;
    holidayDelta: number;
  }>;
  reason?: string;
}

export type SimulationGeneratedEvent =
  | SimulationOverlayEvent
  | SimulationSwapIntentEvent
  | SimulationCalendarImportEvent
  | SimulationFairnessAdjustmentEvent;

// ─── Metrics ──────────────────────────────────────────────────

export interface SimulationMetricSnapshot {
  date: string;
  scheduleChurnRate: number;
  averageTransitionCount: number;
  fairnessDeviationMagnitude: number;
  siblingDivergenceRate: number;
  disruptionRecoveryOpenCount: number;
  pendingProposalCount: number;
}

export interface SimulationAggregateMetrics {
  maxScheduleChurnRate: number;
  averageScheduleChurnRate: number;
  maxTransitionCount: number;
  averageTransitionCount: number;
  maxFairnessDeviationMagnitude: number;
  finalFairnessDeviationMagnitude: number;
  maxSiblingDivergenceRate: number;
  averagePendingProposalCount: number;
}

// ─── Expectations ─────────────────────────────────────────────

export interface SimulationDeterminismExpectation {
  type: 'DETERMINISM';
  rerunCount: number;
}

export interface SimulationMetricBoundExpectation {
  type: 'METRIC_BOUND';
  metric:
    | 'scheduleChurnRate'
    | 'averageTransitionCount'
    | 'fairnessDeviationMagnitude'
    | 'siblingDivergenceRate'
    | 'disruptionRecoveryOpenCount'
    | 'pendingProposalCount';
  operator: 'LTE' | 'GTE';
  value: number;
}

export interface SimulationFairnessConvergenceExpectation {
  type: 'FAIRNESS_CONVERGENCE';
  finalDeviationLTE: number;
}

export interface SimulationCalmnessExpectation {
  type: 'CALMNESS';
  maxChurnRate: number;
  maxAverageTransitions: number;
}

export type SimulationExpectation =
  | SimulationDeterminismExpectation
  | SimulationMetricBoundExpectation
  | SimulationFairnessConvergenceExpectation
  | SimulationCalmnessExpectation;

// ─── Execution Results ────────────────────────────────────────

export interface SimulationStepResult {
  stepIndex: number;
  date: string;
  generatedEvents: SimulationGeneratedEvent[];
  outputs: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILED';
  error?: {
    code: string;
    message: string;
  };
}

export interface SimulationAssertionResult {
  expectationType: SimulationExpectation['type'];
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface SimulationReport {
  simulationId: string;
  generatedAt: string;
  summary: {
    passed: boolean;
    stepCount: number;
    metricSnapshotCount: number;
    assertionCount: number;
    passedAssertions: number;
    failedAssertions: number;
  };
  aggregates: SimulationAggregateMetrics;
  artifacts: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
}

export interface SimulationExecutionResult {
  simulationId: string;
  passed: boolean;
  stepResults: SimulationStepResult[];
  metricSnapshots: SimulationMetricSnapshot[];
  assertionResults: SimulationAssertionResult[];
  report: SimulationReport;
}

// ─── Context ──────────────────────────────────────────────────

export interface SimulationFamilyContext {
  familyId: string;
  parentIdsByName: Record<string, string>;
  childIdsByName: Record<string, string>;
  activeScheduleVersionId?: string;
}

export interface SimulationExecutionContext extends SimulationFamilyContext {
  activeScheduleNights: Array<{ date: string; childId: string; parentId: string }>;
  activeScheduleExchanges: Array<{
    date: string; childId: string; fromParentId: string;
    toParentId: string; time: string; location: string;
  }>;
  activeWindowStart?: string;
  activeWindowEnd?: string;
  appliedOverlays: Array<{
    childId: string; date: string; assignedParentId: string;
    disruptionType: string; reason?: string;
  }>;
  proposals: Array<{
    proposalId: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'INVALIDATED';
    origin: string;
    scheduleNights?: Array<{ date: string; childId: string; parentId: string }>;
  }>;
  fairnessLedger: Record<string, {
    nightDeviation: number;
    weekendDeviation: number;
    holidayDeviation: number;
  }>;
  calendarEvents: Array<{
    title: string; kind: string; constraintLevel: string; date?: string;
  }>;
  resolvedOverlayCount: number;
  scheduleVersionNumber: number;
  /** Previous step's schedule for churn calculation */
  previousScheduleNights?: Array<{ date: string; childId: string; parentId: string }>;
  /** Cumulative churn count */
  totalChurnedNights: number;
  totalStepsWithSchedule: number;
  /** Latest solver results for inspection */
  latestBaselineSolverResult?: unknown;
  latestRepairResult?: unknown;
  latestGeneratedProposalIds?: string[];
  latestAcceptedProposalId?: string;
}

// ─── Persona Interface ────────────────────────────────────────

export interface SimulationPersona {
  personaType: SimulationPersonaType;
  generateEvents(input: {
    date: string;
    deterministicSeed: string;
    familyContext: SimulationFamilyContext;
    personaAssignment: SimulationPersonaAssignment;
  }): SimulationGeneratedEvent[];
}
