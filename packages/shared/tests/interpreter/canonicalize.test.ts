import { describe, it, expect } from 'vitest';
import { canonicalize, normalizeDates, computeEffectiveDate } from '../../src/interpreter/canonicalize';
import { ParentRole, RequestType } from '../../src/enums';

describe('normalizeDates', () => {
  it('sorts dates chronologically', () => {
    const result = normalizeDates(['2026-03-15', '2026-03-10', '2026-03-12']);
    expect(result).toEqual(['2026-03-10', '2026-03-12', '2026-03-15']);
  });

  it('removes duplicates', () => {
    const result = normalizeDates(['2026-03-10', '2026-03-10', '2026-03-12']);
    expect(result).toEqual(['2026-03-10', '2026-03-12']);
  });

  it('handles empty array', () => {
    expect(normalizeDates([])).toEqual([]);
  });

  it('handles single date', () => {
    expect(normalizeDates(['2026-03-10'])).toEqual(['2026-03-10']);
  });
});

describe('computeEffectiveDate', () => {
  it('returns explicit date if provided', () => {
    const result = computeEffectiveDate('2026-03-20T00:00:00Z', ['2026-03-25'], '2026-03-01T00:00:00Z');
    expect(result).toBe('2026-03-20T00:00:00Z');
  });

  it('computes buffered date from earliest request date', () => {
    const earliest = '2026-03-10T00:00:00Z';
    const createdAt = '2026-03-01T00:00:00Z';
    const result = computeEffectiveDate(null, [earliest], createdAt);
    // Buffer is 48h before earliest → 2026-03-08T00:00:00Z
    expect(new Date(result).toISOString()).toBe('2026-03-08T00:00:00.000Z');
  });

  it('never returns earlier than createdAt', () => {
    const createdAt = '2026-03-09T00:00:00Z';
    const result = computeEffectiveDate(null, ['2026-03-10T00:00:00Z'], createdAt);
    // Buffer would be 2026-03-08, but createdAt is 2026-03-09
    expect(new Date(result).getTime()).toBeGreaterThanOrEqual(new Date(createdAt).getTime());
  });

  it('returns createdAt for empty dates', () => {
    const result = computeEffectiveDate(null, [], '2026-03-01T00:00:00Z');
    expect(result).toBe('2026-03-01T00:00:00Z');
  });
});

describe('canonicalize', () => {
  const base = {
    id: 'req-1',
    familyId: 'fam-1',
    requestingParent: ParentRole.PARENT_A,
    requestType: RequestType.NEED_COVERAGE,
    dates: ['2026-03-15', '2026-03-10'],
    createdAt: '2026-03-01T00:00:00Z',
  };

  it('sorts and deduplicates dates', () => {
    const result = canonicalize({ ...base, dates: ['2026-03-15', '2026-03-10', '2026-03-15'] });
    expect(result.dates).toEqual(['2026-03-10', '2026-03-15']);
  });

  it('sets defaults for optional fields', () => {
    const result = canonicalize(base);
    expect(result.childScope).toBeNull();
    expect(result.disruptionEventId).toBeNull();
    expect(result.disruptionEventType).toBeNull();
    expect(result.disruptionDurationHours).toBeNull();
    expect(result.isEmergency).toBe(false);
    expect(result.hasPreConsent).toBe(false);
    expect(result.reasonNote).toBeNull();
  });

  it('preserves explicit optional fields', () => {
    const result = canonicalize({
      ...base,
      childScope: ['child-1'],
      isEmergency: true,
      hasPreConsent: true,
      reasonNote: 'Work trip',
    });
    expect(result.childScope).toEqual(['child-1']);
    expect(result.isEmergency).toBe(true);
    expect(result.hasPreConsent).toBe(true);
    expect(result.reasonNote).toBe('Work trip');
  });

  it('computes effective date', () => {
    const result = canonicalize(base);
    expect(result.effectiveDate).toBeDefined();
    expect(new Date(result.effectiveDate).getTime()).not.toBeNaN();
  });
});
