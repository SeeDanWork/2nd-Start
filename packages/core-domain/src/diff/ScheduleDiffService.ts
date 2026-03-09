import { ScheduleSnapshot } from '../models/ScheduleSnapshot';
import { ProposalSnapshot } from '../models/ProposalSnapshot';
import { ScheduleDiff, ChangedNight, ExchangeChange, ChangedExchange, ScheduleDiffSummary } from './types';

function nightKey(childId: string, date: string): string {
  return `${childId}:${date}`;
}

function exchangeKey(childId: string, date: string): string {
  return `${childId}:${date}`;
}

function sortByDateChild<T extends { date: string; childId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return a.childId.localeCompare(b.childId);
  });
}

function buildSummary(
  changedNights: ChangedNight[],
  addedExchanges: ExchangeChange[],
  removedExchanges: ExchangeChange[],
  changedExchanges: ChangedExchange[],
): ScheduleDiffSummary {
  const childSet = new Set<string>();
  const dateSet = new Set<string>();

  for (const n of changedNights) {
    childSet.add(n.childId);
    dateSet.add(n.date);
  }
  for (const e of addedExchanges) {
    childSet.add(e.childId);
    dateSet.add(e.date);
  }
  for (const e of removedExchanges) {
    childSet.add(e.childId);
    dateSet.add(e.date);
  }
  for (const e of changedExchanges) {
    childSet.add(e.childId);
    dateSet.add(e.date);
  }

  return {
    changedNightCount: changedNights.length,
    changedExchangeCount: addedExchanges.length + removedExchanges.length + changedExchanges.length,
    affectedChildren: [...childSet].sort(),
    affectedDates: [...dateSet].sort(),
  };
}

export function diffSchedules(
  base: ScheduleSnapshot,
  candidate: ScheduleSnapshot,
): ScheduleDiff {
  // Night diffs
  const baseNights = new Map<string, { parentId: string; childId: string; date: string }>();
  for (const n of base.nights) {
    baseNights.set(nightKey(n.childId, n.date), { parentId: n.parentId, childId: n.childId, date: n.date });
  }

  const changedNights: ChangedNight[] = [];
  for (const n of candidate.nights) {
    const key = nightKey(n.childId, n.date);
    const baseNight = baseNights.get(key);
    if (baseNight && baseNight.parentId !== n.parentId) {
      changedNights.push({
        date: n.date,
        childId: n.childId,
        fromParentId: baseNight.parentId,
        toParentId: n.parentId,
      });
    }
  }

  // Exchange diffs
  const baseExchanges = new Map<string, typeof base.exchanges[0]>();
  for (const e of base.exchanges) {
    baseExchanges.set(exchangeKey(e.childId, e.date), e);
  }
  const candidateExchanges = new Map<string, typeof candidate.exchanges[0]>();
  for (const e of candidate.exchanges) {
    candidateExchanges.set(exchangeKey(e.childId, e.date), e);
  }

  const addedExchanges: ExchangeChange[] = [];
  const removedExchanges: ExchangeChange[] = [];
  const changedExchanges: ChangedExchange[] = [];

  for (const [key, ce] of candidateExchanges) {
    const be = baseExchanges.get(key);
    if (!be) {
      addedExchanges.push({
        date: ce.date, childId: ce.childId,
        fromParentId: ce.fromParentId, toParentId: ce.toParentId,
        time: ce.time, location: ce.location,
      });
    } else if (
      be.fromParentId !== ce.fromParentId ||
      be.toParentId !== ce.toParentId ||
      be.time !== ce.time ||
      be.location !== ce.location
    ) {
      changedExchanges.push({
        date: ce.date, childId: ce.childId,
        before: { fromParentId: be.fromParentId, toParentId: be.toParentId, time: be.time, location: be.location },
        after: { fromParentId: ce.fromParentId, toParentId: ce.toParentId, time: ce.time, location: ce.location },
      });
    }
  }

  for (const [key, be] of baseExchanges) {
    if (!candidateExchanges.has(key)) {
      removedExchanges.push({
        date: be.date, childId: be.childId,
        fromParentId: be.fromParentId, toParentId: be.toParentId,
        time: be.time, location: be.location,
      });
    }
  }

  const sortedNights = sortByDateChild(changedNights);
  const sortedAdded = sortByDateChild(addedExchanges);
  const sortedRemoved = sortByDateChild(removedExchanges);
  const sortedChanged = sortByDateChild(changedExchanges);

  return {
    changedNights: sortedNights,
    addedExchanges: sortedAdded,
    removedExchanges: sortedRemoved,
    changedExchanges: sortedChanged,
    summary: buildSummary(sortedNights, sortedAdded, sortedRemoved, sortedChanged),
  };
}

export function diffProposalAgainstBase(
  base: ScheduleSnapshot,
  proposal: ProposalSnapshot,
): ScheduleDiff {
  // Convert proposal snapshot to a schedule-like structure for reuse
  const candidateSnapshot: ScheduleSnapshot = {
    scheduleVersionId: proposal.proposalScheduleId,
    familyId: base.familyId,
    startDate: base.startDate,
    endDate: base.endDate,
    nights: proposal.nights.map(n => ({
      id: n.id,
      scheduleId: proposal.proposalScheduleId as any,
      date: n.date,
      childId: n.childId,
      parentId: n.parentId,
      createdAt: n.createdAt,
    })),
    exchanges: proposal.exchanges.map(e => ({
      id: e.id,
      scheduleId: proposal.proposalScheduleId as any,
      childId: e.childId,
      date: e.date,
      fromParentId: e.fromParentId,
      toParentId: e.toParentId,
      time: e.time,
      location: e.location,
      createdAt: e.createdAt,
    })),
  };

  return diffSchedules(base, candidateSnapshot);
}
