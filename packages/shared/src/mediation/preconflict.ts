import { AlertType, PreConflictAlert } from './types';
import {
  FAIRNESS_DRIFT_WARNING_FRACTION,
  BUDGET_LOW_WARNING_FRACTION,
} from '../constants';

/**
 * Check if the overnight fairness delta is drifting toward the threshold.
 */
export function checkFairnessDrift(
  parentANights: number,
  parentBNights: number,
  windowWeeks: number,
  maxDelta: number,
  refDate: string,
  familyId: string,
  warningFraction: number = FAIRNESS_DRIFT_WARNING_FRACTION,
): PreConflictAlert | null {
  const currentDelta = Math.abs(parentANights - parentBNights);
  const warningThreshold = maxDelta * warningFraction;

  if (currentDelta >= maxDelta) {
    return {
      type: AlertType.FAIRNESS_DRIFT,
      familyId,
      severity: 'critical',
      message: `Overnight balance has exceeded the fairness band: ${currentDelta}-night difference over ${windowWeeks} weeks (limit: ${maxDelta}).`,
      metric: 'overnightDelta',
      currentValue: currentDelta,
      thresholdValue: maxDelta,
      referenceDate: refDate,
    };
  }

  if (currentDelta >= warningThreshold) {
    return {
      type: AlertType.FAIRNESS_DRIFT,
      familyId,
      severity: 'warning',
      message: `Overnight balance is approaching the fairness limit: ${currentDelta}-night difference over ${windowWeeks} weeks (limit: ${maxDelta}).`,
      metric: 'overnightDelta',
      currentValue: currentDelta,
      thresholdValue: maxDelta,
      referenceDate: refDate,
    };
  }

  return null;
}

/**
 * Check if either parent has a stretch of consecutive nights approaching the maximum.
 */
export function checkLongStretch(
  maxConsecutiveCurrent: number,
  maxConsecutiveAllowed: number,
  refDate: string,
  familyId: string,
): PreConflictAlert | null {
  if (maxConsecutiveCurrent >= maxConsecutiveAllowed) {
    return {
      type: AlertType.LONG_STRETCH,
      familyId,
      severity: 'critical',
      message: `A parent has ${maxConsecutiveCurrent} consecutive nights, meeting or exceeding the limit of ${maxConsecutiveAllowed}.`,
      metric: 'maxConsecutive',
      currentValue: maxConsecutiveCurrent,
      thresholdValue: maxConsecutiveAllowed,
      referenceDate: refDate,
    };
  }

  const warningThreshold = maxConsecutiveAllowed - 1;
  if (maxConsecutiveCurrent >= warningThreshold && maxConsecutiveAllowed > 1) {
    return {
      type: AlertType.LONG_STRETCH,
      familyId,
      severity: 'warning',
      message: `A parent has ${maxConsecutiveCurrent} consecutive nights, approaching the limit of ${maxConsecutiveAllowed}.`,
      metric: 'maxConsecutive',
      currentValue: maxConsecutiveCurrent,
      thresholdValue: maxConsecutiveAllowed,
      referenceDate: refDate,
    };
  }

  return null;
}

/**
 * Check if the change budget is running low.
 */
export function checkBudgetLow(
  used: number,
  limit: number,
  familyId: string,
  refDate: string,
  warningFraction: number = BUDGET_LOW_WARNING_FRACTION,
): PreConflictAlert | null {
  if (limit <= 0) return null;

  const remaining = limit - used;
  const usedFraction = used / limit;

  if (remaining <= 0) {
    return {
      type: AlertType.BUDGET_LOW,
      familyId,
      severity: 'critical',
      message: `Change budget exhausted: ${used}/${limit} used this period.`,
      metric: 'changeBudget',
      currentValue: used,
      thresholdValue: limit,
      referenceDate: refDate,
    };
  }

  if (usedFraction >= warningFraction) {
    return {
      type: AlertType.BUDGET_LOW,
      familyId,
      severity: 'warning',
      message: `Change budget running low: ${remaining} of ${limit} remaining this period.`,
      metric: 'changeBudget',
      currentValue: used,
      thresholdValue: limit,
      referenceDate: refDate,
    };
  }

  return null;
}

/**
 * Runs all pre-conflict checks and returns any triggered alerts.
 */
export function runPreConflictChecks(params: {
  familyId: string;
  referenceDate: string;
  parentANights: number;
  parentBNights: number;
  windowWeeks: number;
  maxOvernightDelta: number;
  maxConsecutiveCurrent: number;
  maxConsecutiveAllowed: number;
  budgetUsed: number;
  budgetLimit: number;
}): PreConflictAlert[] {
  const alerts: PreConflictAlert[] = [];

  const fairness = checkFairnessDrift(
    params.parentANights,
    params.parentBNights,
    params.windowWeeks,
    params.maxOvernightDelta,
    params.referenceDate,
    params.familyId,
  );
  if (fairness) alerts.push(fairness);

  const stretch = checkLongStretch(
    params.maxConsecutiveCurrent,
    params.maxConsecutiveAllowed,
    params.referenceDate,
    params.familyId,
  );
  if (stretch) alerts.push(stretch);

  const budget = checkBudgetLow(
    params.budgetUsed,
    params.budgetLimit,
    params.familyId,
    params.referenceDate,
  );
  if (budget) alerts.push(budget);

  return alerts;
}
