// ─── Disruption Overlay Types ──────────────────────────────────────────
//
// Shared type interfaces for disruption events, overlay policies,
// policy decision records, and overlay computation results.

import {
  DisruptionEventType,
  type DisruptionScope,
  type DisruptionSource,
  type OverrideStrength,
  type OverlayActionType,
  type PolicySource,
} from '../enums';

// ─── Core Interfaces ──────────────────────────────────────────────────

export interface DisruptionEvent {
  id: string;
  familyId: string;
  type: DisruptionEventType;
  scope: DisruptionScope;
  source: DisruptionSource;
  overrideStrength: OverrideStrength;
  startDate: string;  // ISO date
  endDate: string;    // ISO date
  metadata: Record<string, unknown>;
  reportedBy: string | null;
  resolvedAt: string | null;
}

export interface OverlayPolicy {
  id: string;
  familyId: string | null;  // null = global default
  appliesToEventType: DisruptionEventType;
  actionType: OverlayActionType;
  defaultStrength: OverrideStrength;
  promptingRules: PromptingRules;
  fairnessAccounting: FairnessAccounting;
  source: PolicySource;
  isActive: boolean;
}

export interface PolicyDecisionRecord {
  id: string;
  familyId: string;
  disruptionEventId: string;
  policyId: string;
  actionTaken: OverlayActionType;
  accepted: boolean | null;
  decidedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── Prompting & Fairness ─────────────────────────────────────────────

export interface PromptingRules {
  /** Lead time in hours before prompting user */
  leadTimeHours: number;
  /** Whether to suppress the prompt entirely (auto-apply) */
  suppressPrompt: boolean;
  /** Maximum number of auto-applications before re-prompting */
  maxAutoApply: number;
}

export interface FairnessAccounting {
  /** Whether this event's days count toward fairness ledger */
  countsTowardFairness: boolean;
  /** If true, create compensatory days after disruption ends */
  createCompensatory: boolean;
  /** Max compensatory days allowed */
  maxCompensatoryDays: number;
}

// ─── Overlay Computation Result ───────────────────────────────────────

export interface OverlayLock {
  date: string;
  assignedTo: string;    // 'parent_a' | 'parent_b'
  reason: string;
}

export interface LogisticsAdjustment {
  date: string;
  originalLocation: string;
  newLocation: string;
  reason: string;
}

export interface WeightAdjustment {
  key: string;           // solver weight key
  multiplier: number;    // 1.0 = no change, >1 = increase penalty
  reason: string;
  date?: string;         // optional: per-date adjustment (e.g. Rule C night-before)
}

export interface DisruptionOverlayResult {
  eventId: string;
  eventType: DisruptionEventType;
  actionTaken: OverlayActionType;
  locks: OverlayLock[];
  logisticsAdjustments: LogisticsAdjustment[];
  weightAdjustments: WeightAdjustment[];
  reasons: string[];
  requiresProposal: boolean;
  compensatoryDays: string[];
}

// ─── Disruption Categories ───────────────────────────────────────────

export type DisruptionCategory =
  | 'health'
  | 'work'
  | 'school'
  | 'travel'
  | 'environment'
  | 'logistics'
  | 'other';

/**
 * Maps every disruption event type to one of 7 semantic categories.
 * Used for grouping in UI, reporting, and policy resolution heuristics.
 */
export const DISRUPTION_CATEGORIES: Record<DisruptionEventType, DisruptionCategory> = {
  // Health
  [DisruptionEventType.CHILD_SICK]: 'health',
  [DisruptionEventType.CAREGIVER_SICK]: 'health',
  [DisruptionEventType.HOSPITALIZATION]: 'health',
  // Work
  [DisruptionEventType.PARENT_TRAVEL]: 'work',
  [DisruptionEventType.WORK_SHIFT_CHANGE]: 'work',
  [DisruptionEventType.EMERGENCY_WORK_CALL]: 'work',
  // School
  [DisruptionEventType.SCHOOL_CLOSED]: 'school',
  [DisruptionEventType.SCHOOL_HALF_DAY]: 'school',
  [DisruptionEventType.SCHOOL_TRIP]: 'school',
  [DisruptionEventType.CAMP_WEEK]: 'school',
  // Travel
  [DisruptionEventType.HOLIDAY_TRAVEL]: 'travel',
  [DisruptionEventType.FLIGHT_DELAY]: 'travel',
  // Environment
  [DisruptionEventType.WEATHER_EMERGENCY]: 'environment',
  [DisruptionEventType.POWER_OUTAGE]: 'environment',
  [DisruptionEventType.EMERGENCY_CLOSURE]: 'environment',
  // Logistics
  [DisruptionEventType.PUBLIC_HOLIDAY]: 'logistics',
  [DisruptionEventType.TRANSPORT_FAILURE]: 'logistics',
  [DisruptionEventType.HOME_REPAIR]: 'logistics',
  // Other
  [DisruptionEventType.FAMILY_EVENT]: 'other',
  [DisruptionEventType.BREAK]: 'other',
  [DisruptionEventType.SUMMER_PERIOD]: 'other',
  [DisruptionEventType.FUNERAL]: 'other',
  [DisruptionEventType.OTHER_DECLARED]: 'other',
};

// ─── Solver Payload Types ─────────────────────────────────────────────

export interface SolverLockedNight {
  parent: string;
  date: string;
  source: 'disruption';
}

export interface SolverPayloadOverlay {
  disruption_locks: SolverLockedNight[];
  weight_adjustments: Record<string, number>;
  disruption_context: Array<{
    event_id: string;
    event_type: string;
    action: string;
    dates: string[];
  }>;
}
