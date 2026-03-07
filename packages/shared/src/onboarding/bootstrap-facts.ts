// ─── Bootstrap Facts Schema ─────────────────────────────────
// Canonical onboarding fact schema: three deterministic buckets
// that separate observed patterns, hard constraints, and optimization goals.

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

// ─── A. Observed Facts ──────────────────────────────────────

/** Current operational pattern — what the family is doing now */
export interface ObservedFacts {
  currentArrangement: string | null;
  candidateTemplate: ScheduleTemplate | null;
  templateConfidence: number;
  handoffTiming: string | null;
  exchangeModality: ExchangeModality | null;
  schoolDaycareSchedule: number[] | null;
  schoolExchangeAvailable: boolean | null;
  midweekPattern: MidweekPattern | null;
  weekendPattern: WeekendPattern | null;
  currentStretchLength: number | null;
  seasonalVariation: boolean | null;
  effectiveDate: string | null;
  distanceMiles: number | null;
  childrenCount: number | null;
  childrenAges: number[] | null;
  partnerPhone: string | null;
}

// ─── B. Parent Constraints ──────────────────────────────────

/** Hard boundaries that the solver must respect */
export interface ParentConstraints {
  lockedNights: Array<{ parent: 'parent_a' | 'parent_b'; daysOfWeek: number[] }>;
  unavailableDays: Array<{ parent: 'parent_a' | 'parent_b'; daysOfWeek: number[] }>;
  maxConsecutiveNights: number | null;
  schoolNightRestrictions: boolean | null;
  noDirectContact: boolean | null;
}

// ─── C. Optimization Goals ──────────────────────────────────

/** What to optimize for, derived from pain points */
export interface OptimizationGoals {
  painPoints: string[];
  classifiedGoals: OptimizationGoal[];
  weightAdjustments: Partial<WeightProfile>;
}

// ─── Top-Level Schema ───────────────────────────────────────

export interface BootstrapFacts {
  observedFacts: ObservedFacts;
  constraints: ParentConstraints;
  optimizationGoals: OptimizationGoals;
  confidence: FieldConfidence;
  stage: OnboardingStage;
  complete: boolean;
}

// ─── Factory ────────────────────────────────────────────────

/** Creates an empty BootstrapFacts with all fields at their null/default state */
export function createEmptyBootstrapFacts(): BootstrapFacts {
  return {
    observedFacts: {
      currentArrangement: null,
      candidateTemplate: null,
      templateConfidence: 0,
      handoffTiming: null,
      exchangeModality: null,
      schoolDaycareSchedule: null,
      schoolExchangeAvailable: null,
      midweekPattern: null,
      weekendPattern: null,
      currentStretchLength: null,
      seasonalVariation: null,
      effectiveDate: null,
      distanceMiles: null,
      childrenCount: null,
      childrenAges: null,
      partnerPhone: null,
    },
    constraints: {
      lockedNights: [],
      unavailableDays: [],
      maxConsecutiveNights: null,
      schoolNightRestrictions: null,
      noDirectContact: null,
    },
    optimizationGoals: {
      painPoints: [],
      classifiedGoals: [],
      weightAdjustments: {},
    },
    confidence: {},
    stage: OnboardingStage.BASELINE_EXTRACTION,
    complete: false,
  };
}

// ─── Completeness Check ─────────────────────────────────────

/** Required fields for a BootstrapFacts to be considered complete */
const REQUIRED_FIELDS: Array<{ path: string; check: (facts: BootstrapFacts) => boolean }> = [
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
    path: 'observedFacts.currentArrangement or observedFacts.candidateTemplate',
    check: (f) =>
      f.observedFacts.currentArrangement != null ||
      f.observedFacts.candidateTemplate != null,
  },
  {
    path: 'observedFacts.partnerPhone',
    check: (f) => f.observedFacts.partnerPhone != null,
  },
];

/** Returns a list of required field paths that are still missing */
export function getRequiredMissingFields(facts: BootstrapFacts): string[] {
  return REQUIRED_FIELDS
    .filter((field) => !field.check(facts))
    .map((field) => field.path);
}
