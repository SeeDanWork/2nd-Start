// ─── Bootstrap Facts Schema ─────────────────────────────────
// Canonical onboarding fact schema: three deterministic buckets
// that separate observed patterns, hard constraints, and optimization goals.
//
// Purpose: recover the current operating schedule with enough fidelity
// to generate a continuity-first baseline — not merely classify into a template.

// ─── Enums ──────────────────────────────────────────────────

export enum ScheduleTemplate {
  ALTERNATING_WEEKS = 'alternating_weeks',
  TWO_TWO_THREE = '2-2-3',
  THREE_FOUR_FOUR_THREE = '3-4-4-3',
  FIVE_TWO = '5-2',
  EVERY_OTHER_WEEKEND = 'every_other_weekend',
  CUSTOM = 'custom',
}

export enum ExchangeModality {
  SCHOOL_HANDOFF = 'school_handoff',
  HOME_HANDOFF = 'home_handoff',
  CURBSIDE = 'curbside',
  THIRD_PARTY = 'third_party',
  PUBLIC_LOCATION = 'public_location',
}

export enum ExchangeTimingType {
  AFTER_SCHOOL = 'after_school',
  EVENING = 'evening',
  MORNING_DROPOFF = 'morning_dropoff',
  PICKUP = 'pickup',
  CUSTOM = 'custom',
}

export enum MidweekPattern {
  NONE = 'none',
  DINNER_VISIT = 'dinner_visit',
  OVERNIGHT = 'overnight',
  AFTERNOON = 'afternoon',
}

export enum WeekendPattern {
  ALTERNATING = 'alternating',
  SPLIT = 'split',
  FIXED_ONE_PARENT = 'fixed_one_parent',
  FLEXIBLE = 'flexible',
}

export enum OptimizationGoal {
  REDUCE_TRANSITIONS = 'reduce_transitions',
  SHORTEN_STRETCHES = 'shorten_stretches',
  PRESERVE_WEEKENDS = 'preserve_weekends',
  SCHOOL_NIGHT_CONSISTENCY = 'school_night_consistency',
  REDUCE_DRIVING = 'reduce_driving',
  INCREASE_FAIRNESS = 'increase_fairness',
  MORE_STABILITY = 'more_stability',
  MORE_FLEXIBILITY = 'more_flexibility',
}

export enum OnboardingStage {
  BASELINE_EXTRACTION = 'baseline_extraction',
  ANCHOR_EXTRACTION = 'anchor_extraction',
  STABILITY_CONSTRAINTS = 'stability_constraints',
  OPTIMIZATION_TARGET = 'optimization_target',
  PREVIEW_CONFIRMATION = 'preview_confirmation',
  COMPLETE = 'complete',
}

export enum SeasonalPatternMode {
  SINGLE_PATTERN = 'single_pattern',
  SCHOOL_YEAR_VS_SUMMER = 'school_year_vs_summer',
  MULTIPLE_RECURRING = 'multiple_recurring_patterns',
}

export enum BaselineWindowMode {
  STARTING_NOW = 'starting_now',
  THIS_WEEK = 'this_week',
  NEXT_WEEK = 'next_week',
  CUSTOM = 'custom',
}

export enum ParticipationMode {
  SINGLE_PARENT_ESTIMATE = 'single_parent_estimate',
  SINGLE_PARENT_CONFIRMED_HISTORY = 'single_parent_confirmed_history',
  BOTH_PARENTS_PARTICIPATING = 'both_parents_participating',
}

export enum ResponsibilityModel {
  OVERNIGHT_PRIMARY = 'overnight_primary',
  SCHOOL_NIGHT_PRIMARY = 'school_night_primary',
  PICKUP_DROPOFF_PRIMARY = 'pickup_dropoff_primary',
  MIXED = 'mixed',
}

export enum SiblingCohesionPolicy {
  KEEP_TOGETHER = 'KEEP_SIBLINGS_TOGETHER',
  ALLOW_LIMITED_SPLIT = 'ALLOW_LIMITED_SPLIT_FOR_LOGISTICS',
  ALLOW_CHILD_SPECIFIC = 'ALLOW_CHILD_SPECIFIC_PATTERN',
  FULLY_INDEPENDENT = 'FULLY_INDEPENDENT_CHILD_SCHEDULES',
}

export enum SplitStrictness {
  SOFT = 'soft',
  FIRM = 'firm',
  HARD = 'hard',
}

// ─── Interfaces ─────────────────────────────────────────────

/** Per-field confidence tracking (0-1 per field path) */
export interface FieldConfidence {
  [fieldPath: string]: number;
}

/** Numeric solver weight profile for optimization tuning */
export interface WeightProfile {
  fairnessDeviation: number;
  totalTransitions: number;
  nonDaycareHandoffs: number;
  weekendFragmentation: number;
  schoolNightDisruption: number;
  continuityBonus: number;
}

/** Exchange timing details */
export interface ExchangeTiming {
  type: ExchangeTimingType;
  details?: string;
}

/** Child-level representation with optional schedule anchors */
export interface ChildProfile {
  age: number;
  schoolDays?: number[];
  anchorNotes?: string;
  preferenceSignals?: string[];
}

/** Child-specific exception policy */
export interface ChildExceptionPolicy {
  enabled: boolean;
  approvedReasons: string[];
}

/** Coherence issue flagged during validation */
export interface CoherenceIssue {
  severity: 'low' | 'medium' | 'high';
  field: string;
  conflictsWith: string;
  description: string;
}

// ─── A. Observed Facts ──────────────────────────────────────

/** Current operational pattern — what the family is doing now */
export interface ObservedFacts {
  // ── Children ──
  childrenCount: number | null;
  childrenAges: number[] | null;
  children: ChildProfile[];

  // ── Current arrangement ──
  currentArrangement: string | null;
  candidateTemplate: ScheduleTemplate | null;
  templateConfidence: number;
  currentObservedSplitPct: number | null;

  // ── Weekly rhythm ──
  midweekPattern: MidweekPattern | null;
  weekendPattern: WeekendPattern | null;
  currentStretchLength: number | null;
  responsibilityModel: ResponsibilityModel | null;

  // ── Exchange logistics ──
  exchangeModality: ExchangeModality | null;
  exchangeTiming: ExchangeTiming | null;
  handoffTiming: string | null;

  // ── School/daycare ──
  schoolDaycareSchedule: number[] | null;
  schoolExchangeAllowed: boolean | null;
  schoolExchangePreferred: boolean | null;
  childrenShareSchoolRhythm: boolean | null;

  // ── Temporal ──
  seasonalPatternMode: SeasonalPatternMode | null;
  seasonalNotes: string | null;
  effectiveStartDate: string | null;
  baselineWindowMode: BaselineWindowMode | null;

  // ── Context ──
  distanceMiles: number | null;
  partnerPhone: string | null;
  participationMode: ParticipationMode | null;
}

// ─── B. Parent Constraints ──────────────────────────────────

/** Hard boundaries and policies that the solver must respect */
export interface ParentConstraints {
  // ── Schedule constraints ──
  lockedNights: Array<{ parent: 'parent_a' | 'parent_b'; daysOfWeek: number[] }>;
  unavailableDays: Array<{ parent: 'parent_a' | 'parent_b'; daysOfWeek: number[] }>;
  maxConsecutiveNights: number | null;
  schoolNightRestrictions: boolean | null;
  noDirectContact: boolean | null;

  // ── Split protection ──
  targetSplitPct: number | null;
  targetSplitStrictness: SplitStrictness | null;

  // ── Sibling policy ──
  siblingCohesionPolicy: SiblingCohesionPolicy | null;
  childSpecificExceptionPolicy: ChildExceptionPolicy | null;
}

// ─── C. Optimization Goals ──────────────────────────────────

/** What to optimize for, derived from pain points */
export interface OptimizationGoals {
  painPoints: string[];
  classifiedGoals: OptimizationGoal[];
  weightAdjustments: Partial<WeightProfile>;
}

// ─── D. Coherence / Provenance ──────────────────────────────

/** Baseline coherence validation results */
export interface BaselineCoherence {
  score: number;
  issues: CoherenceIssue[];
  confirmedFields: string[];
  inferredFields: string[];
  assumptions: string[];
}

// ─── Top-Level Schema ───────────────────────────────────────

export interface BootstrapFacts {
  observedFacts: ObservedFacts;
  constraints: ParentConstraints;
  optimizationGoals: OptimizationGoals;
  coherence: BaselineCoherence;
  confidence: FieldConfidence;
  stage: OnboardingStage;
  complete: boolean;
}

// ─── Factory ────────────────────────────────────────────────

/** Creates an empty BootstrapFacts with all fields at their null/default state */
export function createEmptyBootstrapFacts(): BootstrapFacts {
  return {
    observedFacts: {
      childrenCount: null,
      childrenAges: null,
      children: [],
      currentArrangement: null,
      candidateTemplate: null,
      templateConfidence: 0,
      currentObservedSplitPct: null,
      midweekPattern: null,
      weekendPattern: null,
      currentStretchLength: null,
      responsibilityModel: null,
      exchangeModality: null,
      exchangeTiming: null,
      handoffTiming: null,
      schoolDaycareSchedule: null,
      schoolExchangeAllowed: null,
      schoolExchangePreferred: null,
      childrenShareSchoolRhythm: null,
      seasonalPatternMode: null,
      seasonalNotes: null,
      effectiveStartDate: null,
      baselineWindowMode: null,
      distanceMiles: null,
      partnerPhone: null,
      participationMode: null,
    },
    constraints: {
      lockedNights: [],
      unavailableDays: [],
      maxConsecutiveNights: null,
      schoolNightRestrictions: null,
      noDirectContact: null,
      targetSplitPct: null,
      targetSplitStrictness: null,
      siblingCohesionPolicy: null,
      childSpecificExceptionPolicy: null,
    },
    optimizationGoals: {
      painPoints: [],
      classifiedGoals: [],
      weightAdjustments: {},
    },
    coherence: {
      score: 0,
      issues: [],
      confirmedFields: [],
      inferredFields: [],
      assumptions: [],
    },
    confidence: {},
    stage: OnboardingStage.BASELINE_EXTRACTION,
    complete: false,
  };
}

// ─── Completeness Check ─────────────────────────────────────

/** Required fields for schedule-quality readiness (not product completion) */
const REQUIRED_FOR_SCHEDULE: Array<{ path: string; check: (facts: BootstrapFacts) => boolean }> = [
  {
    path: 'observedFacts.childrenCount',
    check: (f) => f.observedFacts.childrenCount != null,
  },
  {
    path: 'observedFacts.childrenAges',
    check: (f) =>
      f.observedFacts.childrenAges != null && f.observedFacts.childrenAges.length > 0,
  },
  {
    path: 'observedFacts.currentArrangement or candidateTemplate',
    check: (f) =>
      f.observedFacts.currentArrangement != null ||
      f.observedFacts.candidateTemplate != null,
  },
  {
    path: 'observedFacts.weekendPattern',
    check: (f) => f.observedFacts.weekendPattern != null,
  },
  {
    path: 'constraints.targetSplitPct',
    check: (f) => f.constraints.targetSplitPct != null,
  },
  {
    path: 'observedFacts.exchangeModality or exchangeTiming',
    check: (f) =>
      f.observedFacts.exchangeModality != null ||
      f.observedFacts.exchangeTiming != null,
  },
];

/** Required for product completion (invite flow) */
const REQUIRED_FOR_COMPLETION: Array<{ path: string; check: (facts: BootstrapFacts) => boolean }> = [
  ...REQUIRED_FOR_SCHEDULE,
  {
    path: 'observedFacts.partnerPhone',
    check: (f) => f.observedFacts.partnerPhone != null,
  },
];

/** Returns missing fields for schedule-quality readiness */
export function getRequiredMissingFields(facts: BootstrapFacts): string[] {
  return REQUIRED_FOR_SCHEDULE
    .filter((field) => !field.check(facts))
    .map((field) => field.path);
}

/** Returns missing fields for full product completion (includes partner phone) */
export function getCompletionMissingFields(facts: BootstrapFacts): string[] {
  return REQUIRED_FOR_COMPLETION
    .filter((field) => !field.check(facts))
    .map((field) => field.path);
}

// ─── Coherence Validation ───────────────────────────────────

/** Validate cross-field coherence and return issues */
export function validateCoherence(facts: BootstrapFacts): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];

  // Check: target split vs locked nights feasibility
  if (facts.constraints.targetSplitPct != null && facts.constraints.lockedNights.length > 0) {
    const lockedA = facts.constraints.lockedNights
      .filter(ln => ln.parent === 'parent_a')
      .reduce((sum, ln) => sum + ln.daysOfWeek.length, 0);
    const lockedB = facts.constraints.lockedNights
      .filter(ln => ln.parent === 'parent_b')
      .reduce((sum, ln) => sum + ln.daysOfWeek.length, 0);
    const lockedSplitA = Math.round((lockedA / 7) * 100);
    const targetA = facts.constraints.targetSplitPct;

    // If locked nights alone force a split that deviates >15% from target
    if (Math.abs(lockedSplitA - targetA) > 15 && lockedA + lockedB > 3) {
      issues.push({
        severity: 'high',
        field: 'constraints.targetSplitPct',
        conflictsWith: 'constraints.lockedNights',
        description: `Target split ${targetA}/${100 - targetA} conflicts with locked nights which force ~${lockedSplitA}/${100 - lockedSplitA} on locked days alone`,
      });
    }
  }

  // Check: template vs locked nights structural conflict
  if (facts.observedFacts.candidateTemplate === ScheduleTemplate.ALTERNATING_WEEKS) {
    const totalLocked = facts.constraints.lockedNights
      .reduce((sum, ln) => sum + ln.daysOfWeek.length, 0);
    if (totalLocked >= 4) {
      issues.push({
        severity: 'medium',
        field: 'observedFacts.candidateTemplate',
        conflictsWith: 'constraints.lockedNights',
        description: `Alternating weeks template is structurally broken by ${totalLocked} locked nights`,
      });
    }
  }

  // Check: no-contact + no school exchange = limited exchange options
  if (facts.constraints.noDirectContact && facts.observedFacts.schoolExchangeAllowed === false) {
    issues.push({
      severity: 'high',
      field: 'constraints.noDirectContact',
      conflictsWith: 'observedFacts.schoolExchangeAllowed',
      description: 'No direct contact and no school exchange — only third-party exchanges possible',
    });
  }

  // Check: seasonal divergence not yet captured
  if (facts.observedFacts.seasonalPatternMode === SeasonalPatternMode.SCHOOL_YEAR_VS_SUMMER &&
      !facts.observedFacts.seasonalNotes) {
    issues.push({
      severity: 'medium',
      field: 'observedFacts.seasonalPatternMode',
      conflictsWith: 'observedFacts.seasonalNotes',
      description: 'Seasonal divergence detected but summer pattern not described',
    });
  }

  // Check: sibling cohesion vs child-specific anchors
  if (facts.constraints.siblingCohesionPolicy === SiblingCohesionPolicy.KEEP_TOGETHER) {
    const childrenWithAnchors = facts.observedFacts.children.filter(c => c.anchorNotes);
    if (childrenWithAnchors.length > 1) {
      issues.push({
        severity: 'medium',
        field: 'constraints.siblingCohesionPolicy',
        conflictsWith: 'observedFacts.children[].anchorNotes',
        description: 'Sibling cohesion is KEEP_TOGETHER but multiple children have individual anchor notes',
      });
    }
  }

  return issues;
}
