// ─── Apply Mode Selection ─────────────────────────────────────────────
//
// Determines how a change request should be applied:
// - AUTO_APPLY_OVERLAY: short disruption, overlay-only, no solver needed
// - PROPOSE_ONLY: generate proposals for user review
// - REGENERATE_BASE: structural change requiring full regen

import { RequestType } from '../enums';
import { SHORT_DISRUPTION_THRESHOLD_HOURS } from '../constants';
import { ApplyMode, type CanonicalChangeRequest, type StabilityBudgetResult } from './types';

/**
 * Select the apply mode for a canonical change request.
 *
 * Logic:
 * 1. Disruption + duration ≤ 72h + overlay-only locks → AUTO_APPLY_OVERLAY
 * 2. Disruption + duration > 72h → PROPOSE_ONLY
 * 3. Structural changes (bonus_week) → REGENERATE_BASE
 * 4. Stability budget exceeded → REGENERATE_BASE
 * 5. Everything else → PROPOSE_ONLY
 */
export function selectApplyMode(
  req: CanonicalChangeRequest,
  stabilityBudget: StabilityBudgetResult,
): ApplyMode {
  // Structural changes always require full regeneration
  if (req.requestType === RequestType.BONUS_WEEK) {
    return ApplyMode.REGENERATE_BASE;
  }

  // Stability budget exceeded → full regen to rebalance
  if (stabilityBudget.budgetExceeded) {
    return ApplyMode.REGENERATE_BASE;
  }

  // Disruption-linked requests: decide by duration
  if (req.disruptionEventId && req.disruptionDurationHours !== null) {
    if (req.disruptionDurationHours <= SHORT_DISRUPTION_THRESHOLD_HOURS) {
      return ApplyMode.AUTO_APPLY_OVERLAY;
    }
    // Long disruption
    return ApplyMode.PROPOSE_ONLY;
  }

  // Default: generate proposals
  return ApplyMode.PROPOSE_ONLY;
}
