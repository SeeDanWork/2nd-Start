import { ScheduleSnapshotLike, SnapshotNight, SnapshotExchange } from '../../types/evaluation';

/**
 * Adapts raw schedule data (from a ScheduleVersion + its nights/exchanges)
 * into the normalized ScheduleSnapshotLike shape expected by the policy engine.
 */
export interface RawScheduleData {
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

export function adaptScheduleSnapshot(data: RawScheduleData): ScheduleSnapshotLike {
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
