import { describe, it, expect } from 'vitest';
import { enforceStabilityWindow, type StabilityWindowResult } from '../../src/interpreter/stability_window';
import { ApplyMode, type CanonicalChangeRequest } from '../../src/interpreter/types';
import { ParentRole, RequestType } from '../../src/enums';
import { STABILITY_WINDOW_DAYS } from '../../src/constants';

function makeCanonical(overrides: Partial<CanonicalChangeRequest> = {}): CanonicalChangeRequest {
  return {
    id: 'req-1',
    familyId: 'fam-1',
    requestingParent: ParentRole.PARENT_A,
    requestType: RequestType.WANT_TIME,
    dates: ['2026-03-15'],
    childScope: null,
    disruptionEventId: null,
    disruptionEventType: null,
    disruptionDurationHours: null,
    isEmergency: false,
    hasPreConsent: false,
    effectiveDate: '2026-03-15',
    createdAt: '2026-03-04T00:00:00Z',
    reasonNote: null,
    ...overrides,
  };
}

describe('enforceStabilityWindow', () => {
  it('pushes normal request forward by 7 days', () => {
    const canonical = makeCanonical({ effectiveDate: '2026-03-06' });
    const result = enforceStabilityWindow(canonical, ApplyMode.PROPOSE_ONLY, '2026-03-04');
    expect(result.wasAdjusted).toBe(true);
    expect(result.adjustedEffectiveDate).toBe('2026-03-11');
    expect(result.originalDate).toBe('2026-03-06');
    expect(result.reason).toContain('stability window');
  });

  it('exempts emergency requests', () => {
    const canonical = makeCanonical({ effectiveDate: '2026-03-05', isEmergency: true });
    const result = enforceStabilityWindow(canonical, ApplyMode.PROPOSE_ONLY, '2026-03-04');
    expect(result.wasAdjusted).toBe(false);
    expect(result.adjustedEffectiveDate).toBe('2026-03-05');
  });

  it('exempts disruption-linked requests', () => {
    const canonical = makeCanonical({
      effectiveDate: '2026-03-05',
      disruptionEventId: 'disruption-1',
    });
    const result = enforceStabilityWindow(canonical, ApplyMode.PROPOSE_ONLY, '2026-03-04');
    expect(result.wasAdjusted).toBe(false);
    expect(result.adjustedEffectiveDate).toBe('2026-03-05');
  });

  it('exempts AUTO_APPLY_OVERLAY mode', () => {
    const canonical = makeCanonical({ effectiveDate: '2026-03-05' });
    const result = enforceStabilityWindow(canonical, ApplyMode.AUTO_APPLY_OVERLAY, '2026-03-04');
    expect(result.wasAdjusted).toBe(false);
    expect(result.adjustedEffectiveDate).toBe('2026-03-05');
  });

  it('does not adjust if already 7+ days out', () => {
    const canonical = makeCanonical({ effectiveDate: '2026-03-20' });
    const result = enforceStabilityWindow(canonical, ApplyMode.PROPOSE_ONLY, '2026-03-04');
    expect(result.wasAdjusted).toBe(false);
    expect(result.adjustedEffectiveDate).toBe('2026-03-20');
  });

  it('does not adjust if exactly 7 days out', () => {
    const canonical = makeCanonical({ effectiveDate: '2026-03-11' });
    const result = enforceStabilityWindow(canonical, ApplyMode.PROPOSE_ONLY, '2026-03-04');
    expect(result.wasAdjusted).toBe(false);
    expect(result.adjustedEffectiveDate).toBe('2026-03-11');
  });

  it('includes reason string with dates and window', () => {
    const canonical = makeCanonical({ effectiveDate: '2026-03-06' });
    const result = enforceStabilityWindow(canonical, ApplyMode.PROPOSE_ONLY, '2026-03-04');
    expect(result.reason).toMatch(/2026-03-06/);
    expect(result.reason).toMatch(/2026-03-11/);
    expect(result.reason).toMatch(/7-day/);
  });

  it('respects custom windowDays parameter', () => {
    const canonical = makeCanonical({ effectiveDate: '2026-03-08' });
    const result = enforceStabilityWindow(canonical, ApplyMode.PROPOSE_ONLY, '2026-03-04', 14);
    expect(result.wasAdjusted).toBe(true);
    expect(result.adjustedEffectiveDate).toBe('2026-03-18');
  });

  it('STABILITY_WINDOW_DAYS constant equals 7', () => {
    expect(STABILITY_WINDOW_DAYS).toBe(7);
  });
});
