/**
 * Local schedule generation engine for the scenario lab.
 * Generates deterministic schedules from family config + constraints
 * without requiring the Python optimizer (runs entirely in-browser).
 */

import { DisruptionEventType } from '@adcp/shared';
import type {
  FamilyConfig,
  ConstraintConfig,
  DisruptionEntry,
  ScheduleDay,
  MetricsSnapshot,
  SolverTrace,
} from '../../stores/scenario';

const DAYS_TO_GENERATE = 84; // 12 weeks

/**
 * Generate a deterministic schedule based on config.
 * Uses a simple alternating-block pattern modulated by constraints.
 */
export function generateSchedule(
  family: FamilyConfig,
  constraints: ConstraintConfig,
  disruptions: DisruptionEntry[],
  startDate: string,
): { schedule: ScheduleDay[]; metrics: MetricsSnapshot; trace: SolverTrace } {
  const start = Date.now();
  const days: ScheduleDay[] = [];
  const blockSize = Math.min(constraints.maxConsecutive, 7);
  const disruptionMap = buildDisruptionMap(disruptions);

  let currentParent: 'parent_a' | 'parent_b' = 'parent_a';
  let consecutiveCount = 0;

  for (let i = 0; i < DAYS_TO_GENERATE; i++) {
    const date = addDays(startDate, i);
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const disruption = disruptionMap.get(date);

    // Check locked nights
    const lockedParent = constraints.lockedNights[String(dayOfWeek)];
    let assignedTo: 'parent_a' | 'parent_b' = currentParent;
    let source: ScheduleDay['source'] = 'template';
    let isLocked = false;

    if (disruption) {
      // Disruption override
      if (disruption.affectedParent === 'parent_a') {
        assignedTo = 'parent_b';
      } else if (disruption.affectedParent === 'parent_b') {
        assignedTo = 'parent_a';
      }
      source = 'disruption';
      isLocked = true;
    } else if (lockedParent) {
      assignedTo = lockedParent as 'parent_a' | 'parent_b';
      source = 'solver';
      isLocked = true;
    } else {
      // Apply block pattern
      if (consecutiveCount >= blockSize) {
        currentParent = currentParent === 'parent_a' ? 'parent_b' : 'parent_a';
        consecutiveCount = 0;
      }
      assignedTo = currentParent;
    }

    // Check if this is a handoff (parent changes from previous day)
    const prevDay = days[days.length - 1];
    const isHandoff = prevDay != null && prevDay.assignedTo !== assignedTo;

    days.push({
      date,
      assignedTo,
      isHandoff,
      disruption: disruption?.type,
      isLocked,
      source,
    });

    if (assignedTo === currentParent) {
      consecutiveCount++;
    } else {
      currentParent = assignedTo;
      consecutiveCount = 1;
    }
  }

  // Apply max transitions per week constraint (post-process)
  applyTransitionCap(days, constraints.maxTransitionsPerWeek);

  const metrics = computeMetrics(days);
  const duration = Date.now() - start;

  const trace: SolverTrace = {
    runId: 0, // caller sets this
    timestamp: new Date().toISOString(),
    status: 'optimal',
    penaltyScore: computePenalty(days, constraints, family),
    tieBreakRanking: ['fairness', 'stability', 'transitions', 'consecutive', 'weekend', 'template'],
    selectedTemplate: blockSize <= 3 ? '2-2-3' : blockSize <= 5 ? '5-2' : '7on7off',
    durationMs: duration,
  };

  return { schedule: days, metrics, trace };
}

function buildDisruptionMap(disruptions: DisruptionEntry[]): Map<string, DisruptionEntry> {
  const map = new Map<string, DisruptionEntry>();
  for (const d of disruptions) {
    let current = d.startDate;
    while (current <= d.endDate) {
      map.set(current, d);
      current = addDays(current, 1);
    }
  }
  return map;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function applyTransitionCap(days: ScheduleDay[], maxPerWeek: number): void {
  for (let weekStart = 0; weekStart < days.length; weekStart += 7) {
    const weekEnd = Math.min(weekStart + 7, days.length);
    let transitions = 0;
    for (let i = weekStart + 1; i < weekEnd; i++) {
      if (days[i].assignedTo !== days[i - 1].assignedTo) {
        transitions++;
        if (transitions > maxPerWeek && !days[i].isLocked) {
          days[i].assignedTo = days[i - 1].assignedTo;
          days[i].isHandoff = false;
          days[i].source = 'solver';
        }
      }
    }
  }
}

export function computeMetrics(days: ScheduleDay[]): MetricsSnapshot {
  let parentANights = 0;
  let parentBNights = 0;
  let totalTransitions = 0;
  let maxConsecutiveA = 0;
  let maxConsecutiveB = 0;
  let currentStreakA = 0;
  let currentStreakB = 0;
  let weekendA = 0;
  let weekendB = 0;
  let weekendTotal = 0;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day.assignedTo === 'parent_a') {
      parentANights++;
      currentStreakA++;
      currentStreakB = 0;
      maxConsecutiveA = Math.max(maxConsecutiveA, currentStreakA);
    } else {
      parentBNights++;
      currentStreakB++;
      currentStreakA = 0;
      maxConsecutiveB = Math.max(maxConsecutiveB, currentStreakB);
    }

    if (i > 0 && days[i].assignedTo !== days[i - 1].assignedTo) {
      totalTransitions++;
    }

    const dow = new Date(day.date + 'T00:00:00').getDay();
    if (dow === 0 || dow === 6) {
      weekendTotal++;
      if (day.assignedTo === 'parent_a') weekendA++;
      else weekendB++;
    }
  }

  const total = parentANights + parentBNights;
  const weeks = Math.max(1, Math.floor(days.length / 7));

  return {
    parentANights,
    parentBNights,
    parentAPercent: total > 0 ? Math.round((parentANights / total) * 1000) / 10 : 50,
    transitionsPerWeek: Math.round((totalTransitions / weeks) * 10) / 10,
    maxConsecutiveA,
    maxConsecutiveB,
    weekendBalanceA: weekendTotal > 0 ? Math.round((weekendA / weekendTotal) * 100) : 50,
    weekendBalanceB: weekendTotal > 0 ? Math.round((weekendB / weekendTotal) * 100) : 50,
    stabilityScore: computeStability(days),
  };
}

function computeStability(days: ScheduleDay[]): number {
  if (days.length < 14) return 0;
  // Compare first 2 weeks to last 2 weeks
  const first14 = days.slice(0, 14).map((d) => d.assignedTo);
  const last14 = days.slice(-14).map((d) => d.assignedTo);
  let matches = 0;
  for (let i = 0; i < 14; i++) {
    if (first14[i] === last14[i]) matches++;
  }
  return Math.round((matches / 14) * 100) / 100;
}

function computePenalty(
  days: ScheduleDay[],
  constraints: ConstraintConfig,
  family: FamilyConfig,
): number {
  let penalty = 0;
  const metrics = computeMetrics(days);

  // Fairness penalty
  const drift = Math.abs(metrics.parentAPercent - family.targetSplit);
  penalty += drift * 10;

  // Transition penalty
  penalty += Math.max(0, metrics.transitionsPerWeek - constraints.maxTransitionsPerWeek) * 50;

  // Consecutive penalty
  penalty += Math.max(0, metrics.maxConsecutiveA - constraints.maxConsecutive) * 30;
  penalty += Math.max(0, metrics.maxConsecutiveB - constraints.maxConsecutive) * 30;

  return Math.round(penalty);
}

/**
 * Parse a natural language message into a structured intent.
 */
export function parseNaturalLanguage(text: string): {
  type: string;
  dateRange?: string;
  parent?: string;
  confidence: number;
  action: string;
  explanation: string;
} {
  const lower = text.toLowerCase();

  if (/i need coverage|need someone|can.+take/.test(lower)) {
    const dateMatch = lower.match(/(?:this |next )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)/);
    return {
      type: 'NEED_COVERAGE',
      dateRange: dateMatch?.[0] ?? 'unspecified',
      parent: 'requesting_parent',
      confidence: 0.89,
      action: 'Generate coverage proposals',
      explanation: 'Parent is requesting coverage. System will generate 3 deterministic proposals with compensation days.',
    };
  }

  if (/i have the kids|kids are with me|they.re (here|with me)/.test(lower)) {
    return {
      type: 'CONFIRM_CUSTODY',
      parent: 'speaking_parent',
      confidence: 0.92,
      action: 'Acknowledge current state',
      explanation: 'Parent confirming current custody. No schedule change needed.',
    };
  }

  if (/school.*(closed|closure|no school)|no school/.test(lower)) {
    const dayMatch = lower.match(/(monday|tuesday|wednesday|thursday|friday|today|tomorrow)/);
    return {
      type: 'SCHOOL_CLOSED',
      dateRange: dayMatch?.[0] ?? 'unspecified',
      confidence: 0.94,
      action: 'Create disruption event',
      explanation: 'School closure detected. Disruption overlay will be applied to schedule.',
    };
  }

  if (/swap|switch|trade/.test(lower)) {
    return {
      type: 'SWAP_REQUEST',
      confidence: 0.85,
      action: 'Generate swap proposals',
      explanation: 'Swap request detected. System will generate balanced swap options.',
    };
  }

  if (/(he|she|dad|mom|father|mother) (will|can|should) take/.test(lower)) {
    return {
      type: 'ASSIGN_TIME',
      parent: 'other_parent',
      confidence: 0.78,
      action: 'Create time assignment request',
      explanation: 'Parent suggesting the other parent takes custody. Requires other parent confirmation.',
    };
  }

  if (/weekend|extra time|more time|want.*time/.test(lower)) {
    return {
      type: 'WANT_TIME',
      confidence: 0.82,
      action: 'Generate extra time proposals',
      explanation: 'Extra time request. System will check budget and generate fair proposals.',
    };
  }

  return {
    type: 'UNKNOWN',
    confidence: 0.3,
    action: 'No action — unrecognized intent',
    explanation: 'Could not parse a scheduling intent from this message.',
  };
}

/**
 * Chaos mode: generate random disruptions and requests over a period.
 */
export function generateChaosEvents(
  startDate: string,
  daysCount: number,
): DisruptionEntry[] {
  const disruptionTypes = [
    DisruptionEventType.SCHOOL_CLOSED,
    DisruptionEventType.CHILD_SICK,
    DisruptionEventType.PARENT_TRAVEL,
    DisruptionEventType.WEATHER_EMERGENCY,
    DisruptionEventType.CAMP_WEEK,
    DisruptionEventType.PUBLIC_HOLIDAY,
    DisruptionEventType.TRANSPORT_FAILURE,
  ];

  const disruptions: DisruptionEntry[] = [];
  // Seed-based pseudo-random for determinism
  let seed = hashString(startDate + daysCount);

  for (let day = 0; day < daysCount; day++) {
    seed = nextRandom(seed);
    // ~15% chance of disruption on any day
    if ((seed % 100) < 15) {
      const typeIdx = seed % disruptionTypes.length;
      const type = disruptionTypes[typeIdx];
      const date = addDays(startDate, day);
      seed = nextRandom(seed);
      const duration = type === DisruptionEventType.PARENT_TRAVEL
        ? 2 + (seed % 5)
        : type === DisruptionEventType.CAMP_WEEK
          ? 5 + (seed % 3)
          : 1 + (seed % 2);
      const endDate = addDays(date, duration - 1);

      disruptions.push({
        id: `chaos-${day}`,
        type,
        startDate: date,
        endDate,
        affectedParent: (seed % 2 === 0) ? 'parent_a' : 'parent_b',
        description: `Chaos: ${type}`,
      });

      // Skip ahead to avoid overlapping disruptions
      day += duration;
    }
  }

  return disruptions;
}

function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function nextRandom(seed: number): number {
  seed = ((seed * 1103515245) + 12345) & 0x7fffffff;
  return seed;
}
