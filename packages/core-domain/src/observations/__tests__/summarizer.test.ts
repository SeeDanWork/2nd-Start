import { describe, it, expect } from 'vitest';
import { SuggestionEvidenceSummarizer } from '../core/SuggestionEvidenceSummarizer';
import { ObservationEvidenceRecord, BehaviorObservationWindow } from '../types';

const summarizer = new SuggestionEvidenceSummarizer();

const WINDOW: BehaviorObservationWindow = {
  familyId: 'fam-1',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
};

function makeEvidence(id: string, date: string, data: Record<string, unknown> = {}): ObservationEvidenceRecord {
  return {
    evidenceId: id,
    familyId: 'fam-1',
    evidenceType: 'EXCHANGE_PATTERN',
    date,
    data,
    createdAt: `${date}T00:00:00Z`,
  };
}

describe('SuggestionEvidenceSummarizer', () => {
  it('returns correct occurrenceCount matching evidenceIds', () => {
    const all = [makeEvidence('ev-1', '2026-03-05'), makeEvidence('ev-2', '2026-03-10'), makeEvidence('ev-3', '2026-03-15')];
    const summary = summarizer.buildSummary({
      window: WINDOW,
      evidenceIds: ['ev-1', 'ev-3'],
      allEvidence: all,
    });

    expect(summary.occurrenceCount).toBe(2);
    expect(summary.windowStart).toBe('2026-03-01');
    expect(summary.windowEnd).toBe('2026-03-31');
  });

  it('caps representative examples at 5', () => {
    const all = Array.from({ length: 8 }, (_, i) =>
      makeEvidence(`ev-${i}`, `2026-03-${String(i + 1).padStart(2, '0')}`, { dayOfWeek: 0 }),
    );
    const ids = all.map(e => e.evidenceId);

    const summary = summarizer.buildSummary({
      window: WINDOW,
      evidenceIds: ids,
      allEvidence: all,
    });

    expect(summary.occurrenceCount).toBe(8);
    expect(summary.representativeExamples).toHaveLength(5);
  });

  it('returns empty examples for empty evidenceIds', () => {
    const all = [makeEvidence('ev-1', '2026-03-05')];
    const summary = summarizer.buildSummary({
      window: WINDOW,
      evidenceIds: [],
      allEvidence: all,
    });

    expect(summary.occurrenceCount).toBe(0);
    expect(summary.representativeExamples).toEqual([]);
  });

  it('returns empty examples when no allEvidence matches', () => {
    const all = [makeEvidence('ev-1', '2026-03-05')];
    const summary = summarizer.buildSummary({
      window: WINDOW,
      evidenceIds: ['ev-nonexistent'],
      allEvidence: all,
    });

    expect(summary.occurrenceCount).toBe(0);
    expect(summary.representativeExamples).toEqual([]);
  });

  it('sorts deterministically by date then evidenceId', () => {
    const all = [
      makeEvidence('ev-b', '2026-03-10', { val: 'b' }),
      makeEvidence('ev-a', '2026-03-10', { val: 'a' }),
      makeEvidence('ev-c', '2026-03-05', { val: 'c' }),
    ];

    const summary = summarizer.buildSummary({
      window: WINDOW,
      evidenceIds: ['ev-a', 'ev-b', 'ev-c'],
      allEvidence: all,
    });

    expect(summary.representativeExamples).toEqual([
      { date: '2026-03-05', data: { val: 'c' } },
      { date: '2026-03-10', data: { val: 'a' } },
      { date: '2026-03-10', data: { val: 'b' } },
    ]);
  });

  it('selects first 5 after sorting when more than 5 match', () => {
    const dates = ['2026-03-20', '2026-03-01', '2026-03-15', '2026-03-10', '2026-03-25', '2026-03-05', '2026-03-12'];
    const all = dates.map((d, i) => makeEvidence(`ev-${i}`, d, { idx: i }));
    const ids = all.map(e => e.evidenceId);

    const summary = summarizer.buildSummary({
      window: WINDOW,
      evidenceIds: ids,
      allEvidence: all,
    });

    // Sorted by date: 03-01(ev-1), 03-05(ev-5), 03-10(ev-3), 03-12(ev-6), 03-15(ev-2) — first 5
    expect(summary.representativeExamples).toHaveLength(5);
    expect(summary.representativeExamples[0].date).toBe('2026-03-01');
    expect(summary.representativeExamples[1].date).toBe('2026-03-05');
    expect(summary.representativeExamples[2].date).toBe('2026-03-10');
    expect(summary.representativeExamples[3].date).toBe('2026-03-12');
    expect(summary.representativeExamples[4].date).toBe('2026-03-15');
  });

  it('examples contain only date and data fields', () => {
    const all = [makeEvidence('ev-1', '2026-03-05', { dayOfWeek: 3 })];
    const summary = summarizer.buildSummary({
      window: WINDOW,
      evidenceIds: ['ev-1'],
      allEvidence: all,
    });

    expect(summary.representativeExamples[0]).toEqual({
      date: '2026-03-05',
      data: { dayOfWeek: 3 },
    });
    expect(Object.keys(summary.representativeExamples[0])).toEqual(['date', 'data']);
  });

  it('produces identical output on repeated calls (deterministic)', () => {
    const all = [
      makeEvidence('ev-z', '2026-03-10'),
      makeEvidence('ev-a', '2026-03-05'),
      makeEvidence('ev-m', '2026-03-10'),
    ];
    const ids = all.map(e => e.evidenceId);

    const s1 = summarizer.buildSummary({ window: WINDOW, evidenceIds: ids, allEvidence: all });
    const s2 = summarizer.buildSummary({ window: WINDOW, evidenceIds: ids, allEvidence: all });
    expect(s1).toEqual(s2);
  });
});
