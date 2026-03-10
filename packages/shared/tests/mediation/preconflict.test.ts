import { describe, it, expect } from 'vitest';
import {
  checkFairnessDrift,
  checkLongStretch,
  checkBudgetLow,
  runPreConflictChecks,
} from '../../src/mediation/preconflict';
import { AlertType } from '../../src/mediation/types';

const REF = '2026-03-05';
const FAM = 'fam-1';

describe('checkFairnessDrift', () => {
  it('returns null when delta is well below threshold', () => {
    expect(checkFairnessDrift(28, 28, 8, 8, REF, FAM)).toBeNull();
  });

  it('returns warning when delta reaches warning fraction (0.75)', () => {
    // maxDelta=8, warningFraction=0.75 → threshold=6
    const alert = checkFairnessDrift(32, 26, 8, 8, REF, FAM);
    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe('warning');
    expect(alert!.type).toBe(AlertType.FAIRNESS_DRIFT);
  });

  it('returns critical when delta meets or exceeds maxDelta', () => {
    const alert = checkFairnessDrift(36, 28, 8, 8, REF, FAM);
    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe('critical');
  });

  it('uses custom warning fraction', () => {
    // delta=4, maxDelta=8, warningFraction=0.5 → threshold=4
    const alert = checkFairnessDrift(30, 26, 8, 8, REF, FAM, 0.5);
    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe('warning');
  });
});

describe('checkLongStretch', () => {
  it('returns null when well below limit', () => {
    expect(checkLongStretch(3, 5, REF, FAM)).toBeNull();
  });

  it('returns warning when one below limit', () => {
    const alert = checkLongStretch(4, 5, REF, FAM);
    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe('warning');
    expect(alert!.type).toBe(AlertType.LONG_STRETCH);
  });

  it('returns critical when at or above limit', () => {
    const alert = checkLongStretch(5, 5, REF, FAM);
    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe('critical');
  });
});

describe('checkBudgetLow', () => {
  it('returns null when budget is healthy', () => {
    expect(checkBudgetLow(1, 4, FAM, REF)).toBeNull();
  });

  it('returns warning when usage reaches 75%', () => {
    const alert = checkBudgetLow(3, 4, FAM, REF);
    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe('warning');
    expect(alert!.type).toBe(AlertType.BUDGET_LOW);
  });

  it('returns critical when budget exhausted', () => {
    const alert = checkBudgetLow(4, 4, FAM, REF);
    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe('critical');
  });

  it('returns null for zero limit', () => {
    expect(checkBudgetLow(0, 0, FAM, REF)).toBeNull();
  });
});

describe('runPreConflictChecks', () => {
  it('returns empty array when all metrics are healthy', () => {
    const alerts = runPreConflictChecks({
      familyId: FAM,
      referenceDate: REF,
      parentANights: 28,
      parentBNights: 28,
      windowWeeks: 8,
      maxOvernightDelta: 8,
      maxConsecutiveCurrent: 3,
      maxConsecutiveAllowed: 5,
      budgetUsed: 1,
      budgetLimit: 4,
    });
    expect(alerts).toEqual([]);
  });

  it('returns multiple alerts when multiple conditions trigger', () => {
    const alerts = runPreConflictChecks({
      familyId: FAM,
      referenceDate: REF,
      parentANights: 36,
      parentBNights: 28,
      windowWeeks: 8,
      maxOvernightDelta: 8,
      maxConsecutiveCurrent: 5,
      maxConsecutiveAllowed: 5,
      budgetUsed: 4,
      budgetLimit: 4,
    });
    expect(alerts.length).toBe(3);
    const types = alerts.map((a) => a.type);
    expect(types).toContain(AlertType.FAIRNESS_DRIFT);
    expect(types).toContain(AlertType.LONG_STRETCH);
    expect(types).toContain(AlertType.BUDGET_LOW);
  });
});
