// ─── Milestone Computation ────────────────────────────────────────
//
// Computes 6 deterministic snapshots of the recommendation pipeline
// as children age: Start, +2 weeks, +3 months, +6 months, +1 year, +2 years.
// Each snapshot includes full context: recommendation, overlays, schedule, presets.

import type {
  BaselineRecommendationInputV2,
  BaselineRecommendationOutputV2,
  AgeBandV2,
  TemplateScoreV2,
  FamilyContextDefaults,
  DisruptionOverlayResult,
  SolverPayloadOverlay,
  PresetOutput,
  DisruptionEvent,
  CurrentAssignment,
} from '@adcp/shared';
import {
  birthdateToAgeBand,
  getChildDefaults,
  youngestBand,
  adjustMaxConsecutive,
  computeMultiChildScoring,
  recommendBaselineV2,
  computePresetRecommendations,
  resolvePolicy,
  getDefaultPolicy,
  computeOverlay,
  toSolverPayload,
  BAND_TO_PROFILE,
  AGE_WEIGHT_MULTIPLIERS,
  LIVING_ARRANGEMENT_WEIGHT_MULTIPLIERS,
  DEFAULT_SOLVER_WEIGHTS,
  TEMPLATES_V2,
  generateRationale,
  getDisclaimers,
  LivingArrangement,
  PolicySource,
} from '@adcp/shared';
import type { SolverWeightProfile } from '@adcp/shared';
import type { ScheduleDay } from './DeterministicSchedule';

// ─── Types ────────────────────────────────────────────────────────

export interface MilestoneOffset {
  label: string;
  days: number;
}

export interface ChildSnapshot {
  childId: string;
  hasBirthdate: boolean;
  ageBand: AgeBandV2;
  profile: SolverWeightProfile;
}

export interface SolverWeightRow {
  name: string;
  base: number;
  ageMult: number;
  arrMult: number;
  final: number;
}

export interface MilestoneChange {
  type: 'band_transition' | 'template_change' | 'profile_shift';
  description: string;
}

export interface MilestoneSnapshot {
  label: string;
  refDate: string;
  children: ChildSnapshot[];
  youngestBand: AgeBandV2;
  weightProfile: SolverWeightProfile;
  solverWeights: SolverWeightRow[];
  topTemplate: TemplateScoreV2 | null;
  recommendation: BaselineRecommendationOutputV2;
  rationale: string[];
  changes: MilestoneChange[];
  // New: full pipeline data per milestone
  context: FamilyContextDefaults | null;
  overlays: DisruptionOverlayResult[];
  solverPayload: SolverPayloadOverlay | null;
  scheduleDays: ScheduleDay[];
  presetOutput: PresetOutput | null;
}

// ─── Milestone Offsets ────────────────────────────────────────────

export const MILESTONES: MilestoneOffset[] = [
  { label: 'Start', days: 0 },
  { label: '+2 Weeks', days: 14 },
  { label: '+3 Months', days: 91 },
  { label: '+6 Months', days: 182 },
  { label: '+1 Year', days: 365 },
  { label: '+2 Years', days: 730 },
];

// ─── Helpers ──────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeSolverWeights(
  profile: SolverWeightProfile,
  arrangement: string,
): SolverWeightRow[] {
  const ageMults = AGE_WEIGHT_MULTIPLIERS[profile] ?? AGE_WEIGHT_MULTIPLIERS['school_age'];
  const arrMults = LIVING_ARRANGEMENT_WEIGHT_MULTIPLIERS[arrangement] ?? LIVING_ARRANGEMENT_WEIGHT_MULTIPLIERS['shared'];

  return Object.entries(DEFAULT_SOLVER_WEIGHTS).map(([key, base]) => {
    const ageMult = ageMults[key] ?? 1;
    const arrMult = arrMults[key] ?? 1;
    return {
      name: key,
      base,
      ageMult,
      arrMult,
      final: Math.round(base * ageMult * arrMult * 100) / 100,
    };
  });
}

function detectChanges(
  current: MilestoneSnapshot,
  previous: MilestoneSnapshot | null,
): MilestoneChange[] {
  if (!previous) return [];
  const changes: MilestoneChange[] = [];

  // Check per-child band transitions
  for (const child of current.children) {
    const prev = previous.children.find((c) => c.childId === child.childId);
    if (prev && prev.ageBand !== child.ageBand) {
      changes.push({
        type: 'band_transition',
        description: `${child.childId}: ${prev.ageBand} → ${child.ageBand}`,
      });
    }
  }

  // Check profile shift
  if (current.weightProfile !== previous.weightProfile) {
    changes.push({
      type: 'profile_shift',
      description: `Solver profile: ${previous.weightProfile} → ${current.weightProfile}`,
    });
  }

  // Check template change
  const currTemplate = current.topTemplate?.templateId;
  const prevTemplate = previous.topTemplate?.templateId;
  if (currTemplate && prevTemplate && currTemplate !== prevTemplate) {
    const prevName = previous.topTemplate?.name ?? prevTemplate;
    const currName = current.topTemplate?.name ?? currTemplate;
    changes.push({
      type: 'template_change',
      description: `Top template: ${prevName} → ${currName}`,
    });
  }

  return changes;
}

// ─── Schedule Generation ─────────────────────────────────────────

const HORIZON_DAYS = 140;

/**
 * Generates a schedule from a 14-day pattern, starting at refDate.
 * Disruption locks override the pattern for specific dates.
 */
export function generateScheduleDays(
  pattern14: (0 | 1)[],
  locks: Map<string, string>,
  refDate?: string,
): ScheduleDay[] {
  const start = refDate ? new Date(refDate + 'T00:00:00') : new Date();
  // pattern14 uses Mon=index 0. Convert JS day (0=Sun) to Mon-based:
  // JS: Sun=0 Mon=1 Tue=2 ... Sat=6
  // Pattern: Mon=0 Tue=1 ... Sun=6
  // offset = (jsDay + 6) % 7
  const startOffset = (start.getDay() + 6) % 7;

  const days: ScheduleDay[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    const patternIdx = (startOffset + i) % 14;
    const defaultParent = pattern14[patternIdx] === 0 ? 'parent_a' : 'parent_b';

    // Check disruption locks
    const lockParent = locks.get(dateStr);
    if (lockParent) {
      days.push({
        date: dateStr,
        assignedTo: lockParent as 'parent_a' | 'parent_b',
        source: 'Disruption',
      });
    } else {
      days.push({
        date: dateStr,
        assignedTo: defaultParent,
        source: 'Regular schedule',
      });
    }
  }

  return days;
}

// ─── Disruption Time-Shifting ────────────────────────────────────

/**
 * Shifts disruption events forward by a day offset.
 * This allows seeing how the same disruption would behave at a future milestone.
 */
function shiftDisruptionEvents(events: DisruptionEvent[], dayOffset: number): DisruptionEvent[] {
  if (dayOffset === 0) return events;
  return events.map((e) => ({
    ...e,
    startDate: addDays(e.startDate, dayOffset),
    endDate: addDays(e.endDate, dayOffset),
  }));
}

/**
 * Computes disruption overlays for a set of events against current assignments.
 */
function computeDisruptionOverlays(
  events: DisruptionEvent[],
  currentAssignments: CurrentAssignment[],
): DisruptionOverlayResult[] {
  const results: DisruptionOverlayResult[] = [];
  for (const event of events) {
    const defaultPolicy = getDefaultPolicy(event.type);
    const resolved = resolvePolicy(event.type, [{
      id: defaultPolicy.eventType,
      familyId: null,
      appliesToEventType: defaultPolicy.eventType,
      actionType: defaultPolicy.actionType,
      defaultStrength: defaultPolicy.defaultStrength,
      promptingRules: defaultPolicy.promptingRules,
      fairnessAccounting: defaultPolicy.fairnessAccounting,
      source: PolicySource.GLOBAL_DEFAULT,
      isActive: true,
    }]);
    const overlay = computeOverlay(event, resolved, currentAssignments);
    results.push(overlay);
  }
  return results;
}

// ─── Main Computation ─────────────────────────────────────────────

export interface MilestoneComputeInput {
  /** The original parsed family input (with birthdates and/or ageBands) */
  familyInput: BaselineRecommendationInputV2;
  /** Detected arrangement (shared / primary_visits / undecided) */
  arrangement: string;
  /** Parsed disruption events (may be empty) */
  disruptionEvents: DisruptionEvent[];
}

export function computeMilestones(input: MilestoneComputeInput): MilestoneSnapshot[] {
  const { familyInput, arrangement, disruptionEvents } = input;
  const today = new Date().toISOString().slice(0, 10);
  const snapshots: MilestoneSnapshot[] = [];

  for (const milestone of MILESTONES) {
    const refDate = addDays(today, milestone.days);

    // 1. Resolve each child's age band at this refDate
    const children: ChildSnapshot[] = familyInput.children.map((c) => {
      const hasBirthdate = !!c.birthdate;
      let ageBand: AgeBandV2;
      if (c.birthdate) {
        ageBand = birthdateToAgeBand(c.birthdate, refDate);
      } else {
        // No birthdate — keep ageBand constant (cannot simulate aging)
        ageBand = (c.ageBand as AgeBandV2) ?? '5-7y';
      }
      return {
        childId: c.childId,
        hasBirthdate,
        ageBand,
        profile: BAND_TO_PROFILE[ageBand],
      };
    });

    // 2. Build modified input with ageBand override (no birthdate)
    const modifiedInput: BaselineRecommendationInputV2 = {
      ...familyInput,
      children: children.map((c) => ({
        childId: c.childId,
        ageBand: c.ageBand,
        // Omit birthdate so recommendBaselineV2 uses ageBand directly
      })),
    };

    // 3. Run recommendation pipeline
    const recommendation = recommendBaselineV2(modifiedInput);

    // 4. Compute family-level context manually (since computeFamilyContextDefaults lacks refDate)
    const bands = children.map((c) => c.ageBand);
    const youngest = youngestBand(bands);
    const weightProfile = BAND_TO_PROFILE[youngest];

    // 5. Compute solver weights
    const solverWeights = computeSolverWeights(weightProfile, arrangement);

    // 6. Get top template
    const topTemplate = recommendation.aggregate.recommendedTemplates[0] ?? null;
    const topTemplateObj = TEMPLATES_V2.find((t) => t.id === topTemplate?.templateId) ?? TEMPLATES_V2[0];

    // 7. Generate rationale
    const perChildDefaults = children.map((c) => {
      const defaults = getChildDefaults({ childId: c.childId, ageBand: c.ageBand }, refDate);
      return defaults;
    });
    const multiChild = computeMultiChildScoring(
      perChildDefaults.map((d) => ({
        childId: d.childId,
        ageBand: d.ageBand,
        maxConsecutive: adjustMaxConsecutive(d.defaults.maxConsecutive, familyInput.goals, d.ageBand),
        maxAway: adjustMaxConsecutive(d.defaults.maxAway, familyInput.goals, d.ageBand),
      })),
    );

    const aggregateResult = {
      derivedFrom: familyInput.aggregationMode ?? ('youngest_child_rules' as const),
      maxConsecutive: multiChild.hardConstraintFloors.maxConsecutive,
      maxAway: multiChild.hardConstraintFloors.maxAway,
      youngestBand: youngest,
    };

    const topTemplates = topTemplate
      ? [{ template: TEMPLATES_V2.find((t) => t.id === topTemplate.templateId)!, score: topTemplate.score, confidence: topTemplate.confidence }]
      : [];
    const rationale = generateRationale(familyInput, aggregateResult, topTemplates);

    // 8. Build FamilyContextDefaults for this milestone
    const context: FamilyContextDefaults = {
      youngestBand: youngest,
      maxConsecutive: multiChild.hardConstraintFloors.maxConsecutive,
      maxAway: multiChild.hardConstraintFloors.maxAway,
      preferredTemplateIds: recommendation.aggregate.recommendedTemplates.map((t) => t.templateId),
      perChild: perChildDefaults.map((d) => ({
        childId: d.childId,
        ageBand: d.ageBand,
        maxConsecutive: adjustMaxConsecutive(d.defaults.maxConsecutive, familyInput.goals, d.ageBand),
        maxAway: adjustMaxConsecutive(d.defaults.maxAway, familyInput.goals, d.ageBand),
      })),
      solverWeightProfile: weightProfile,
      livingArrangement: arrangement,
      scoringMode: multiChild.scoringMode,
      hardConstraintFloors: multiChild.hardConstraintFloors,
      fairnessCapped: youngest === '0-6m' || youngest === '6-12m',
    };

    // 9. Compute presets
    let presetOutput: PresetOutput | null = null;
    const anchorType = familyInput.anchor.type;
    try {
      presetOutput = computePresetRecommendations({
        locale: 'en-US',
        arrangement: arrangement as LivingArrangement,
        youngestBand: youngest,
        childCount: familyInput.children.length,
        commuteMinutes: familyInput.distanceBetweenHomesMinutes ?? 15,
        schoolAnchor: anchorType === 'school' || anchorType === 'daycare',
      });
    } catch {
      // presetOutput stays null
    }

    // 10. Compute disruption overlays (time-shifted for this milestone)
    const shiftedEvents = shiftDisruptionEvents(disruptionEvents, milestone.days);

    // Build current assignments from template pattern (needed for overlay computation)
    const tempDays = generateScheduleDays(topTemplateObj.pattern14, new Map(), refDate);
    const currentAssignments: CurrentAssignment[] = tempDays.map((d) => ({
      date: d.date,
      assignedTo: d.assignedTo,
    }));

    const overlays = shiftedEvents.length > 0
      ? computeDisruptionOverlays(shiftedEvents, currentAssignments)
      : [];

    // 11. Merge overlays into solver payload
    let solverPayload: SolverPayloadOverlay | null = null;
    if (overlays.length > 0) {
      solverPayload = toSolverPayload(overlays);
    }

    // 12. Build lock map and generate final schedule
    const lockMap = new Map<string, string>();
    if (solverPayload) {
      for (const lock of solverPayload.disruption_locks) {
        lockMap.set(lock.date, lock.parent);
      }
    }
    const scheduleDays = generateScheduleDays(topTemplateObj.pattern14, lockMap, refDate);

    // 13. Build snapshot (changes filled in below)
    const snapshot: MilestoneSnapshot = {
      label: milestone.label,
      refDate,
      children,
      youngestBand: youngest,
      weightProfile,
      solverWeights,
      topTemplate,
      recommendation,
      rationale,
      changes: [],
      context,
      overlays,
      solverPayload,
      scheduleDays,
      presetOutput,
    };

    snapshots.push(snapshot);
  }

  // Fill in changes by comparing to previous milestone
  for (let i = 0; i < snapshots.length; i++) {
    snapshots[i].changes = detectChanges(snapshots[i], i > 0 ? snapshots[i - 1] : null);
  }

  return snapshots;
}
