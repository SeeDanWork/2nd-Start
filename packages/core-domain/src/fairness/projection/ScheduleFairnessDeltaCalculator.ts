import { DateTime } from 'luxon';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { FairnessDelta } from '../types';

/**
 * Given an active schedule and a candidate schedule, computes fairness
 * deltas implied by the candidate relative to the active baseline.
 */
export function calculateScheduleDelta(input: {
  activeSchedule?: ScheduleSnapshot;
  candidateSchedule: ScheduleSnapshot;
}): FairnessDelta[] {
  const { activeSchedule, candidateSchedule } = input;

  if (!activeSchedule) {
    // No baseline — compute absolute night counts
    const nightCounts = new Map<string, number>();
    const weekendCounts = new Map<string, number>();

    for (const night of candidateSchedule.nights) {
      nightCounts.set(night.parentId, (nightCounts.get(night.parentId) ?? 0) + 1);
      const dt = DateTime.fromISO(night.date);
      if (dt.isValid && (dt.weekday === 5 || dt.weekday === 6)) {
        weekendCounts.set(night.parentId, (weekendCounts.get(night.parentId) ?? 0) + 1);
      }
    }

    // Compute deviations from mean
    const parentIds = [...nightCounts.keys()].sort();
    const totalNights = [...nightCounts.values()].reduce((a, b) => a + b, 0);
    const totalWeekends = [...weekendCounts.values()].reduce((a, b) => a + b, 0);
    const meanNights = parentIds.length > 0 ? totalNights / parentIds.length : 0;
    const meanWeekends = parentIds.length > 0 ? totalWeekends / parentIds.length : 0;

    return parentIds.map(pid => ({
      parentId: pid,
      nightDelta: Math.round((nightCounts.get(pid) ?? 0) - meanNights),
      weekendDelta: Math.round((weekendCounts.get(pid) ?? 0) - meanWeekends),
      holidayDelta: 0,
    }));
  }

  // Build active lookup
  const activeLookup = new Map<string, string>();
  for (const night of activeSchedule.nights) {
    activeLookup.set(`${night.date}:${night.childId}`, night.parentId);
  }

  // Compare candidate against active
  const nightDeltas = new Map<string, number>();
  const weekendDeltas = new Map<string, number>();

  for (const night of candidateSchedule.nights) {
    const key = `${night.date}:${night.childId}`;
    const activeParent = activeLookup.get(key);

    if (!activeParent || activeParent === night.parentId) continue;

    // Prior parent lost, new parent gained
    nightDeltas.set(activeParent, (nightDeltas.get(activeParent) ?? 0) - 1);
    nightDeltas.set(night.parentId, (nightDeltas.get(night.parentId) ?? 0) + 1);

    const dt = DateTime.fromISO(night.date);
    if (dt.isValid && (dt.weekday === 5 || dt.weekday === 6)) {
      weekendDeltas.set(activeParent, (weekendDeltas.get(activeParent) ?? 0) - 1);
      weekendDeltas.set(night.parentId, (weekendDeltas.get(night.parentId) ?? 0) + 1);
    }
  }

  const allParentIds = new Set<string>();
  for (const pid of nightDeltas.keys()) allParentIds.add(pid);
  for (const pid of weekendDeltas.keys()) allParentIds.add(pid);
  const sortedParentIds = [...allParentIds].sort();

  return sortedParentIds
    .map(pid => ({
      parentId: pid,
      nightDelta: nightDeltas.get(pid) ?? 0,
      weekendDelta: weekendDeltas.get(pid) ?? 0,
      holidayDelta: 0,
    }))
    .filter(d => d.nightDelta !== 0 || d.weekendDelta !== 0);
}
