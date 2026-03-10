// ─── Consent Check ────────────────────────────────────────────────────
//
// Determines whether a change request can proceed without explicit
// consent from the other parent.

import { ApplyMode, type CanonicalChangeRequest, type StabilityBudgetResult } from './types';

/**
 * Check if consent is satisfied for this request.
 *
 * Consent is satisfied when ANY of:
 * 1. Emergency request (always bypasses consent)
 * 2. Short disruption + budget OK + overlay-only + pre-consent given
 * 3. The other parent has given pre-consent for this request type
 *
 * When consent is NOT satisfied, the request must wait for explicit approval.
 */
export function checkConsent(
  req: CanonicalChangeRequest,
  applyMode: ApplyMode,
  stabilityBudget: StabilityBudgetResult,
): { satisfied: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Emergency always satisfies consent
  if (req.isEmergency) {
    reasons.push('Emergency request — consent bypassed');
    return { satisfied: true, reasons };
  }

  // Auto-apply overlay with pre-consent + budget OK
  if (
    applyMode === ApplyMode.AUTO_APPLY_OVERLAY &&
    req.hasPreConsent &&
    !stabilityBudget.budgetExceeded
  ) {
    reasons.push('Short disruption with pre-consent and budget available — auto-apply eligible');
    return { satisfied: true, reasons };
  }

  // Pre-consent for non-auto modes (budget doesn't block consent for proposals)
  if (req.hasPreConsent && applyMode !== ApplyMode.AUTO_APPLY_OVERLAY) {
    reasons.push('Pre-consent given for this request type');
    return { satisfied: true, reasons };
  }

  // Not satisfied
  reasons.push('Explicit consent required from other parent');
  return { satisfied: false, reasons };
}
