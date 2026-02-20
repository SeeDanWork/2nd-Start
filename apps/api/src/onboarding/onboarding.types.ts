/**
 * TypeScript types for onboarding brain API.
 * Mirror of the Python Pydantic models in apps/optimizer/app/brain/domain.py.
 */

export interface SchoolSchedule {
  school_days: number[]; // JS-style 0=Sun..6=Sat
  school_start_time: string;
  school_end_time: string;
}

export interface DaycareSchedule {
  daycare_days: number[];
  daycare_start_time: string;
  daycare_end_time: string;
}

export interface ParentAvailability {
  locked_nights: number[];
  locked_mornings?: number[];
  locked_evenings?: number[];
  work_shifts?: Record<string, unknown>[];
}

export interface ParentPreferences {
  target_share_pct: number;
  max_handoffs_per_week: number;
  max_consecutive_nights_away: number;
  weekend_preference: 'alternate' | 'fixed' | 'flexible';
  holiday_handling?: string;
}

export interface ParentConstraints {
  minimum_nights_per_2_weeks?: number;
  cannot_do_exchanges_in_person: boolean;
  commute_minutes_to_school?: number;
}

export interface ParentProfile {
  parent_id: string;
  availability: ParentAvailability;
  preferences: ParentPreferences;
  constraints: ParentConstraints;
  willingness_accept_non_school_handoffs: number;
}

export interface SharedConstraints {
  distance_between_homes_minutes?: number;
  no_contact_preference: boolean;
  start_date: string;
  horizon_days: number;
  horizon_weeks_fairness?: number;
}

export interface OnboardingInput {
  number_of_children: number;
  children_age_bands: string[];
  school_schedule: SchoolSchedule;
  daycare_schedule?: DaycareSchedule;
  preferred_exchange_location: string;
  parent_a: ParentProfile;
  parent_b?: ParentProfile;
  shared: SharedConstraints;
}

export interface OnboardingConfig {
  profiles?: string[];
  timeout_seconds?: number;
  min_diversity_distance?: number;
}

export interface ScheduleDay {
  date: string;
  day_of_week: number;
  assigned_to: string;
  is_transition: boolean;
}

export interface HandoffInfo {
  date: string;
  time?: string;
  location_type: string;
  from_parent: string;
  to_parent: string;
}

export interface ScheduleStats {
  parent_a_overnights: number;
  parent_b_overnights: number;
  parent_a_weekend_nights: number;
  parent_b_weekend_nights: number;
  transitions_count: number;
  non_school_handoffs: number;
  stability_score: number;
  fairness_score: number;
  weekend_parity_score: number;
}

export interface Explanation {
  bullets: string[];
  respected_constraints: string[];
  tradeoffs: string[];
  assumptions: string[];
}

export interface ScheduleOption {
  id: string;
  name: string;
  profile: string;
  schedule: ScheduleDay[];
  handoffs: HandoffInfo[];
  stats: ScheduleStats;
  explanation: Explanation;
}

export interface ConflictDetail {
  description: string;
  involved_constraints: string[];
  suggested_relaxation: string;
}

export interface ConflictReport {
  feasible: boolean;
  conflicts: ConflictDetail[];
}

export interface OnboardingOutput {
  options: ScheduleOption[];
  conflict_report?: ConflictReport;
  solve_time_ms: number;
  is_partial: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
