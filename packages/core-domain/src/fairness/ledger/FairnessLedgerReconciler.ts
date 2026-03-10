import { DateTime } from 'luxon';
import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';
import { FairnessLedgerState, FairnessDeltaBatch, FairnessDelta, FairnessEventType } from '../types';
import { FairnessReconciliationError } from '../errors';

/**
 * Reconciles ledger changes implied by accepted schedule transitions.
 * Computes the net fairness effect of an accepted schedule relative to
 * the prior active schedule.
 */
export function reconcileAcceptedScheduleChange(input: {
  familyId: string;
  previousLedger: FairnessLedgerState;
  priorActiveSchedule: ScheduleSnapshot;
  acceptedSchedule: ScheduleSnapshot;
  sourceType: string;
  sourceId?: string;
  effectiveDate: string;
}): FairnessDeltaBatch {
  if (!input.familyId) {
    throw new FairnessReconciliationError('familyId is required');
  }
  if (!input.effectiveDate) {
    throw new FairnessReconciliationError('effectiveDate is required');
  }

  // Build lookup for prior active schedule
  const priorLookup = new Map<string, string>();
  for (const night of input.priorActiveSchedule.nights) {
    priorLookup.set(`${night.date}:${night.childId}`, night.parentId);
  }

  // Compare accepted schedule against prior active
  const nightDeltas = new Map<string, number>();
  const weekendDeltas = new Map<string, number>();

  for (const night of input.acceptedSchedule.nights) {
    const key = `${night.date}:${night.childId}`;
    const priorParent = priorLookup.get(key);

    if (!priorParent || priorParent === night.parentId) continue;

    // Prior parent lost a night, new parent gained a night
    nightDeltas.set(priorParent, (nightDeltas.get(priorParent) ?? 0) - 1);
    nightDeltas.set(night.parentId, (nightDeltas.get(night.parentId) ?? 0) + 1);

    // Check weekend
    const dt = DateTime.fromISO(night.date);
    if (dt.isValid && (dt.weekday === 5 || dt.weekday === 6)) {
      weekendDeltas.set(priorParent, (weekendDeltas.get(priorParent) ?? 0) - 1);
      weekendDeltas.set(night.parentId, (weekendDeltas.get(night.parentId) ?? 0) + 1);
    }
  }

  // Collect all affected parents
  const allParentIds = new Set<string>();
  for (const pid of nightDeltas.keys()) allParentIds.add(pid);
  for (const pid of weekendDeltas.keys()) allParentIds.add(pid);

  const sortedParentIds = [...allParentIds].sort();
  const deltas: FairnessDelta[] = [];

  for (const parentId of sortedParentIds) {
    const nd = nightDeltas.get(parentId) ?? 0;
    const wd = weekendDeltas.get(parentId) ?? 0;

    if (nd === 0 && wd === 0) continue;

    deltas.push({
      parentId,
      nightDelta: nd,
      weekendDelta: wd,
      holidayDelta: 0,
    });
  }

  return {
    familyId: input.familyId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    eventType: FairnessEventType.PROPOSAL_ACCEPTANCE_RECONCILIATION,
    effectiveDate: input.effectiveDate,
    reason: `Reconciliation for ${input.sourceType}${input.sourceId ? ` ${input.sourceId}` : ''}`,
    deltas,
  };
}
