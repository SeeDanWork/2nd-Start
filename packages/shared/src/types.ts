import {
  ParentRole,
  MemberRole,
  InviteStatus,
  FamilyStatus,
  WeekendDefinition,
  ConstraintType,
  ConstraintHardness,
  ConstraintOwner,
  HandoffType,
  LocationType,
  RequestType,
  RequestStatus,
  RequestUrgency,
  ReasonTag,
  AcceptanceType,
  SolverStatus,
  ScheduleSource,
  AssignmentSource,
  LedgerWindowType,
  AuditAction,
  AuditEntityType,
  ShareLinkScope,
  ShareLinkFormat,
  NotificationType,
  ConsentRuleType,
  EmergencyModeStatus,
  MessageIntent,
} from './enums';

// ─── Core Entities ──────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  notificationPreferences: NotificationPreferences;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  reminderHoursBefore: number;
}

export interface Family {
  id: string;
  name: string | null;
  timezone: string;
  weekendDefinition: WeekendDefinition;
  fairnessBand: FairnessBandConfig;
  changeBudget: ChangeBudgetConfig;
  status: FamilyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FairnessBandConfig {
  maxOvernightDelta: number;
  windowWeeks: number;
}

export interface ChangeBudgetConfig {
  maxPerMonth: number;
}

export interface FamilyMembership {
  id: string;
  familyId: string;
  userId: string;
  role: MemberRole;
  label: string;
  inviteStatus: InviteStatus;
  invitedAt: string | null;
  acceptedAt: string | null;
}

export interface Child {
  id: string;
  familyId: string;
  firstName: string;
  dateOfBirth: string | null;
  schoolName: string | null;
  createdAt: string;
}

export interface HandoffLocation {
  id: string;
  familyId: string;
  name: string;
  type: LocationType;
  address: string | null;
  isDefault: boolean;
  availableWindows: AvailableWindow[];
  createdAt: string;
}

export interface AvailableWindow {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  start: string;     // "HH:mm"
  end: string;       // "HH:mm"
}

// ─── Constraints ────────────────────────────────────────────

export interface ConstraintSet {
  id: string;
  familyId: string;
  version: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface Constraint {
  id: string;
  constraintSetId: string;
  type: ConstraintType;
  hardness: ConstraintHardness;
  weight: number;
  owner: ConstraintOwner;
  recurrence: RecurrencePattern | null;
  dateRange: DateRange | null;
  parameters: ConstraintParameters;
  createdAt: string;
}

export interface RecurrencePattern {
  daysOfWeek: number[];
  parent: ParentRole;
}

export interface DateRange {
  start: string; // ISO date
  end: string;
}

export type ConstraintParameters =
  | LockedNightParams
  | MaxConsecutiveParams
  | MinConsecutiveParams
  | WeekendSplitParams
  | MaxTransitionsParams
  | DaycareExchangeOnlyParams
  | NoSchoolNightTransitionParams
  | HandoffLocationPreferenceParams;

export interface LockedNightParams {
  parent: ParentRole;
  daysOfWeek: number[];
}

export interface MaxConsecutiveParams {
  parent: ParentRole;
  maxNights: number;
}

export interface MinConsecutiveParams {
  parent: ParentRole;
  minNights: number;
}

export interface WeekendSplitParams {
  targetPctParentA: number;
  tolerancePct: number;
}

export interface MaxTransitionsParams {
  perWeek: number;
}

export interface DaycareExchangeOnlyParams {
  enabled: boolean;
}

export interface NoSchoolNightTransitionParams {
  enabled: boolean;
}

export interface HandoffLocationPreferenceParams {
  preferredLocationId: string;
}

export interface HolidayCalendar {
  id: string;
  familyId: string;
  name: string;
  entries: HolidayEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface HolidayEntry {
  date: string;
  label: string;
  daycareClosed: boolean;
}

// ─── Schedules ──────────────────────────────────────────────

export interface BaseScheduleVersion {
  id: string;
  familyId: string;
  version: number;
  constraintSetVersion: number;
  horizonStart: string;
  horizonEnd: string;
  solverStatus: SolverStatus;
  solverMetadata: SolverMetadata | null;
  createdBy: ScheduleSource;
  sourceProposalOptionId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface SolverMetadata {
  solveTimeMs: number;
  gap: number;
  solutionsFound: number;
  objectiveValue: number;
}

export interface OvernightAssignment {
  id: string;
  scheduleVersionId: string;
  familyId: string;
  date: string;
  assignedTo: ParentRole;
  isTransition: boolean;
  source: AssignmentSource;
}

export interface HandoffEvent {
  id: string;
  scheduleVersionId: string;
  familyId: string;
  date: string;
  type: HandoffType;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  locationId: string | null;
  fromParent: ParentRole;
  toParent: ParentRole;
  notes: string | null;
}

// ─── Requests & Proposals ───────────────────────────────────

export interface Request {
  id: string;
  familyId: string;
  requestedBy: string;
  type: RequestType;
  status: RequestStatus;
  dates: string[];
  reasonTag: ReasonTag | null;
  reasonNote: string | null;
  urgency: RequestUrgency;
  changeBudgetDebit: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalBundle {
  id: string;
  requestId: string;
  familyId: string;
  solverRunId: string | null;
  generationParams: ProposalGenerationParams | null;
  expiresAt: string;
  createdAt: string;
  options: ProposalOption[];
}

export interface ProposalGenerationParams {
  horizonWeeks: number;
  maxSolutions: number;
  timeoutMs: number;
}

export interface ProposalOption {
  id: string;
  bundleId: string;
  rank: number;
  label: string | null;
  calendarDiff: CalendarDiffEntry[];
  fairnessImpact: FairnessImpact;
  stabilityImpact: StabilityImpact;
  handoffImpact: HandoffImpact;
  penaltyScore: number;
  isAutoApprovable: boolean;
}

export interface CalendarDiffEntry {
  date: string;
  oldParent: ParentRole;
  newParent: ParentRole;
}

export interface FairnessImpact {
  overnightDelta: number;
  weekendDelta: number;
  windowWeeks: number;
}

export interface StabilityImpact {
  transitionsDelta: number;
  maxStreakChange: number;
  schoolNightChanges: number;
}

export interface HandoffImpact {
  newHandoffs: number;
  removedHandoffs: number;
  nonDaycareHandoffs: number;
}

export interface Acceptance {
  id: string;
  proposalOptionId: string;
  acceptedBy: string;
  acceptanceType: AcceptanceType;
  resultingVersionId: string;
  counterBundleId: string | null;
  createdAt: string;
}

// ─── Guardrails ─────────────────────────────────────────────

export interface PreConsentRule {
  id: string;
  familyId: string;
  createdBy: string;
  ruleType: ConsentRuleType;
  threshold: ConsentThreshold;
  isActive: boolean;
  createdAt: string;
}

export type ConsentThreshold =
  | { maxOvernightDelta: number }
  | { maxAdditional: number }
  | { autoApproveTypes: RequestType[] };

export interface ChangeBudgetStatus {
  userId: string;
  month: string;
  budgetLimit: number;
  used: number;
  remaining: number;
}

export interface EmergencyMode {
  id: string;
  familyId: string;
  activatedBy: string;
  activatedAt: string;
  returnToBaselineAt: string;
  relaxedConstraints: RelaxedConstraint[];
  status: EmergencyModeStatus;
  returnedAt: string | null;
}

export interface RelaxedConstraint {
  constraintId: string;
  originalValue: Record<string, unknown>;
}

// ─── Metrics ────────────────────────────────────────────────

export interface LedgerSnapshot {
  id: string;
  familyId: string;
  scheduleVersionId: string;
  windowType: LedgerWindowType;
  windowStart: string;
  windowEnd: string;
  parentAOvernights: number;
  parentBOvernights: number;
  parentAWeekendNights: number;
  parentBWeekendNights: number;
  withinFairnessBand: boolean;
  computedAt: string;
}

export interface StabilitySnapshot {
  id: string;
  familyId: string;
  scheduleVersionId: string;
  windowStart: string;
  windowEnd: string;
  transitionsPerWeek: number;
  maxConsecutiveA: number;
  maxConsecutiveB: number;
  schoolNightConsistencyPct: number;
  weekendFragmentationCount: number;
  computedAt: string;
}

export interface AuditLogEntry {
  id: string;
  familyId: string;
  actorId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Sharing ────────────────────────────────────────────────

export interface ShareLink {
  id: string;
  familyId: string;
  createdBy: string;
  token: string;
  scope: ShareLinkScope;
  label: string | null;
  format: ShareLinkFormat;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// ─── Composite / API Responses ──────────────────────────────

export interface TodayCard {
  tonightAssignment: OvernightAssignment | null;
  nextHandoff: HandoffEvent | null;
  fairness: {
    windowWeeks: number;
    parentANights: number;
    parentBNights: number;
    withinBand: boolean;
  } | null;
  stability: {
    transitionsThisWeek: number;
    maxTransitionsPerWeek: number;
  } | null;
  pendingRequestsCount: number;
}

export interface CalendarDay {
  date: string;
  assignment: OvernightAssignment | null;
  handoffs: HandoffEvent[];
  holidayLabel: string | null;
  daycareClosed: boolean;
}

export interface CalendarResponse {
  days: CalendarDay[];
  scheduleVersion: number;
}

export interface MonthlySummary {
  month: string;
  parentAOvernights: number;
  parentBOvernights: number;
  parentAWeekendNights: number;
  parentBWeekendNights: number;
  totalTransitions: number;
  requestsMade: number;
  requestsAccepted: number;
  requestsExpired: number;
  scheduleVersionsCreated: number;
}

// ─── Messaging ──────────────────────────────────────────────

export interface ParsedIntent {
  intent: MessageIntent;
  confidence: number;
  entities: Record<string, string>;
  rawText: string;
}
