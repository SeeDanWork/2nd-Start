// ─── Scenario Fixture ─────────────────────────────────────────

export interface ScenarioFixture {
  scenarioId: string;
  label: string;
  description?: string;
  tags: string[];
  seed: ScenarioSeed;
  steps: ScenarioStep[];
  expectations: ScenarioExpectation[];
  metadata?: Record<string, unknown>;
}

// ─── Seed ─────────────────────────────────────────────────────

export interface ScenarioSeed {
  family: {
    id?: string;
    name: string;
  };
  parents: Array<{
    id?: string;
    name: string;
    role?: string;
    email?: string;
  }>;
  children: Array<{
    id?: string;
    name: string;
    birthDate: string;
  }>;
  policies?: Array<{
    ruleType: string;
    priority: string;
    parameters: Record<string, unknown>;
    scope?: {
      scopeType: 'FAMILY' | 'CHILD' | 'DATE_RANGE' | 'CHILD_DATE_RANGE';
      childId?: string;
      dateStart?: string;
      dateEnd?: string;
    };
    label?: string;
  }>;
  initialSchedule?: {
    windowStart: string;
    windowEnd: string;
    nights: Array<{
      date: string;
      childName: string;
      parentName: string;
    }>;
    exchanges?: Array<{
      date: string;
      childName: string;
      fromParentName: string;
      toParentName: string;
      time?: string | null;
      location?: string | null;
    }>;
  };
  fairnessLedger?: Array<{
    parentName: string;
    nightDeviation: number;
    weekendDeviation: number;
    holidayDeviation: number;
  }>;
  calendarEvents?: Array<{
    source: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    allDay?: boolean;
    scopeType: 'PARENT' | 'CHILD' | 'FAMILY';
    parentName?: string;
    childName?: string;
    kind?: string;
    constraintLevel?: string;
  }>;
}

// ─── Steps ────────────────────────────────────────────────────

export interface ScenarioSolveBaselineStep {
  type: 'SOLVE_BASELINE';
  stepId: string;
  windowStart: string;
  windowEnd: string;
  candidateCount?: number;
}

export interface ScenarioApplyOverlayStep {
  type: 'APPLY_OVERLAY';
  stepId: string;
  overlays: Array<{
    childName: string;
    date: string;
    assignedParentName: string;
    disruptionType: string;
    reason?: string;
  }>;
}

export interface ScenarioRunRepairStep {
  type: 'RUN_REPAIR';
  stepId: string;
  repairWindowStart?: string;
  repairWindowEnd?: string;
  candidateCount?: number;
}

export interface ScenarioGenerateProposalsStep {
  type: 'GENERATE_PROPOSALS';
  stepId: string;
  origin: 'BASELINE_SOLVER' | 'REPAIR_SOLVER';
}

export interface ScenarioAcceptProposalStep {
  type: 'ACCEPT_PROPOSAL';
  stepId: string;
  selection: {
    strategy: 'FIRST' | 'BY_ID';
    proposalId?: string;
  };
  acceptedAt: string;
  acceptedByParentName: string;
}

export interface ScenarioRejectProposalStep {
  type: 'REJECT_PROPOSAL';
  stepId: string;
  selection: {
    strategy: 'FIRST' | 'BY_ID';
    proposalId?: string;
  };
  rejectedAt: string;
  rejectedByParentName: string;
  reason?: string;
}

export interface ScenarioIngestCalendarStep {
  type: 'INGEST_CALENDAR';
  stepId: string;
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

export interface ScenarioAppendFairnessAdjustmentStep {
  type: 'APPEND_FAIRNESS_ADJUSTMENT';
  stepId: string;
  effectiveDate: string;
  reason?: string;
  deltas: Array<{
    parentName: string;
    nightDelta: number;
    weekendDelta: number;
    holidayDelta: number;
  }>;
}

export interface ScenarioBuildExplanationStep {
  type: 'BUILD_EXPLANATION';
  stepId: string;
  targetType:
    | 'SCHEDULE_VERSION'
    | 'PROPOSAL'
    | 'REPAIR_RESULT'
    | 'PROPOSAL_ACCEPTANCE'
    | 'CALENDAR_EVENT_CLASSIFICATION';
  targetSelector: {
    strategy: 'LATEST' | 'BY_ID';
    targetId?: string;
  };
  persist?: boolean;
}

export type ScenarioStep =
  | ScenarioSolveBaselineStep
  | ScenarioApplyOverlayStep
  | ScenarioRunRepairStep
  | ScenarioGenerateProposalsStep
  | ScenarioAcceptProposalStep
  | ScenarioRejectProposalStep
  | ScenarioIngestCalendarStep
  | ScenarioAppendFairnessAdjustmentStep
  | ScenarioBuildExplanationStep;

// ─── Expectations ─────────────────────────────────────────────

export interface ActiveScheduleExpectation {
  type: 'ACTIVE_SCHEDULE';
  versionNumber?: number;
  changedNightCount?: number;
  expectedAssignments?: Array<{
    date: string;
    childName: string;
    parentName: string;
  }>;
}

export interface ProposalCountExpectation {
  type: 'PROPOSAL_COUNT';
  pending: number;
  accepted?: number;
  rejected?: number;
  invalidated?: number;
}

export interface FairnessLedgerExpectation {
  type: 'FAIRNESS_LEDGER';
  byParent: Array<{
    parentName: string;
    nightDeviation: number;
    weekendDeviation: number;
    holidayDeviation: number;
  }>;
}

export interface OverlayResolutionExpectation {
  type: 'OVERLAY_RESOLUTION';
  resolvedCount: number;
}

export interface PolicyExpectation {
  type: 'POLICY_EVALUATION';
  hardViolationCount?: number;
  strongViolationCount?: number;
  softViolationCount?: number;
}

export interface CalendarClassificationExpectation {
  type: 'CALENDAR_CLASSIFICATION';
  expected: Array<{
    title: string;
    constraintLevel: string;
    kind?: string;
  }>;
}

export interface ExplanationExpectation {
  type: 'EXPLANATION';
  targetType: string;
  minimumRecordCount?: number;
  requiredCodes?: string[];
}

export interface DeterminismExpectation {
  type: 'DETERMINISM';
  rerunCount: number;
}

export type ScenarioExpectation =
  | ActiveScheduleExpectation
  | ProposalCountExpectation
  | FairnessLedgerExpectation
  | OverlayResolutionExpectation
  | PolicyExpectation
  | CalendarClassificationExpectation
  | ExplanationExpectation
  | DeterminismExpectation;

// ─── Execution Results ────────────────────────────────────────

export interface ScenarioStepResult {
  stepId: string;
  stepType: ScenarioStep['type'];
  status: 'SUCCESS' | 'FAILED';
  outputs: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

export interface ScenarioAssertionResult {
  expectationType: ScenarioExpectation['type'];
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface ScenarioReport {
  scenarioId: string;
  generatedAt: string;
  summary: {
    passed: boolean;
    stepCount: number;
    assertionCount: number;
    passedAssertions: number;
    failedAssertions: number;
  };
  artifacts: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
}

export interface ScenarioExecutionResult {
  scenarioId: string;
  passed: boolean;
  stepResults: ScenarioStepResult[];
  assertionResults: ScenarioAssertionResult[];
  report: ScenarioReport;
}

// ─── Execution Context ───────────────────────────────────────

export interface SeededScenarioContext {
  familyId: string;
  parentIdsByName: Record<string, string>;
  childIdsByName: Record<string, string>;
  activeScheduleVersionId?: string;
}

export interface ScenarioExecutionContext extends SeededScenarioContext {
  /** Active schedule nights — updated after solve/accept steps */
  activeScheduleNights: Array<{ date: string; childId: string; parentId: string }>;
  activeScheduleExchanges: Array<{
    date: string; childId: string; fromParentId: string;
    toParentId: string; time: string; location: string;
  }>;
  /** Window tracking */
  activeWindowStart?: string;
  activeWindowEnd?: string;
  /** Overlay state */
  appliedOverlays: Array<{
    childId: string; date: string; assignedParentId: string;
    disruptionType: string; reason?: string;
  }>;
  /** Proposal tracking */
  proposals: Array<{
    proposalId: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'INVALIDATED';
    origin: string;
    scheduleNights?: Array<{ date: string; childId: string; parentId: string }>;
  }>;
  /** Fairness state */
  fairnessLedger: Record<string, {
    nightDeviation: number;
    weekendDeviation: number;
    holidayDeviation: number;
  }>;
  /** Calendar events ingested */
  calendarEvents: Array<{
    title: string; kind: string; constraintLevel: string;
    date?: string;
  }>;
  /** Explanation tracking */
  explanationBundles: Array<{
    targetType: string; targetId: string;
    recordCount: number; codes: string[];
  }>;
  /** Policy evaluation */
  latestPolicyEvaluation?: {
    hardViolationCount: number;
    strongViolationCount: number;
    softViolationCount: number;
  };
  /** Resolved overlay count */
  resolvedOverlayCount: number;
  /** Version counter */
  scheduleVersionNumber: number;
}
