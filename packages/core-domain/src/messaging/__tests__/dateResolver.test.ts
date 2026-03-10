import { describe, it, expect } from 'vitest';
import { DateReferenceResolver } from '../resolution/DateReferenceResolver';
import { IntentType, ValidatedIntentCandidate } from '../types';
import { makeMessage } from './helpers';

describe('DateReferenceResolver', () => {
  const resolver = new DateReferenceResolver();

  const baseCandidate: ValidatedIntentCandidate = {
    type: IntentType.SWAP_REQUEST,
    payload: {},
    confidence: 0.9,
    validationPassed: true,
  };

  it('resolves explicit ISO date from payload', () => {
    const candidate: ValidatedIntentCandidate = {
      ...baseCandidate,
      payload: { targetDate: '2026-03-15' },
    };

    const result = resolver.resolveDates({
      message: makeMessage(),
      candidate,
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.resolvedDates).toContain('2026-03-15');
  });

  it('resolves "tomorrow" from explicit reference time', () => {
    const result = resolver.resolveDates({
      message: makeMessage({ text: 'I need tomorrow off' }),
      candidate: baseCandidate,
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.resolvedDates).toContain('2026-03-10');
  });

  it('resolves "today" from reference time', () => {
    const result = resolver.resolveDates({
      message: makeMessage({ text: 'Sick today' }),
      candidate: baseCandidate,
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.resolvedDates).toContain('2026-03-09');
  });

  it('resolves "next weekend" deterministically', () => {
    // 2026-03-09 is a Monday
    const result = resolver.resolveDates({
      message: makeMessage({ text: 'Can we swap next weekend?' }),
      candidate: baseCandidate,
      referenceTimeIso: '2026-03-09T10:00:00Z',
      timezone: 'UTC',
    });

    // This weekend = Mar 14-15 (Sat-Sun), next weekend = Mar 21-22
    expect(result.resolvedDateRanges.length).toBeGreaterThanOrEqual(1);
    const nextWeekend = result.resolvedDateRanges.find(r => r.startDate === '2026-03-21');
    expect(nextWeekend).toBeDefined();
    expect(nextWeekend!.endDate).toBe('2026-03-22');
  });

  it('resolves weekday name to next occurrence', () => {
    // 2026-03-09 is Monday, Thursday = Mar 12
    const result = resolver.resolveDates({
      message: makeMessage({ text: 'I need Thursday' }),
      candidate: baseCandidate,
      referenceTimeIso: '2026-03-09T10:00:00Z',
      timezone: 'UTC',
    });

    expect(result.resolvedDates).toContain('2026-03-12');
  });

  it('resolves date ranges from payload', () => {
    const candidate: ValidatedIntentCandidate = {
      ...baseCandidate,
      payload: { targetDateRange: { startDate: '2026-03-10', endDate: '2026-03-12' } },
    };

    const result = resolver.resolveDates({
      message: makeMessage(),
      candidate,
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.resolvedDateRanges).toContainEqual({
      startDate: '2026-03-10',
      endDate: '2026-03-12',
    });
  });

  it('returns error for invalid reference time', () => {
    const result = resolver.resolveDates({
      message: makeMessage(),
      candidate: baseCandidate,
      referenceTimeIso: 'not-a-date',
    });

    expect(result.ambiguities.some(a => a.code === 'INVALID_REFERENCE_TIME')).toBe(true);
  });
});
