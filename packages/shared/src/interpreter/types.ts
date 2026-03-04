// ─── ChangeRequest Interpreter Types ──────────────────────────────────
//
// Pure-function interpreter that sits between the API and the solver.
// Zero DB dependencies — all inputs passed as arguments.

import type { RequestType, DisruptionEventType, ParentRole } from '../enums';

// ─── Apply Mode ──────────────────────────────────────────────────────

/**
 * Determines how the system should apply a change request:
 * - AUTO_APPLY_OVERLAY: short disruption, overlay-only locks, no solver needed
 * - PROPOSE_ONLY: generate proposals for user review
 * - REGENERATE_BASE: structural change requiring full base schedule regeneration
 */
export enum ApplyMode {
  AUTO_APPLY_OVERLAY = 'auto_apply_overlay',
  PROPOSE_ONLY = 'propose_only',
  REGENERATE_BASE = 'regenerate_base',
}

// ─── Canonical Change Request ────────────────────────────────────────

export interface CanonicalChangeRequest {
  /** Unique identifier */
  id: string;
  /** Family scope */
  familyId: string;
  /** Which parent is making the request */
  requestingParent: ParentRole;
  /** Type of request */
  requestType: RequestType;
  /** Affected dates (ISO strings, sorted, deduplicated) */
  dates: string[];
  /** Optional: restrict to specific children by ID */
  childScope: string[] | null;
  /** Optional: linked disruption event */
  disruptionEventId: string | null;
  /** Optional: disruption event type (for mode selection) */
  disruptionEventType: DisruptionEventType | null;
  /** Duration in hours of the disruption (if applicable) */
  disruptionDurationHours: number | null;
  /** Whether this is an emergency request */
  isEmergency: boolean;
  /** Whether the other parent has given pre-consent for this type */
  hasPreConsent: boolean;
  /** Effective date (ISO string) — when the change should take effect */
  effectiveDate: string;
  /** Request creation timestamp (ISO string) */
  createdAt: string;
  /** Optional reason note */
  reasonNote: string | null;
}

// ─── Validation ──────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ─── Stability Budget ────────────────────────────────────────────────

export interface StabilityBudgetResult {
  /** Number of changed days in the rolling window */
  changedDaysInWindow: number;
  /** Maximum allowed changed days */
  maxAllowedChanges: number;
  /** Window size in days */
  windowDays: number;
  /** Whether the budget is exceeded */
  budgetExceeded: boolean;
  /** Remaining budget (may be negative if exceeded) */
  remainingBudget: number;
}

// ─── Interpreter Result ──────────────────────────────────────────────

export interface InterpreterResult {
  /** The canonical form of the request */
  canonical: CanonicalChangeRequest;
  /** Validation errors (empty if valid) */
  validationErrors: ValidationError[];
  /** Whether the request passed validation */
  isValid: boolean;
  /** Selected apply mode */
  applyMode: ApplyMode;
  /** Stability budget assessment */
  stabilityBudget: StabilityBudgetResult;
  /** Whether consent is satisfied (emergency, pre-consent, or auto-eligible) */
  consentSatisfied: boolean;
  /** Human-readable reasons for the decisions made */
  reasons: string[];
  /** Overlay lock dates (for AUTO_APPLY_OVERLAY mode) */
  overlayLockDates: string[];
  /** Notice window: effective date computed from buffered hours */
  computedEffectiveDate: string;
  /** Whether the stability window adjusted the effective date */
  stabilityWindowApplied: boolean;
  /** Original effective date before stability window adjustment (null if not adjusted) */
  originalEffectiveDate: string | null;
}
