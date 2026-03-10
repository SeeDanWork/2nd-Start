import { DateTime } from 'luxon';
import { RepairInput, NormalizedRepairInput, RepairWindow } from '../types';
import { DayInfo, FairnessState } from '../../solver/types';
import { RepairInputValidationError } from '../errors';
import { validateOverlays } from '../overlay/OverlayValidator';
import { applyOverlays } from '../overlay/OverlayApplicator';
import { buildRepairWindow } from './RepairWindowBuilder';
import { calculateOverlayDrift } from '../fairness/FairnessDriftCalculator';

/**
 * Builds a normalized, validated repair input from raw input.
 * All outputs are deterministically sorted for reproducibility.
 */
export function buildRepairInput(raw: RepairInput): NormalizedRepairInput {
  // Validate basics
  if (!raw.familyId) {
    throw new RepairInputValidationError('familyId is required');
  }
  if (raw.parents.length === 0) {
    throw new RepairInputValidationError('At least one parent is required');
  }
  if (raw.children.length === 0) {
    throw new RepairInputValidationError('At least one child is required');
  }
  if (raw.disruptionOverlays.length === 0) {
    throw new RepairInputValidationError('At least one disruption overlay is required');
  }

  // Validate family coherence
  for (const parent of raw.parents) {
    if (parent.familyId !== raw.familyId) {
      throw new RepairInputValidationError(
        `Parent ${parent.id} belongs to family ${parent.familyId}, expected ${raw.familyId}`,
      );
    }
  }
  for (const child of raw.children) {
    if (child.familyId !== raw.familyId) {
      throw new RepairInputValidationError(
        `Child ${child.id} belongs to family ${child.familyId}, expected ${raw.familyId}`,
      );
    }
  }

  // Validate overlays
  validateOverlays({
    activeSchedule: raw.activeSchedule,
    overlays: raw.disruptionOverlays,
    parents: raw.parents,
    children: raw.children,
  });

  // Apply overlays
  const { overlaidSchedule, overlayImpacts } = applyOverlays({
    activeSchedule: raw.activeSchedule,
    overlays: raw.disruptionOverlays,
  });

  // Derive repair window
  const repairWindow = buildRepairWindow({
    activeSchedule: raw.activeSchedule,
    overlays: raw.disruptionOverlays,
    maxRepairDays: raw.solverConfig.maxRepairDays,
    requestedWindow: raw.repairWindow,
  });

  // Calculate drift
  const driftSummary = calculateOverlayDrift({
    activeSchedule: raw.activeSchedule,
    overlaidSchedule,
    overlays: raw.disruptionOverlays,
    fixedHolidayAssignments: raw.fixedHolidayAssignments,
  });

  // Expand days in repair window
  const days = expandDays(repairWindow);

  // Sort deterministically
  const parentIds = raw.parents.map(p => p.id as string).sort();
  const childIds = raw.children.map(c => c.id as string).sort();
  const parents = [...raw.parents].sort((a, b) => (a.id as string).localeCompare(b.id as string));
  const children = [...raw.children].sort((a, b) => (a.id as string).localeCompare(b.id as string));
  const activePolicies = [...raw.activePolicies].sort((a, b) => {
    const pt = a.priority.localeCompare(b.priority);
    if (pt !== 0) return pt;
    const rt = a.ruleType.localeCompare(b.ruleType);
    if (rt !== 0) return rt;
    return a.id.localeCompare(b.id);
  });

  // Build lookups
  const activeNightLookup = new Map<string, string>();
  for (const n of raw.activeSchedule.nights) {
    activeNightLookup.set(`${n.date}:${n.childId}`, n.parentId);
  }

  const overlaidNightLookup = new Map<string, string>();
  for (const n of overlaidSchedule.nights) {
    overlaidNightLookup.set(`${n.date}:${n.childId}`, n.parentId);
  }

  // Overlay-fixed slots
  const overlayFixedSlots = new Set<string>();
  for (const overlay of raw.disruptionOverlays) {
    overlayFixedSlots.add(`${overlay.date}:${overlay.childId}`);
  }

  // Fixed holiday assignments
  const fixedHolidayAssignments = new Map<string, string>();
  const holidayDateSet = new Set<string>();
  if (raw.fixedHolidayAssignments) {
    for (const ha of raw.fixedHolidayAssignments) {
      holidayDateSet.add(ha.date);
      for (const childId of ha.childIds) {
        fixedHolidayAssignments.set(`${ha.date}:${childId}`, ha.assignedParentId);
      }
    }
  }

  // Mark holidays on days
  for (const day of days) {
    if (holidayDateSet.has(day.date)) {
      day.isHoliday = true;
    }
  }

  const fairnessState: FairnessState = raw.fairnessState ?? { byParentId: {} };

  return {
    familyId: raw.familyId,
    activeSchedule: raw.activeSchedule,
    overlaidSchedule,
    overlayImpacts,
    repairWindow,
    days,
    parentIds,
    childIds,
    parents,
    children,
    activePolicies,
    fairnessState,
    driftSummary,
    activeNightLookup,
    overlaidNightLookup,
    overlayFixedSlots,
    fixedHolidayAssignments,
    holidayDateSet,
    config: { ...raw.solverConfig },
  };
}

function expandDays(window: RepairWindow): DayInfo[] {
  const days: DayInfo[] = [];
  let current = DateTime.fromISO(window.startDate);
  const end = DateTime.fromISO(window.endDate);
  let index = 0;

  while (current <= end) {
    const weekday = current.weekday;
    const isWeekend = weekday === 5 || weekday === 6;
    days.push({
      date: current.toISODate()!,
      index,
      weekday,
      isWeekend,
      isHoliday: false,
    });
    current = current.plus({ days: 1 });
    index++;
  }

  return days;
}
