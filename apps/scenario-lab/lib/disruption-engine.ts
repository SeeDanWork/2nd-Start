// ── Disruption Engine ────────────────────────────────────────
// Deterministic disruption state machine.
// Disruptions originate from ONE parent, not the system.
// No autonomous scheduling. No broadcast messages.
//
// Flow: parent intent → disruption report → coverage request
//       → solver proposals → parent decision → resolution

import { createHash } from 'crypto';
import { ScenarioConfig, ScheduleDay } from './types';

// ── Disruption Types ──

export type DisruptionEventType =
  | 'parent_sick'
  | 'child_sick'
  | 'work_emergency'
  | 'transport_failure'
  | 'school_closure'
  | 'family_emergency'
  | 'schedule_conflict'
  | 'other';

export type DisruptionDuration =
  | 'today_only'
  | '2_3_days'
  | 'unknown'
  | 'week';

export type CoverageType =
  | 'full_custody_transfer'
  | 'partial_day_coverage'
  | 'transport_assistance'
  | 'temporary_logistics_swap';

// ── State Machine ──

export type DisruptionState =
  | 'DISRUPTION_REPORTED'
  | 'DURATION_ASKED'
  | 'COVERAGE_REQUESTED'
  | 'PROPOSALS_GENERATED'
  | 'PARENT_RESPONSE_PENDING'
  | 'RESOLUTION_APPLIED'
  | 'FOLLOWUP_PENDING'
  | 'RESOLVED';

export interface ActiveDisruption {
  id: string;
  state: DisruptionState;
  eventType: DisruptionEventType;
  reportingParent: 'parent_a' | 'parent_b';
  otherParent: 'parent_a' | 'parent_b';
  duration: DisruptionDuration | null;
  coverageType: CoverageType | null;
  reportedAt: string;
  affectedDays: string[];        // ISO date strings
  proposals: ProposalBundle | null;
  selectedProposalId: string | null;
  resolvedAt: string | null;
}

// ── Proposal Bundle ──

export interface ProposalOption {
  id: string;
  label: string;
  description: string;
  coverageDays: Array<{ date: string; parent: 'parent_a' | 'parent_b'; type: CoverageType }>;
  compensationDays: Array<{ date: string; parent: 'parent_a' | 'parent_b' }>;
  fairnessImpact: { parentADelta: number; parentBDelta: number };
  transitionImpact: number;    // change in transitions this week
  routineImpact: 'none' | 'minor' | 'moderate';
}

export interface ProposalBundle {
  disruptionId: string;
  options: ProposalOption[];
  generatedAt: string;
}

// ── Idempotency ──

export function computeDisruptionId(
  parentId: 'parent_a' | 'parent_b',
  eventType: DisruptionEventType,
  date: string,
): string {
  return createHash('sha256')
    .update(`${parentId}:${eventType}:${date}`)
    .digest('hex')
    .slice(0, 16);
}

export function isDuplicateDisruption(
  activeDisruptions: ActiveDisruption[],
  parentId: 'parent_a' | 'parent_b',
  eventType: DisruptionEventType,
  date: string,
): boolean {
  const id = computeDisruptionId(parentId, eventType, date);
  return activeDisruptions.some(d => d.id === id && d.state !== 'RESOLVED');
}

// ── Create Disruption ──

export function createDisruption(
  reportingParent: 'parent_a' | 'parent_b',
  eventType: DisruptionEventType,
  date: string,
): ActiveDisruption {
  return {
    id: computeDisruptionId(reportingParent, eventType, date),
    state: 'DISRUPTION_REPORTED',
    eventType,
    reportingParent,
    otherParent: reportingParent === 'parent_a' ? 'parent_b' : 'parent_a',
    duration: null,
    coverageType: null,
    reportedAt: new Date().toISOString(),
    affectedDays: [],
    proposals: null,
    selectedProposalId: null,
    resolvedAt: null,
  };
}

// ── State Transitions ──

export function setDuration(
  disruption: ActiveDisruption,
  duration: DisruptionDuration,
  schedule: ScheduleDay[],
  currentDay: number,
): ActiveDisruption {
  const today = schedule[currentDay];
  if (!today) return { ...disruption, duration, state: 'DURATION_ASKED' };

  // Compute affected days based on duration
  const affectedDays: string[] = [];
  const startDate = new Date(today.date);

  const dayCount = duration === 'today_only' ? 1
    : duration === '2_3_days' ? 3
    : duration === 'week' ? 7
    : 3; // unknown defaults to 3

  for (let i = 0; i < dayCount && currentDay + i < schedule.length; i++) {
    affectedDays.push(schedule[currentDay + i].date);
  }

  return {
    ...disruption,
    duration,
    affectedDays,
    state: 'COVERAGE_REQUESTED',
  };
}

export function attachProposals(
  disruption: ActiveDisruption,
  proposals: ProposalBundle,
): ActiveDisruption {
  return {
    ...disruption,
    proposals,
    state: 'PROPOSALS_GENERATED',
  };
}

export function selectProposal(
  disruption: ActiveDisruption,
  proposalId: string,
): ActiveDisruption {
  return {
    ...disruption,
    selectedProposalId: proposalId,
    state: 'RESOLUTION_APPLIED',
  };
}

export function declineAllProposals(
  disruption: ActiveDisruption,
): ActiveDisruption {
  return {
    ...disruption,
    state: 'RESOLUTION_APPLIED', // falls back to base schedule
    selectedProposalId: null,
  };
}

export function markFollowupPending(
  disruption: ActiveDisruption,
): ActiveDisruption {
  return { ...disruption, state: 'FOLLOWUP_PENDING' };
}

export function resolveDisruption(
  disruption: ActiveDisruption,
): ActiveDisruption {
  return {
    ...disruption,
    state: 'RESOLVED',
    resolvedAt: new Date().toISOString(),
  };
}

// ── Event Type Classification ──

const EVENT_KEYWORDS: Record<DisruptionEventType, RegExp[]> = {
  parent_sick: [/sick/i, /ill/i, /not feeling well/i, /fever/i, /flu/i, /covid/i, /unwell/i],
  child_sick: [/child.*sick/i, /kid.*sick/i, /threw up/i, /vomit/i, /child.*ill/i, /child.*fever/i],
  work_emergency: [/work/i, /meeting/i, /business trip/i, /called in/i, /overtime/i, /deadline/i],
  transport_failure: [/car broke/i, /flat tire/i, /no ride/i, /transport/i, /can't drive/i, /vehicle/i],
  school_closure: [/school.*closed/i, /snow day/i, /school.*cancel/i, /no school/i],
  family_emergency: [/emergency/i, /hospital/i, /accident/i, /urgent/i, /family.*crisis/i],
  schedule_conflict: [/conflict/i, /double.?book/i, /can't make/i, /overlap/i],
  other: [/.*/],
};

export function classifyDisruptionType(text: string): DisruptionEventType {
  const lower = text.toLowerCase();
  for (const [type, patterns] of Object.entries(EVENT_KEYWORDS)) {
    if (type === 'other') continue;
    if (patterns.some(p => p.test(lower))) {
      return type as DisruptionEventType;
    }
  }
  return 'other';
}

// ── Event Type Labels ──

export const DISRUPTION_LABELS: Record<DisruptionEventType, string> = {
  parent_sick: 'Parent illness',
  child_sick: 'Child illness',
  work_emergency: 'Work emergency',
  transport_failure: 'Transport issue',
  school_closure: 'School closure',
  family_emergency: 'Family emergency',
  schedule_conflict: 'Schedule conflict',
  other: 'Schedule disruption',
};
