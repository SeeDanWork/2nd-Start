import { NightOwnership } from '../../models/NightOwnership';
import { Exchange } from '../../models/Exchange';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { NormalizedRepairInput, BuiltRepairModel } from '../types';
import { RepairCandidateExtractionError } from '../errors';
import { ScheduleId, ChildId, ParentId } from '../../types';

/**
 * Extracts a repaired schedule snapshot from a solved repair assignment.
 *
 * - Nights within repair window come from the solver assignment
 * - Nights outside repair window come from the overlaid schedule
 * - Exchanges inferred deterministically from night transitions
 */
export function extractRepairCandidate(
  assignment: Map<number, number>,
  model: BuiltRepairModel,
  input: NormalizedRepairInput,
): ScheduleSnapshot {
  const repairDates = new Set(input.days.map(d => d.date));

  // Start with overlaid schedule nights outside repair window
  const nightMap = new Map<string, { date: string; childId: string; parentId: string }>();
  for (const night of input.overlaidSchedule.nights) {
    nightMap.set(`${night.date}:${night.childId}`, {
      date: night.date,
      childId: night.childId,
      parentId: night.parentId,
    });
  }

  // Override with solver assignments for repair window dates
  for (const day of input.days) {
    for (const childId of input.childIds) {
      const slotKey = `${day.date}:${childId}`;
      const varIndices = model.variablesBySlot.get(slotKey);
      if (!varIndices) {
        throw new RepairCandidateExtractionError(`No variables for slot ${slotKey}`);
      }

      let assignedParent: string | null = null;
      for (const vi of varIndices) {
        if (assignment.get(vi) === 1) {
          const v = model.variableByIndex.get(vi)!;
          if (assignedParent !== null) {
            throw new RepairCandidateExtractionError(`Multiple parents for slot ${slotKey}`);
          }
          assignedParent = v.parentId;
        }
      }

      if (assignedParent === null) {
        throw new RepairCandidateExtractionError(`No parent assigned for slot ${slotKey}`);
      }

      nightMap.set(slotKey, { date: day.date, childId, parentId: assignedParent });
    }
  }

  // Build sorted nights
  const nightEntries = [...nightMap.values()].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    return dc !== 0 ? dc : a.childId.localeCompare(b.childId);
  });

  const scheduleId = input.activeSchedule.scheduleVersionId as ScheduleId;
  const nights: NightOwnership[] = nightEntries.map((n, i) => ({
    id: `repair-night-${i}`,
    scheduleId,
    date: n.date,
    childId: n.childId as ChildId,
    parentId: n.parentId as ParentId,
    createdAt: new Date(),
  }));

  // Infer exchanges from night transitions
  const exchanges: Exchange[] = [];
  let exchangeIdx = 0;

  for (const childId of input.childIds) {
    const childNights = nightEntries.filter(n => n.childId === childId);
    for (let i = 1; i < childNights.length; i++) {
      if (childNights[i].parentId !== childNights[i - 1].parentId) {
        exchanges.push({
          id: `repair-exchange-${exchangeIdx++}`,
          scheduleId,
          childId: childId as ChildId,
          date: childNights[i].date,
          fromParentId: childNights[i - 1].parentId as ParentId,
          toParentId: childNights[i].parentId as ParentId,
          time: '',
          location: '',
          createdAt: new Date(),
        });
      }
    }
  }

  exchanges.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    return dc !== 0 ? dc : (a.childId as string).localeCompare(b.childId as string);
  });

  return {
    scheduleVersionId: input.activeSchedule.scheduleVersionId,
    familyId: input.familyId,
    startDate: input.activeSchedule.startDate,
    endDate: input.activeSchedule.endDate,
    nights,
    exchanges,
  };
}
