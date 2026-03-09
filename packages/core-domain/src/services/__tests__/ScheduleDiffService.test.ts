import { describe, it, expect } from 'vitest';
import { diffSchedules, diffProposalAgainstBase } from '../../diff/ScheduleDiffService';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { ProposalSnapshot } from '../../models/ProposalSnapshot';
import { PARENT_A, PARENT_B, CHILD_1, CHILD_2, makeNight, makeExchange, makeProposalNight, makeProposalExchange } from './helpers';
import { ScheduleId } from '../../types';

const BASE_ID = 'base' as ScheduleId;
const CANDIDATE_ID = 'candidate' as ScheduleId;

function baseSnapshot(overrides?: Partial<ScheduleSnapshot>): ScheduleSnapshot {
  return {
    scheduleVersionId: BASE_ID,
    familyId: 'family-1',
    startDate: '2026-03-01',
    endDate: '2026-03-07',
    nights: [],
    exchanges: [],
    ...overrides,
  };
}

describe('ScheduleDiffService', () => {
  describe('diffSchedules', () => {
    it('detects changed nights correctly', () => {
      const base = baseSnapshot({
        nights: [
          makeNight(BASE_ID, '2026-03-01', CHILD_1, PARENT_A),
          makeNight(BASE_ID, '2026-03-02', CHILD_1, PARENT_A),
          makeNight(BASE_ID, '2026-03-03', CHILD_1, PARENT_B),
        ],
      });

      const candidate = baseSnapshot({
        scheduleVersionId: CANDIDATE_ID,
        nights: [
          makeNight(CANDIDATE_ID, '2026-03-01', CHILD_1, PARENT_B), // changed
          makeNight(CANDIDATE_ID, '2026-03-02', CHILD_1, PARENT_A), // same
          makeNight(CANDIDATE_ID, '2026-03-03', CHILD_1, PARENT_B), // same
        ],
      });

      const diff = diffSchedules(base, candidate);

      expect(diff.changedNights).toHaveLength(1);
      expect(diff.changedNights[0]).toEqual({
        date: '2026-03-01',
        childId: CHILD_1,
        fromParentId: PARENT_A,
        toParentId: PARENT_B,
      });
      expect(diff.summary.changedNightCount).toBe(1);
    });

    it('detects added exchanges', () => {
      const base = baseSnapshot({ nights: [], exchanges: [] });

      const candidate = baseSnapshot({
        scheduleVersionId: CANDIDATE_ID,
        exchanges: [
          makeExchange(CANDIDATE_ID, '2026-03-02', CHILD_1, PARENT_A, PARENT_B),
        ],
      });

      const diff = diffSchedules(base, candidate);

      expect(diff.addedExchanges).toHaveLength(1);
      expect(diff.addedExchanges[0].date).toBe('2026-03-02');
      expect(diff.removedExchanges).toHaveLength(0);
    });

    it('detects removed exchanges', () => {
      const base = baseSnapshot({
        exchanges: [
          makeExchange(BASE_ID, '2026-03-02', CHILD_1, PARENT_A, PARENT_B),
        ],
      });

      const candidate = baseSnapshot({
        scheduleVersionId: CANDIDATE_ID,
        exchanges: [],
      });

      const diff = diffSchedules(base, candidate);

      expect(diff.removedExchanges).toHaveLength(1);
      expect(diff.addedExchanges).toHaveLength(0);
    });

    it('detects changed exchanges', () => {
      const base = baseSnapshot({
        exchanges: [
          makeExchange(BASE_ID, '2026-03-02', CHILD_1, PARENT_A, PARENT_B, '08:00', 'School'),
        ],
      });

      const candidate = baseSnapshot({
        scheduleVersionId: CANDIDATE_ID,
        exchanges: [
          makeExchange(CANDIDATE_ID, '2026-03-02', CHILD_1, PARENT_A, PARENT_B, '15:00', 'Home'),
        ],
      });

      const diff = diffSchedules(base, candidate);

      expect(diff.changedExchanges).toHaveLength(1);
      expect(diff.changedExchanges[0].before.time).toBe('08:00');
      expect(diff.changedExchanges[0].after.time).toBe('15:00');
      expect(diff.changedExchanges[0].before.location).toBe('School');
      expect(diff.changedExchanges[0].after.location).toBe('Home');
    });

    it('produces deterministic sorted output', () => {
      const base = baseSnapshot({
        nights: [
          makeNight(BASE_ID, '2026-03-03', CHILD_2, PARENT_A),
          makeNight(BASE_ID, '2026-03-01', CHILD_1, PARENT_A),
          makeNight(BASE_ID, '2026-03-02', CHILD_1, PARENT_A),
        ],
      });

      const candidate = baseSnapshot({
        scheduleVersionId: CANDIDATE_ID,
        nights: [
          makeNight(CANDIDATE_ID, '2026-03-03', CHILD_2, PARENT_B), // changed
          makeNight(CANDIDATE_ID, '2026-03-01', CHILD_1, PARENT_B), // changed
          makeNight(CANDIDATE_ID, '2026-03-02', CHILD_1, PARENT_B), // changed
        ],
      });

      const diff = diffSchedules(base, candidate);

      expect(diff.changedNights).toHaveLength(3);
      // Sorted by date, then childId
      expect(diff.changedNights[0].date).toBe('2026-03-01');
      expect(diff.changedNights[0].childId).toBe(CHILD_1);
      expect(diff.changedNights[1].date).toBe('2026-03-02');
      expect(diff.changedNights[2].date).toBe('2026-03-03');
      expect(diff.changedNights[2].childId).toBe(CHILD_2);
    });

    it('reports affected children and dates in summary', () => {
      const base = baseSnapshot({
        nights: [
          makeNight(BASE_ID, '2026-03-01', CHILD_1, PARENT_A),
          makeNight(BASE_ID, '2026-03-02', CHILD_2, PARENT_A),
        ],
      });

      const candidate = baseSnapshot({
        scheduleVersionId: CANDIDATE_ID,
        nights: [
          makeNight(CANDIDATE_ID, '2026-03-01', CHILD_1, PARENT_B),
          makeNight(CANDIDATE_ID, '2026-03-02', CHILD_2, PARENT_B),
        ],
      });

      const diff = diffSchedules(base, candidate);

      expect(diff.summary.affectedChildren).toEqual([CHILD_1, CHILD_2].sort());
      expect(diff.summary.affectedDates).toEqual(['2026-03-01', '2026-03-02']);
    });

    it('returns empty diff for identical schedules', () => {
      const nights = [
        makeNight(BASE_ID, '2026-03-01', CHILD_1, PARENT_A),
        makeNight(BASE_ID, '2026-03-02', CHILD_1, PARENT_B),
      ];

      const base = baseSnapshot({ nights });
      const candidate = baseSnapshot({
        scheduleVersionId: CANDIDATE_ID,
        nights: nights.map(n => ({ ...n, scheduleId: CANDIDATE_ID as ScheduleId })),
      });

      const diff = diffSchedules(base, candidate);

      expect(diff.changedNights).toHaveLength(0);
      expect(diff.addedExchanges).toHaveLength(0);
      expect(diff.removedExchanges).toHaveLength(0);
      expect(diff.changedExchanges).toHaveLength(0);
      expect(diff.summary.changedNightCount).toBe(0);
    });
  });

  describe('diffProposalAgainstBase', () => {
    it('diffs proposal nights against base schedule', () => {
      const base = baseSnapshot({
        nights: [
          makeNight(BASE_ID, '2026-03-01', CHILD_1, PARENT_A),
          makeNight(BASE_ID, '2026-03-02', CHILD_1, PARENT_B),
        ],
      });

      const proposal: ProposalSnapshot = {
        proposalId: 'p1',
        proposalScheduleId: 'ps1',
        baseScheduleVersionId: BASE_ID,
        nights: [
          makeProposalNight('ps1', '2026-03-01', CHILD_1, PARENT_B), // changed
          makeProposalNight('ps1', '2026-03-02', CHILD_1, PARENT_B), // same
        ],
        exchanges: [],
      };

      const diff = diffProposalAgainstBase(base, proposal);

      expect(diff.changedNights).toHaveLength(1);
      expect(diff.changedNights[0].date).toBe('2026-03-01');
      expect(diff.changedNights[0].fromParentId).toBe(PARENT_A);
      expect(diff.changedNights[0].toParentId).toBe(PARENT_B);
    });
  });
});
