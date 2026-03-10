import { ScheduleSnapshotLike, SnapshotNight, SnapshotExchange } from '../../types/evaluation';

/**
 * Adapts a proposal's schedule data into the normalized ScheduleSnapshotLike shape.
 * Proposals may carry their own nights/exchanges that override the base schedule.
 */
export interface RawProposalScheduleData {
  familyId: string;
  startDate: string;
  endDate: string;
  nights: Array<{
    date: string;
    childId: string;
    parentId: string;
  }>;
  exchanges: Array<{
    date: string;
    childId: string;
    fromParentId: string;
    toParentId: string;
    time: string;
    location: string;
  }>;
}

export function adaptProposalSnapshot(data: RawProposalScheduleData): ScheduleSnapshotLike {
  const nights: SnapshotNight[] = data.nights.map(n => ({
    date: n.date,
    childId: n.childId,
    parentId: n.parentId,
  }));

  const exchanges: SnapshotExchange[] = data.exchanges.map(e => ({
    date: e.date,
    childId: e.childId,
    fromParentId: e.fromParentId,
    toParentId: e.toParentId,
    time: e.time,
    location: e.location,
  }));

  return {
    familyId: data.familyId,
    startDate: data.startDate,
    endDate: data.endDate,
    nights,
    exchanges,
  };
}
