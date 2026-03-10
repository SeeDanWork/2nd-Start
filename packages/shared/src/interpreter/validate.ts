// ─── Validation ───────────────────────────────────────────────────────
//
// Per-request-type validation. All functions are pure.

import { RequestType } from '../enums';
import type { CanonicalChangeRequest, ValidationError } from './types';

/**
 * Validate a canonical change request based on its type.
 * Returns an array of validation errors (empty = valid).
 */
export function validateChangeRequest(req: CanonicalChangeRequest): ValidationError[] {
  const errors: ValidationError[] = [];

  // Common: must have at least one date
  if (req.dates.length === 0) {
    errors.push({
      field: 'dates',
      message: 'At least one date is required',
      code: 'DATES_REQUIRED',
    });
  }

  // Common: dates must be valid ISO strings
  for (const d of req.dates) {
    if (isNaN(new Date(d).getTime())) {
      errors.push({
        field: 'dates',
        message: `Invalid date: ${d}`,
        code: 'INVALID_DATE',
      });
    }
  }

  // Type-specific validation
  switch (req.requestType) {
    case RequestType.NEED_COVERAGE:
      validateNeedCoverage(req, errors);
      break;
    case RequestType.WANT_TIME:
      validateWantTime(req, errors);
      break;
    case RequestType.SWAP_DATE:
      validateSwapDate(req, errors);
      break;
    case RequestType.BONUS_WEEK:
      validateBonusWeek(req, errors);
      break;
  }

  return errors;
}

function validateNeedCoverage(req: CanonicalChangeRequest, errors: ValidationError[]): void {
  // Need coverage: requesting parent needs someone else to cover these dates
  // Must have dates in the future
  const now = new Date();
  for (const d of req.dates) {
    if (new Date(d) < now) {
      errors.push({
        field: 'dates',
        message: `Date ${d} is in the past`,
        code: 'DATE_IN_PAST',
      });
    }
  }
}

function validateWantTime(req: CanonicalChangeRequest, errors: ValidationError[]): void {
  // Want time: requesting parent wants to have the child on these dates
  if (req.dates.length > 14) {
    errors.push({
      field: 'dates',
      message: 'Want-time requests cannot span more than 14 days',
      code: 'TOO_MANY_DATES',
    });
  }
}

function validateSwapDate(req: CanonicalChangeRequest, errors: ValidationError[]): void {
  // Swap date: must have exactly 2 dates (give + take)
  if (req.dates.length !== 2) {
    errors.push({
      field: 'dates',
      message: 'Swap requests require exactly 2 dates',
      code: 'SWAP_REQUIRES_TWO_DATES',
    });
  }
}

function validateBonusWeek(req: CanonicalChangeRequest, errors: ValidationError[]): void {
  // Bonus week: must have exactly 7 consecutive dates
  if (req.dates.length !== 7) {
    errors.push({
      field: 'dates',
      message: 'Bonus week requires exactly 7 dates',
      code: 'BONUS_WEEK_REQUIRES_SEVEN',
    });
    return;
  }

  // Verify consecutive (use UTC to avoid timezone issues with date-only strings)
  for (let i = 1; i < req.dates.length; i++) {
    const prevStr = req.dates[i - 1].slice(0, 10);
    const currStr = req.dates[i].slice(0, 10);
    const prev = new Date(prevStr + 'T00:00:00Z');
    const curr = new Date(currStr + 'T00:00:00Z');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 3600_000));
    if (diffDays !== 1) {
      errors.push({
        field: 'dates',
        message: 'Bonus week dates must be 7 consecutive days',
        code: 'BONUS_WEEK_NOT_CONSECUTIVE',
      });
      break;
    }
  }
}
