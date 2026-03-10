import { describe, it, expect, vi } from 'vitest';
import { ProposalFairnessCoordinator } from '../core/ProposalFairnessCoordinator';
import { makeNight, makeScheduleSnapshot, PARENT_A, PARENT_B, CHILD_1, FAMILY_ID, SCHEDULE_V1, SCHEDULE_V2 } from './helpers';
import { FairnessStateService } from '../../fairness/core/FairnessStateService';
import { ChildId, ParentId } from '../../types';

describe('ProposalFairnessCoordinator', () => {
  describe('buildAcceptanceFairnessBatch', () => {
    it('returns null when schedules are identical', () => {
      const coordinator = new ProposalFairnessCoordinator(null);
      const nights = [
        makeNight('2026-03-01', CHILD_1 as string, PARENT_A as string),
        makeNight('2026-03-02', CHILD_1 as string, PARENT_B as string),
      ];

      const result = coordinator.buildAcceptanceFairnessBatch({
        familyId: FAMILY_ID as string,
        priorActiveSchedule: makeScheduleSnapshot(nights),
        acceptedSchedule: makeScheduleSnapshot(nights, SCHEDULE_V2 as string),
        proposalId: 'p-1',
        acceptedAt: '2026-03-05T10:00:00Z',
        origin: 'BASELINE_SOLVER',
      });

      expect(result).toBeNull();
    });

    it('returns batch with deltas when schedules differ', () => {
      const coordinator = new ProposalFairnessCoordinator(null);
      const priorNights = [
        makeNight('2026-03-01', CHILD_1 as string, PARENT_A as string),
        makeNight('2026-03-02', CHILD_1 as string, PARENT_A as string),
      ];
      const acceptedNights = [
        makeNight('2026-03-01', CHILD_1 as string, PARENT_A as string, SCHEDULE_V2 as string),
        makeNight('2026-03-02', CHILD_1 as string, PARENT_B as string, SCHEDULE_V2 as string),
      ];

      const result = coordinator.buildAcceptanceFairnessBatch({
        familyId: FAMILY_ID as string,
        priorActiveSchedule: makeScheduleSnapshot(priorNights),
        acceptedSchedule: makeScheduleSnapshot(acceptedNights, SCHEDULE_V2 as string),
        proposalId: 'p-1',
        acceptedAt: '2026-03-05T10:00:00Z',
        origin: 'BASELINE_SOLVER',
      });

      expect(result).not.toBeNull();
      expect(result!.deltas.length).toBeGreaterThan(0);
      expect(result!.familyId).toBe(FAMILY_ID);
    });

    it('uses REPAIR_ACCEPTANCE source for repair proposals', () => {
      const coordinator = new ProposalFairnessCoordinator(null);
      const priorNights = [
        makeNight('2026-03-01', CHILD_1 as string, PARENT_A as string),
      ];
      const acceptedNights = [
        makeNight('2026-03-01', CHILD_1 as string, PARENT_B as string, SCHEDULE_V2 as string),
      ];

      const result = coordinator.buildAcceptanceFairnessBatch({
        familyId: FAMILY_ID as string,
        priorActiveSchedule: makeScheduleSnapshot(priorNights),
        acceptedSchedule: makeScheduleSnapshot(acceptedNights, SCHEDULE_V2 as string),
        proposalId: 'p-1',
        acceptedAt: '2026-03-05T10:00:00Z',
        origin: 'REPAIR_SOLVER',
      });

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe('REPAIR_ACCEPTANCE');
    });
  });

  describe('appendAcceptanceFairnessEffects', () => {
    it('returns empty when no fairness service', async () => {
      const coordinator = new ProposalFairnessCoordinator(null);
      const nights = [makeNight('2026-03-01', CHILD_1 as string, PARENT_A as string)];

      const result = await coordinator.appendAcceptanceFairnessEffects({
        familyId: FAMILY_ID as string,
        priorActiveSchedule: makeScheduleSnapshot(nights),
        acceptedSchedule: makeScheduleSnapshot(nights, SCHEDULE_V2 as string),
        proposalId: 'p-1',
        acceptedAt: '2026-03-05T10:00:00Z',
        origin: 'BASELINE_SOLVER',
        parentIds: [],
      });

      expect(result).toEqual([]);
    });
  });
});
