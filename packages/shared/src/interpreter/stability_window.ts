// ─── Stability Window Enforcement ─────────────────────────────────────
//
// Pure function: pushes non-emergency, non-disruption effective dates
// forward by STABILITY_WINDOW_DAYS if they fall too soon.

import { STABILITY_WINDOW_DAYS } from '../constants';
import type { CanonicalChangeRequest } from './types';
import { ApplyMode } from './types';

export interface StabilityWindowResult {
  adjustedEffectiveDate: string;
  wasAdjusted: boolean;
  originalDate: string;
  reason: string | null;
}

/**
 * Enforce a minimum stability window on the effective date.
 *
 * Exempt:
 * - Emergency requests (isEmergency)
 * - Disruption-linked requests (disruptionEventId present)
 * - AUTO_APPLY_OVERLAY mode
 *
 * Otherwise: if effectiveDate < referenceDate + windowDays,
 * push effectiveDate to referenceDate + windowDays.
 */
export function enforceStabilityWindow(
  canonical: CanonicalChangeRequest,
  applyMode: ApplyMode,
  referenceDate: string,
  windowDays: number = STABILITY_WINDOW_DAYS,
): StabilityWindowResult {
  const originalDate = canonical.effectiveDate;

  // Exempt conditions
  if (canonical.isEmergency) {
    return { adjustedEffectiveDate: originalDate, wasAdjusted: false, originalDate, reason: null };
  }
  if (canonical.disruptionEventId) {
    return { adjustedEffectiveDate: originalDate, wasAdjusted: false, originalDate, reason: null };
  }
  if (applyMode === ApplyMode.AUTO_APPLY_OVERLAY) {
    return { adjustedEffectiveDate: originalDate, wasAdjusted: false, originalDate, reason: null };
  }

  // Compute minimum allowed date
  const refMs = new Date(referenceDate).getTime();
  const minMs = refMs + windowDays * 24 * 60 * 60 * 1000;
  const effectiveMs = new Date(originalDate).getTime();

  if (effectiveMs < minMs) {
    const minDate = new Date(minMs).toISOString().split('T')[0];
    return {
      adjustedEffectiveDate: minDate,
      wasAdjusted: true,
      originalDate,
      reason: `Effective date pushed from ${originalDate} to ${minDate} (${windowDays}-day stability window)`,
    };
  }

  return { adjustedEffectiveDate: originalDate, wasAdjusted: false, originalDate, reason: null };
}
