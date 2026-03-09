import { DateTime } from 'luxon';
import {
  SolverInput,
  NormalizedSolverInput,
  DayInfo,
  FairnessState,
} from '../types';
import { SolverInputValidationError } from '../errors';

/**
 * Builds a normalized, validated solver input from raw input.
 * All outputs are deterministically sorted for reproducibility.
 */
export function buildSolverInput(raw: SolverInput): NormalizedSolverInput {
  validateWindow(raw);
  validateFamilyCoherence(raw);
  validateFixedHolidayAssignments(raw);

  const days = expandDays(raw);
  const parentIds = raw.parents.map(p => p.id).sort();
  const childIds = raw.children.map(c => c.id).sort();
  const parents = [...raw.parents].sort((a, b) => a.id.localeCompare(b.id));
  const children = [...raw.children].sort((a, b) => a.id.localeCompare(b.id));
  const activePolicies = [...raw.activePolicies].sort((a, b) => {
    const pt = a.priority.localeCompare(b.priority);
    if (pt !== 0) return pt;
    const rt = a.ruleType.localeCompare(b.ruleType);
    if (rt !== 0) return rt;
    return a.id.localeCompare(b.id);
  });

  // Build baseline lookups
  const baselineNightLookup = new Map<string, string>();
  const baselineExchangeLookup = new Set<string>();
  if (raw.baselineSchedule) {
    for (const night of raw.baselineSchedule.nights) {
      baselineNightLookup.set(`${night.date}:${night.childId}`, night.parentId);
    }
    for (const exchange of raw.baselineSchedule.exchanges) {
      baselineExchangeLookup.add(`${exchange.date}:${exchange.childId}`);
    }
  }

  // Build fixed assignment lookups and holiday date set
  const fixedAssignments = new Map<string, string>();
  const holidayDateSet = new Set<string>();
  if (raw.fixedHolidayAssignments) {
    for (const ha of raw.fixedHolidayAssignments) {
      holidayDateSet.add(ha.date);
      for (const childId of ha.childIds) {
        fixedAssignments.set(`${ha.date}:${childId}`, ha.assignedParentId);
      }
    }
  }

  // Mark holiday days
  for (const day of days) {
    if (holidayDateSet.has(day.date)) {
      day.isHoliday = true;
      const ha = raw.fixedHolidayAssignments?.find(h => h.date === day.date);
      if (ha) day.holidayLabel = ha.label;
    }
  }

  const fairnessState: FairnessState = raw.fairnessState ?? { byParentId: {} };

  return {
    familyId: raw.familyId,
    window: { ...raw.window },
    days,
    parentIds,
    childIds,
    parents,
    children,
    activePolicies,
    fairnessState,
    baselineNightLookup,
    baselineExchangeLookup,
    fixedAssignments,
    holidayDateSet,
    config: { ...raw.solverConfig },
  };
}

function validateWindow(raw: SolverInput): void {
  const { startDate, endDate } = raw.window;
  if (!startDate || !endDate) {
    throw new SolverInputValidationError('Planning window must have startDate and endDate');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new SolverInputValidationError('Planning window dates must be YYYY-MM-DD');
  }
  if (startDate > endDate) {
    throw new SolverInputValidationError('Planning window startDate must be <= endDate');
  }
  const start = DateTime.fromISO(startDate);
  const end = DateTime.fromISO(endDate);
  if (!start.isValid || !end.isValid) {
    throw new SolverInputValidationError('Planning window dates must be valid dates');
  }
}

function validateFamilyCoherence(raw: SolverInput): void {
  if (!raw.familyId) {
    throw new SolverInputValidationError('familyId is required');
  }
  if (raw.parents.length === 0) {
    throw new SolverInputValidationError('At least one parent is required');
  }
  if (raw.children.length === 0) {
    throw new SolverInputValidationError('At least one child is required');
  }
  for (const parent of raw.parents) {
    if (parent.familyId !== raw.familyId) {
      throw new SolverInputValidationError(
        `Parent ${parent.id} belongs to family ${parent.familyId}, expected ${raw.familyId}`,
      );
    }
  }
  for (const child of raw.children) {
    if (child.familyId !== raw.familyId) {
      throw new SolverInputValidationError(
        `Child ${child.id} belongs to family ${child.familyId}, expected ${raw.familyId}`,
      );
    }
  }
}

function validateFixedHolidayAssignments(raw: SolverInput): void {
  if (!raw.fixedHolidayAssignments) return;
  const parentIdSet = new Set(raw.parents.map(p => p.id as string));
  const childIdSet = new Set(raw.children.map(c => c.id as string));

  for (const ha of raw.fixedHolidayAssignments) {
    if (!parentIdSet.has(ha.assignedParentId)) {
      throw new SolverInputValidationError(
        `Fixed holiday "${ha.label}" references unknown parent ${ha.assignedParentId}`,
      );
    }
    for (const childId of ha.childIds) {
      if (!childIdSet.has(childId)) {
        throw new SolverInputValidationError(
          `Fixed holiday "${ha.label}" references unknown child ${childId}`,
        );
      }
    }
    if (ha.date < raw.window.startDate || ha.date > raw.window.endDate) {
      // Holiday outside window — silently skip (not an error)
      continue;
    }
  }
}

function expandDays(raw: SolverInput): DayInfo[] {
  const days: DayInfo[] = [];
  let current = DateTime.fromISO(raw.window.startDate);
  const end = DateTime.fromISO(raw.window.endDate);
  let index = 0;

  while (current <= end) {
    const weekday = current.weekday; // 1=Mon..7=Sun
    // Weekend: Friday (5) and Saturday (6) nights
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
