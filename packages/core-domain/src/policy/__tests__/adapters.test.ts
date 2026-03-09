import { describe, it, expect } from 'vitest';
import { adaptScheduleSnapshot } from '../evaluation/adapters/ScheduleSnapshotAdapter';
import { adaptProposalSnapshot } from '../evaluation/adapters/ProposalSnapshotAdapter';
import { FAMILY_ID, PARENT_A, PARENT_B, CHILD_1 } from './helpers';

describe('ScheduleSnapshotAdapter', () => {
  it('adapts raw schedule data to ScheduleSnapshotLike', () => {
    const result = adaptScheduleSnapshot({
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-03-14',
      nights: [{ date: '2026-03-01', childId: CHILD_1, parentId: PARENT_A }],
      exchanges: [{
        date: '2026-03-07',
        childId: CHILD_1,
        fromParentId: PARENT_A,
        toParentId: PARENT_B,
        time: '18:00',
        location: 'School',
      }],
    });
    expect(result.familyId).toBe(FAMILY_ID);
    expect(result.nights).toHaveLength(1);
    expect(result.exchanges).toHaveLength(1);
    expect(result.nights[0]).toEqual({ date: '2026-03-01', childId: CHILD_1, parentId: PARENT_A });
    expect(result.exchanges[0].location).toBe('School');
  });
});

describe('ProposalSnapshotAdapter', () => {
  it('adapts raw proposal data to ScheduleSnapshotLike', () => {
    const result = adaptProposalSnapshot({
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-03-14',
      nights: [{ date: '2026-03-01', childId: CHILD_1, parentId: PARENT_B }],
      exchanges: [],
    });
    expect(result.familyId).toBe(FAMILY_ID);
    expect(result.nights).toHaveLength(1);
    expect(result.nights[0].parentId).toBe(PARENT_B);
  });
});
