// ─── Main Interpreter Orchestrator ────────────────────────────────────
//
// Orchestrates: canonicalize → validate → stability budget → apply mode → consent
// Pure function — no DB, no side effects.

import { canonicalize, type RawChangeRequestInput } from './canonicalize';
import { validateChangeRequest } from './validate';
import { selectApplyMode } from './apply_mode';
import { checkConsent } from './consent';
import { computeStabilityBudget, type AssignmentRecord } from './stability_budget';
import { enforceStabilityWindow } from './stability_window';
import { ApplyMode, type InterpreterResult, type StabilityBudgetResult } from './types';

export interface InterpretInput {
  /** Raw change request from API */
  rawRequest: RawChangeRequestInput;
  /** Assignments from the previous schedule version (for budget computation) */
  previousAssignments: AssignmentRecord[];
  /** Assignments from the current active schedule */
  currentAssignments: AssignmentRecord[];
  /** Reference date for stability window (defaults to request createdAt) */
  referenceDate?: string;
}

/**
 * Main entry point: interpret a change request into a deterministic result.
 *
 * Flow:
 * 1. Canonicalize the raw request (sort dates, dedup, resolve parent, buffer)
 * 2. Validate per request type
 * 3. Compute stability budget (rolling 28-day window)
 * 4. Select apply mode (auto-overlay / propose-only / regenerate-base)
 * 5. Check consent (emergency / pre-consent / requires approval)
 * 6. Compute overlay lock dates (for auto-apply mode)
 */
export function interpretChangeRequest(input: InterpretInput): InterpreterResult {
  const { rawRequest, previousAssignments, currentAssignments } = input;
  const referenceDate = input.referenceDate ?? rawRequest.createdAt;

  // 1. Canonicalize
  const canonical = canonicalize(rawRequest);

  // 2. Validate
  const validationErrors = validateChangeRequest(canonical);
  const isValid = validationErrors.length === 0;

  // 3. Stability budget
  const stabilityBudget: StabilityBudgetResult = computeStabilityBudget(
    previousAssignments,
    currentAssignments,
    referenceDate,
  );

  // 4. Apply mode
  const applyMode = isValid
    ? selectApplyMode(canonical, stabilityBudget)
    : ApplyMode.PROPOSE_ONLY;

  // 5. Consent
  const consentResult = checkConsent(canonical, applyMode, stabilityBudget);

  // 6. Stability window enforcement
  const stabilityResult = enforceStabilityWindow(canonical, applyMode, referenceDate);
  let computedEffectiveDate = canonical.effectiveDate;
  const stabilityWindowApplied = stabilityResult.wasAdjusted;
  const originalEffectiveDate = stabilityResult.wasAdjusted ? stabilityResult.originalDate : null;
  if (stabilityResult.wasAdjusted) {
    computedEffectiveDate = stabilityResult.adjustedEffectiveDate;
  }

  // 7. Overlay lock dates (only meaningful for AUTO_APPLY_OVERLAY)
  const overlayLockDates = applyMode === ApplyMode.AUTO_APPLY_OVERLAY
    ? canonical.dates
    : [];

  // 8. Collect reasons
  const reasons: string[] = [...consentResult.reasons];
  if (stabilityBudget.budgetExceeded) {
    reasons.push(
      `Stability budget exceeded: ${stabilityBudget.changedDaysInWindow}/${stabilityBudget.maxAllowedChanges} changed days in ${stabilityBudget.windowDays}-day window`,
    );
  }
  if (applyMode === ApplyMode.AUTO_APPLY_OVERLAY) {
    reasons.push('Short disruption eligible for auto-apply overlay');
  }
  if (applyMode === ApplyMode.REGENERATE_BASE) {
    reasons.push('Structural change requires base schedule regeneration');
  }
  if (stabilityResult.wasAdjusted && stabilityResult.reason) {
    reasons.push(stabilityResult.reason);
  }

  return {
    canonical,
    validationErrors,
    isValid,
    applyMode,
    stabilityBudget,
    consentSatisfied: consentResult.satisfied,
    reasons,
    overlayLockDates,
    computedEffectiveDate,
    stabilityWindowApplied,
    originalEffectiveDate,
  };
}
