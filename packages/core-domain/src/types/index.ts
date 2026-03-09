/** Branded UUID types for type safety */
export type FamilyId = string & { readonly __brand: 'FamilyId' };
export type ParentId = string & { readonly __brand: 'ParentId' };
export type ChildId = string & { readonly __brand: 'ChildId' };
export type ScheduleId = string & { readonly __brand: 'ScheduleId' };

/** Inclusive date range */
export interface DateRange {
  start: string; // ISO date YYYY-MM-DD
  end: string;   // ISO date YYYY-MM-DD
}

/** Policy rule parameters stored as JSONB */
export interface PolicyParameters {
  /** Min consecutive nights for MIN_BLOCK_LENGTH */
  minNights?: number;
  /** Max travel distance in miles for TRAVEL_DISTANCE_LIMIT */
  maxDistanceMiles?: number;
  /** Allowed exchange location IDs for EXCHANGE_LOCATION */
  allowedLocations?: string[];
  /** Day-of-week restrictions (0=Sun..6=Sat) for SCHOOL_NIGHT_ROUTINE */
  restrictedDays?: number[];
  /** Activity IDs for ACTIVITY_COMMITMENT */
  activityIds?: string[];
  /** Whether siblings must stay together for SIBLING_COHESION */
  requireTogether?: boolean;
}

/** Fairness snapshot at a point in time */
export interface FairnessSnapshot {
  parentId: ParentId;
  nightDeviation: number;
  weekendDeviation: number;
  holidayDeviation: number;
  computedAt: string; // ISO timestamp
}

/** Score breakdown from solver */
export interface SolverScoreBreakdown {
  fairnessScore: number;
  stabilityScore: number;
  transitionPenalty: number;
  policyViolationPenalty: number;
  totalScore: number;
}

/** Fairness projection for a proposed schedule */
export interface FairnessProjection {
  parentANightDelta: number;
  parentBNightDelta: number;
  weekendParityDelta: number;
  projectedDeviationAfter: number;
}
