// ─── Default Disruption Policies ──────────────────────────────────────
//
// Deterministic default policy table mapping all 23 event types to actions.
//
// Rules from spec:
// - Rule A: Base schedule sovereignty — normal schedule applies unless overridden
// - Rule B: Logistics fallback for closed exchange locations (school/daycare)
// - Rule C: School-night depends on tomorrow (not today)
// - Rule D: Short disruption bias ≤72h — keep current assignment, logistics only
// - Rule E: Long disruption >72h — generate proposals for rebalancing
// - Illness handling: decision tree per spec 11.6

import {
  DisruptionEventType,
  OverlayActionType,
  OverrideStrength,
  PolicySource,
} from '../enums';
import type { OverlayPolicy, PromptingRules, FairnessAccounting } from './types';

// ─── Default Prompting / Fairness ─────────────────────────────────────

const DEFAULT_PROMPTING: PromptingRules = {
  leadTimeHours: 24,
  suppressPrompt: false,
  maxAutoApply: 0,
};

const AUTO_PROMPTING: PromptingRules = {
  leadTimeHours: 0,
  suppressPrompt: true,
  maxAutoApply: 999,
};

const DEFAULT_FAIRNESS: FairnessAccounting = {
  countsTowardFairness: true,
  createCompensatory: false,
  maxCompensatoryDays: 0,
};

const COMPENSATORY_FAIRNESS: FairnessAccounting = {
  countsTowardFairness: false,
  createCompensatory: true,
  maxCompensatoryDays: 3,
};

// ─── Default Policy Table ─────────────────────────────────────────────

export interface DefaultPolicyEntry {
  eventType: DisruptionEventType;
  actionType: OverlayActionType;
  defaultStrength: OverrideStrength;
  promptingRules: PromptingRules;
  fairnessAccounting: FairnessAccounting;
  description: string;
}

/**
 * Deterministic default policy for each disruption event type.
 * These serve as the global fallback (PolicySource.GLOBAL_DEFAULT).
 */
export const DEFAULT_POLICIES: DefaultPolicyEntry[] = [
  {
    // Rule B: School closed → logistics fallback (find alternative handoff)
    eventType: DisruptionEventType.PUBLIC_HOLIDAY,
    actionType: OverlayActionType.LOGISTICS_FALLBACK,
    defaultStrength: OverrideStrength.LOGISTICS_ONLY,
    promptingRules: AUTO_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'Public holiday: keep assignment, adjust exchange location',
  },
  {
    eventType: DisruptionEventType.SCHOOL_CLOSED,
    actionType: OverlayActionType.LOGISTICS_FALLBACK,
    defaultStrength: OverrideStrength.LOGISTICS_ONLY,
    promptingRules: AUTO_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'School closed: keep assignment, use alternative exchange',
  },
  {
    eventType: DisruptionEventType.SCHOOL_HALF_DAY,
    actionType: OverlayActionType.LOGISTICS_FALLBACK,
    defaultStrength: OverrideStrength.LOGISTICS_ONLY,
    promptingRules: AUTO_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'Half day: adjust pickup time, keep assignment',
  },
  {
    eventType: DisruptionEventType.EMERGENCY_CLOSURE,
    actionType: OverlayActionType.LOGISTICS_FALLBACK,
    defaultStrength: OverrideStrength.SOFT,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'Emergency closure: logistics fallback, prompt for confirmation',
  },
  {
    // Illness decision tree — spec 11.6
    eventType: DisruptionEventType.CHILD_SICK,
    actionType: OverlayActionType.DELAY_EXCHANGE,
    defaultStrength: OverrideStrength.SOFT,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Child sick: delay exchange, compensate after recovery',
  },
  {
    eventType: DisruptionEventType.CAREGIVER_SICK,
    actionType: OverlayActionType.BLOCK_ASSIGNMENT,
    defaultStrength: OverrideStrength.HARD,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Caregiver sick: block assignment to affected parent',
  },
  {
    eventType: DisruptionEventType.PARENT_TRAVEL,
    actionType: OverlayActionType.BLOCK_ASSIGNMENT,
    defaultStrength: OverrideStrength.HARD,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Parent travel: block assignment, compensate after return',
  },
  {
    eventType: DisruptionEventType.TRANSPORT_FAILURE,
    actionType: OverlayActionType.LOGISTICS_FALLBACK,
    defaultStrength: OverrideStrength.LOGISTICS_ONLY,
    promptingRules: AUTO_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'Transport failure: find alternative exchange method',
  },
  {
    eventType: DisruptionEventType.FAMILY_EVENT,
    actionType: OverlayActionType.NO_OVERRIDE,
    defaultStrength: OverrideStrength.NONE,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'Family event: no automatic override, prompt user',
  },
  {
    // Rule D: Short disruption ≤72h — block specific days
    eventType: DisruptionEventType.CAMP_WEEK,
    actionType: OverlayActionType.BLOCK_ASSIGNMENT,
    defaultStrength: OverrideStrength.HARD,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Camp week: block assignment for camp duration',
  },
  {
    // Rule E: Long disruption — generate proposals
    eventType: DisruptionEventType.BREAK,
    actionType: OverlayActionType.GENERATE_PROPOSALS,
    defaultStrength: OverrideStrength.SOFT,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'School break: generate rebalancing proposals',
  },
  {
    eventType: DisruptionEventType.SUMMER_PERIOD,
    actionType: OverlayActionType.GENERATE_PROPOSALS,
    defaultStrength: OverrideStrength.SOFT,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Summer: generate rebalancing proposals',
  },
  {
    eventType: DisruptionEventType.OTHER_DECLARED,
    actionType: OverlayActionType.NO_OVERRIDE,
    defaultStrength: OverrideStrength.NONE,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'Other: no automatic override, prompt user',
  },
  // ─── Phase 1: 10 new event types ──────────────────────────────────────
  {
    eventType: DisruptionEventType.WORK_SHIFT_CHANGE,
    actionType: OverlayActionType.BLOCK_ASSIGNMENT,
    defaultStrength: OverrideStrength.HARD,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Work shift change: block affected nights, compensate',
  },
  {
    eventType: DisruptionEventType.EMERGENCY_WORK_CALL,
    actionType: OverlayActionType.DELAY_EXCHANGE,
    defaultStrength: OverrideStrength.SOFT,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Emergency work call: delay exchange until available',
  },
  {
    eventType: DisruptionEventType.HOSPITALIZATION,
    actionType: OverlayActionType.BLOCK_ASSIGNMENT,
    defaultStrength: OverrideStrength.HARD,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Hospitalization: block assignment to hospitalized parent',
  },
  {
    eventType: DisruptionEventType.SCHOOL_TRIP,
    actionType: OverlayActionType.BLOCK_ASSIGNMENT,
    defaultStrength: OverrideStrength.HARD,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'School trip: block assignment for trip duration',
  },
  {
    eventType: DisruptionEventType.HOLIDAY_TRAVEL,
    actionType: OverlayActionType.GENERATE_PROPOSALS,
    defaultStrength: OverrideStrength.SOFT,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Holiday travel: generate rebalancing proposals',
  },
  {
    eventType: DisruptionEventType.WEATHER_EMERGENCY,
    actionType: OverlayActionType.LOGISTICS_FALLBACK,
    defaultStrength: OverrideStrength.SOFT,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'Weather emergency: logistics fallback, prompt for confirmation',
  },
  {
    eventType: DisruptionEventType.FLIGHT_DELAY,
    actionType: OverlayActionType.DELAY_EXCHANGE,
    defaultStrength: OverrideStrength.SOFT,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Flight delay: delay exchange until arrival',
  },
  {
    eventType: DisruptionEventType.FUNERAL,
    actionType: OverlayActionType.BLOCK_ASSIGNMENT,
    defaultStrength: OverrideStrength.HARD,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: COMPENSATORY_FAIRNESS,
    description: 'Funeral: block assignment for attending parent',
  },
  {
    eventType: DisruptionEventType.POWER_OUTAGE,
    actionType: OverlayActionType.LOGISTICS_FALLBACK,
    defaultStrength: OverrideStrength.LOGISTICS_ONLY,
    promptingRules: AUTO_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'Power outage: logistics fallback, use alternative location',
  },
  {
    eventType: DisruptionEventType.HOME_REPAIR,
    actionType: OverlayActionType.LOGISTICS_FALLBACK,
    defaultStrength: OverrideStrength.LOGISTICS_ONLY,
    promptingRules: AUTO_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'Home repair: logistics fallback, use alternative location',
  },
];

/**
 * Look up the default policy for an event type.
 */
export function getDefaultPolicy(eventType: DisruptionEventType): DefaultPolicyEntry {
  const found = DEFAULT_POLICIES.find((p) => p.eventType === eventType);
  if (found) return found;

  // Safe fallback: no override, prompt user
  return {
    eventType,
    actionType: OverlayActionType.NO_OVERRIDE,
    defaultStrength: OverrideStrength.NONE,
    promptingRules: DEFAULT_PROMPTING,
    fairnessAccounting: DEFAULT_FAIRNESS,
    description: 'Unknown event: no automatic override',
  };
}

/**
 * Illness decision tree (spec 11.6):
 * - Short (≤72h): keep current assignment, delay exchange
 * - Exchange day: delay to next non-sick day
 * - Long (>72h): generate proposals for rebalancing
 */
export function resolveIllnessAction(
  durationHours: number,
  isExchangeDay: boolean,
): OverlayActionType {
  if (durationHours <= 72) {
    if (isExchangeDay) {
      return OverlayActionType.DELAY_EXCHANGE;
    }
    return OverlayActionType.NO_OVERRIDE;
  }
  return OverlayActionType.GENERATE_PROPOSALS;
}
