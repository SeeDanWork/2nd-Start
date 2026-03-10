import { describe, it, expect } from 'vitest';
import { validateChangeRequest } from '../../src/interpreter/validate';
import { ParentRole, RequestType } from '../../src/enums';
import type { CanonicalChangeRequest } from '../../src/interpreter/types';

function makeReq(overrides: Partial<CanonicalChangeRequest> = {}): CanonicalChangeRequest {
  return {
    id: 'req-1',
    familyId: 'fam-1',
    requestingParent: ParentRole.PARENT_A,
    requestType: RequestType.NEED_COVERAGE,
    dates: ['2027-03-10', '2027-03-11'],
    childScope: null,
    disruptionEventId: null,
    disruptionEventType: null,
    disruptionDurationHours: null,
    isEmergency: false,
    hasPreConsent: false,
    effectiveDate: '2027-03-08T00:00:00Z',
    createdAt: '2027-03-01T00:00:00Z',
    reasonNote: null,
    ...overrides,
  };
}

describe('validateChangeRequest — common', () => {
  it('fails if dates is empty', () => {
    const errors = validateChangeRequest(makeReq({ dates: [] }));
    expect(errors.some(e => e.code === 'DATES_REQUIRED')).toBe(true);
  });

  it('fails if date is invalid', () => {
    const errors = validateChangeRequest(makeReq({ dates: ['not-a-date'] }));
    expect(errors.some(e => e.code === 'INVALID_DATE')).toBe(true);
  });

  it('passes for valid need_coverage', () => {
    const errors = validateChangeRequest(makeReq());
    expect(errors).toHaveLength(0);
  });
});

describe('validateChangeRequest — want_time', () => {
  it('passes with ≤14 dates', () => {
    const dates = Array.from({ length: 14 }, (_, i) => {
      const d = new Date('2027-03-01');
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const errors = validateChangeRequest(makeReq({ requestType: RequestType.WANT_TIME, dates }));
    expect(errors).toHaveLength(0);
  });

  it('fails with >14 dates', () => {
    const dates = Array.from({ length: 15 }, (_, i) => {
      const d = new Date('2027-03-01');
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const errors = validateChangeRequest(makeReq({ requestType: RequestType.WANT_TIME, dates }));
    expect(errors.some(e => e.code === 'TOO_MANY_DATES')).toBe(true);
  });
});

describe('validateChangeRequest — swap_date', () => {
  it('passes with exactly 2 dates', () => {
    const errors = validateChangeRequest(makeReq({
      requestType: RequestType.SWAP_DATE,
      dates: ['2027-03-10', '2027-03-17'],
    }));
    expect(errors).toHaveLength(0);
  });

  it('fails with != 2 dates', () => {
    const errors = validateChangeRequest(makeReq({
      requestType: RequestType.SWAP_DATE,
      dates: ['2027-03-10'],
    }));
    expect(errors.some(e => e.code === 'SWAP_REQUIRES_TWO_DATES')).toBe(true);
  });
});

describe('validateChangeRequest — bonus_week', () => {
  it('passes with 7 consecutive dates', () => {
    const dates = [
      '2027-04-05', '2027-04-06', '2027-04-07', '2027-04-08',
      '2027-04-09', '2027-04-10', '2027-04-11',
    ];
    const errors = validateChangeRequest(makeReq({ requestType: RequestType.BONUS_WEEK, dates }));
    expect(errors).toHaveLength(0);
  });

  it('fails with != 7 dates', () => {
    const errors = validateChangeRequest(makeReq({
      requestType: RequestType.BONUS_WEEK,
      dates: ['2027-03-10', '2027-03-11', '2027-03-12'],
    }));
    expect(errors.some(e => e.code === 'BONUS_WEEK_REQUIRES_SEVEN')).toBe(true);
  });

  it('fails with non-consecutive dates', () => {
    const dates = ['2027-03-10', '2027-03-11', '2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15', '2027-03-20'];
    const errors = validateChangeRequest(makeReq({ requestType: RequestType.BONUS_WEEK, dates }));
    expect(errors.some(e => e.code === 'BONUS_WEEK_NOT_CONSECUTIVE')).toBe(true);
  });
});
