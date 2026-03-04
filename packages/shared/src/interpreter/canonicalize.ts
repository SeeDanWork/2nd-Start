// ─── Canonicalize ─────────────────────────────────────────────────────
//
// Normalize a change request into canonical form:
// - Sort dates chronologically
// - Remove duplicate dates
// - Resolve parent (default to requesting parent)
// - Compute notice window

import type { RequestType, DisruptionEventType, ParentRole } from '../enums';
import { NOTICE_WINDOW_BUFFERED_HOURS } from '../constants';
import type { CanonicalChangeRequest } from './types';

export interface RawChangeRequestInput {
  id: string;
  familyId: string;
  requestingParent: ParentRole;
  requestType: RequestType;
  dates: string[];
  childScope?: string[] | null;
  disruptionEventId?: string | null;
  disruptionEventType?: DisruptionEventType | null;
  disruptionDurationHours?: number | null;
  isEmergency?: boolean;
  hasPreConsent?: boolean;
  effectiveDate?: string | null;
  createdAt: string;
  reasonNote?: string | null;
}

/**
 * Sort dates chronologically and remove duplicates.
 */
export function normalizeDates(dates: string[]): string[] {
  const unique = [...new Set(dates)];
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

/**
 * Compute the buffered effective date.
 * If no explicit effective date is given, use the earliest requested date
 * minus the buffer window. Never return a date earlier than "now".
 */
export function computeEffectiveDate(
  explicitDate: string | null | undefined,
  dates: string[],
  createdAt: string,
): string {
  if (explicitDate) {
    return explicitDate;
  }

  if (dates.length === 0) {
    return createdAt;
  }

  const earliest = dates[0]; // already sorted
  const bufferedMs = new Date(earliest).getTime() - NOTICE_WINDOW_BUFFERED_HOURS * 3600_000;
  const createdMs = new Date(createdAt).getTime();

  // Never earlier than creation time
  const effectiveMs = Math.max(bufferedMs, createdMs);
  return new Date(effectiveMs).toISOString();
}

/**
 * Transform raw input into a canonical change request.
 */
export function canonicalize(input: RawChangeRequestInput): CanonicalChangeRequest {
  const sortedDates = normalizeDates(input.dates);
  const effectiveDate = computeEffectiveDate(
    input.effectiveDate,
    sortedDates,
    input.createdAt,
  );

  return {
    id: input.id,
    familyId: input.familyId,
    requestingParent: input.requestingParent,
    requestType: input.requestType,
    dates: sortedDates,
    childScope: input.childScope ?? null,
    disruptionEventId: input.disruptionEventId ?? null,
    disruptionEventType: input.disruptionEventType ?? null,
    disruptionDurationHours: input.disruptionDurationHours ?? null,
    isEmergency: input.isEmergency ?? false,
    hasPreConsent: input.hasPreConsent ?? false,
    effectiveDate,
    createdAt: input.createdAt,
    reasonNote: input.reasonNote ?? null,
  };
}
