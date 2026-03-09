// ── Scenario Catalog ─────────────────────────────────────────
// Each scenario represents a real-world custody disruption or conflict pattern.

export interface ScenarioEvent {
  type: string;
  day: number;
  duration?: number;
  parent?: 'parent_a' | 'parent_b';
  description?: string;
}

export type ScenarioCategory = 'health' | 'school' | 'work' | 'logistics' | 'travel' | 'holiday' | 'conflict' | 'stress' | 'edgecase' | 'family' | 'legal';
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  1: 'Simple disruption',
  2: 'Multi-step negotiation',
  3: 'Fairness balancing required',
  4: 'Repeated proposal rejection',
  5: 'Solver constraint edge case',
};

export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  category: ScenarioCategory;
  difficulty: DifficultyLevel;
  events: ScenarioEvent[];
}

export interface DisruptionResponsePattern {
  scenario: string;
  typical_resolution: string[];
  likely_conflict_archetypes: string[];
}

export const SCENARIO_CATALOG: ScenarioDef[] = [
  // ── Routine Disruptions ──
  {
    id: 'child_sick_exchange',
    name: 'Child Sick During Exchange',
    category: 'health',
    difficulty: 1,
    description: 'Child becomes sick on the morning of a scheduled exchange.',
    events: [{ type: 'child_sick', day: 3 }],
  },
  {
    id: 'unexpected_school_closure',
    name: 'Unexpected School Closure',
    category: 'school',
    difficulty: 1,
    description: 'School closes unexpectedly due to weather or facility issue.',
    events: [{ type: 'school_closed', day: 7 }],
  },
  {
    id: 'work_emergency',
    name: 'Parent Work Emergency',
    category: 'work',
    difficulty: 1,
    description: 'Parent suddenly cannot pick up child due to urgent work obligation.',
    events: [{ type: 'work_emergency', day: 4, parent: 'parent_a' }],
  },
  {
    id: 'late_pickup',
    name: 'Late Pickup',
    category: 'logistics',
    difficulty: 1,
    description: 'Parent arrives late for scheduled handoff.',
    events: [{ type: 'late_pickup', day: 6, parent: 'parent_b' }],
  },
  {
    id: 'transport_failure',
    name: 'Transport Failure',
    category: 'logistics',
    difficulty: 1,
    description: 'Vehicle or transportation issue prevents exchange.',
    events: [{ type: 'transport_failure', day: 5, parent: 'parent_a' }],
  },

  // ── Travel and Scheduling ──
  {
    id: 'parent_travel',
    name: 'Parent Work Travel',
    category: 'travel',
    difficulty: 2,
    description: 'Parent A must travel for work during scheduled custody.',
    events: [{ type: 'parent_travel', day: 10, duration: 3, parent: 'parent_a' }],
  },
  {
    id: 'flight_delay',
    name: 'Travel Delay',
    category: 'travel',
    difficulty: 1,
    description: 'Parent delayed returning from trip, misses exchange.',
    events: [{ type: 'flight_delay', day: 12, parent: 'parent_a' }],
  },
  {
    id: 'vacation_request',
    name: 'Vacation Request',
    category: 'travel',
    difficulty: 3,
    description: 'Parent requests extra days for family vacation.',
    events: [{ type: 'vacation_request', day: 15, duration: 5, parent: 'parent_b' }],
  },

  // ── School and Activity Conflicts ──
  {
    id: 'school_trip',
    name: 'School Trip Conflict',
    category: 'school',
    difficulty: 1,
    description: 'School trip falls on exchange day, permission needed from both parents.',
    events: [{ type: 'school_trip', day: 8 }],
  },
  {
    id: 'activity_conflict',
    name: 'After-School Activity Conflict',
    category: 'school',
    difficulty: 2,
    description: 'New activity creates pickup conflict on transition day.',
    events: [{ type: 'activity_added', day: 9 }],
  },
  {
    id: 'camp_week',
    name: 'Summer Camp Week',
    category: 'school',
    difficulty: 3,
    description: 'Child at day camp for full week, changes exchange logistics.',
    events: [{ type: 'camp_week', day: 21, duration: 5 }],
  },

  // ── Holidays ──
  {
    id: 'holiday_override',
    name: 'Holiday Schedule Conflict',
    category: 'holiday',
    difficulty: 3,
    description: 'Holiday falls on scheduled exchange, both parents want the day.',
    events: [{ type: 'holiday', day: 25 }],
  },
  {
    id: 'holiday_extension',
    name: 'Holiday Extension Request',
    category: 'holiday',
    difficulty: 3,
    description: 'Parent requests extra days beyond normal holiday allocation.',
    events: [{ type: 'holiday_extension_request', day: 25, parent: 'parent_a' }],
  },

  // ── Health and Emergencies ──
  {
    id: 'parent_illness',
    name: 'Parent Illness',
    category: 'health',
    difficulty: 2,
    description: 'Custodial parent too sick to care for child.',
    events: [{ type: 'parent_sick', day: 6, parent: 'parent_a' }],
  },
  {
    id: 'hospitalization',
    name: 'Child Hospitalization',
    category: 'health',
    difficulty: 2,
    description: 'Child hospitalized, both parents need access.',
    events: [{ type: 'child_hospitalization', day: 11 }],
  },

  // ── Conflict Scenarios ──
  {
    id: 'proposal_rejection_loop',
    name: 'Proposal Rejection Loop',
    category: 'conflict',
    difficulty: 4,
    description: 'Parent repeatedly rejects reasonable proposals.',
    events: [
      { type: 'proposal_rejected', day: 4, parent: 'parent_b' },
      { type: 'proposal_rejected', day: 5, parent: 'parent_b' },
    ],
  },
  {
    id: 'strategic_gaming',
    name: 'Strategic Gaming Attempt',
    category: 'conflict',
    difficulty: 3,
    description: 'Parent repeatedly requests additional time during disruptions.',
    events: [
      { type: 'extra_time_request', day: 6, parent: 'parent_a' },
      { type: 'extra_time_request', day: 8, parent: 'parent_a' },
    ],
  },
  {
    id: 'fairness_complaint',
    name: 'Fairness Complaint',
    category: 'conflict',
    difficulty: 3,
    description: 'Parent formally disputes fairness metrics.',
    events: [{ type: 'fairness_complaint', day: 10, parent: 'parent_b' }],
  },

  // ── Multi-Event Stress Tests ──
  {
    id: 'compound_disruption',
    name: 'Compound Disruption',
    category: 'stress',
    difficulty: 4,
    description: 'Illness, school closure, and parent travel within same two-week window.',
    events: [
      { type: 'child_sick', day: 4 },
      { type: 'school_closed', day: 6 },
      { type: 'parent_travel', day: 7, duration: 3, parent: 'parent_a' },
    ],
  },
  {
    id: 'seasonal_chaos',
    name: 'Seasonal Chaos',
    category: 'stress',
    difficulty: 4,
    description: 'Holiday, school break, and travel request all collide.',
    events: [
      { type: 'holiday', day: 21 },
      { type: 'school_break', day: 22 },
      { type: 'vacation_request', day: 23, parent: 'parent_a' },
    ],
  },
  {
    id: 'conflict_cascade',
    name: 'High Conflict Cascade',
    category: 'stress',
    difficulty: 5,
    description: 'Multiple proposal rejections followed by fairness complaint.',
    events: [
      { type: 'proposal_rejected', day: 3, parent: 'parent_b' },
      { type: 'proposal_rejected', day: 4, parent: 'parent_b' },
      { type: 'fairness_complaint', day: 5, parent: 'parent_b' },
    ],
  },

  // ── Edge Cases ──
  {
    id: 'constraint_conflict',
    name: 'Constraint Conflict',
    category: 'edgecase',
    difficulty: 5,
    description: 'Locked night and unavailability create infeasible constraint set.',
    events: [{ type: 'locked_night_conflict', day: 5 }],
  },
  {
    id: 'long_distance_exchange',
    name: 'Long Distance Exchange',
    category: 'edgecase',
    difficulty: 2,
    description: 'Heavy traffic or distance makes exchange impractical.',
    events: [{ type: 'traffic_delay', day: 3 }],
  },
  {
    id: 'response_timeout',
    name: 'Parent Does Not Respond',
    category: 'edgecase',
    difficulty: 2,
    description: 'Parent fails to respond to proposal within time window.',
    events: [{ type: 'response_timeout', day: 5, parent: 'parent_b' }],
  },
  {
    id: 'weekend_fragmentation',
    name: 'Weekend Fragmentation',
    category: 'edgecase',
    difficulty: 3,
    description: 'Swap request fragments a full weekend into split days.',
    events: [{ type: 'schedule_swap_request', day: 13, parent: 'parent_a' }],
  },

  // ── Expanded: Health ──
  {
    id: 'mental_health_day',
    name: 'Mental Health Day',
    category: 'health',
    difficulty: 1,
    description: 'Child needs mental health day, stays home from school during exchange.',
    events: [{ type: 'mental_health_day', day: 5 }],
  },
  {
    id: 'doctor_appointment_conflict',
    name: 'Doctor Appointment Conflict',
    category: 'health',
    difficulty: 2,
    description: 'Scheduled doctor appointment conflicts with exchange time.',
    events: [{ type: 'doctor_appointment', day: 4, parent: 'parent_a' }],
  },

  // ── Expanded: School ──
  {
    id: 'sports_tournament_weekend',
    name: 'Sports Tournament Weekend',
    category: 'school',
    difficulty: 3,
    description: 'All-day sports tournament requires both-parent coordination on custody weekend.',
    events: [{ type: 'sports_tournament', day: 6, duration: 2 }],
  },
  {
    id: 'parent_teacher_conference',
    name: 'Parent-Teacher Conference Week',
    category: 'school',
    difficulty: 2,
    description: 'Conference scheduling requires both parents, conflicts with exchange.',
    events: [{ type: 'parent_teacher_conference', day: 9 }],
  },
  {
    id: 'snow_day_exchange',
    name: 'Snow Day Exchange',
    category: 'school',
    difficulty: 1,
    description: 'Snow day cancels school, child already at non-custodial parent.',
    events: [{ type: 'snow_day', day: 7 }],
  },
  {
    id: 'school_year_start',
    name: 'School Year Start',
    category: 'school',
    difficulty: 2,
    description: 'First week of school changes pickup logistics and exchange timing.',
    events: [{ type: 'school_year_start', day: 1, duration: 5 }],
  },
  {
    id: 'child_activity_overload',
    name: 'Child Activity Overload',
    category: 'school',
    difficulty: 3,
    description: 'Multiple activities create daily pickup conflicts across both households.',
    events: [
      { type: 'activity_added', day: 3 },
      { type: 'activity_added', day: 5 },
      { type: 'activity_added', day: 8 },
    ],
  },

  // ── Expanded: Logistics ──
  {
    id: 'public_transport_strike',
    name: 'Public Transport Strike',
    category: 'logistics',
    difficulty: 2,
    description: 'Transit strike makes commute-based exchange impossible.',
    events: [{ type: 'transport_strike', day: 4, duration: 2 }],
  },
  {
    id: 'car_breakdown_mid_exchange',
    name: 'Car Breakdown Mid-Exchange',
    category: 'logistics',
    difficulty: 1,
    description: 'Vehicle breaks down during handoff drive.',
    events: [{ type: 'car_breakdown', day: 6, parent: 'parent_b' }],
  },

  // ── Expanded: Travel ──
  {
    id: 'late_flight_return',
    name: 'Late Flight Return',
    category: 'travel',
    difficulty: 2,
    description: 'Parent returns from trip hours late, misses evening exchange.',
    events: [{ type: 'late_flight', day: 14, parent: 'parent_a' }],
  },
  {
    id: 'summer_schedule_shift',
    name: 'Summer Schedule Shift',
    category: 'travel',
    difficulty: 3,
    description: 'Summer break requires complete schedule restructure.',
    events: [{ type: 'summer_shift', day: 1, duration: 14 }],
  },

  // ── Expanded: Family Events ──
  {
    id: 'family_wedding',
    name: 'Family Wedding',
    category: 'family',
    difficulty: 2,
    description: 'Family wedding requires child for full weekend during other parent custody.',
    events: [{ type: 'family_event', day: 13, duration: 2, parent: 'parent_b', description: 'Family wedding' }],
  },
  {
    id: 'funeral_travel',
    name: 'Funeral Travel',
    category: 'family',
    difficulty: 2,
    description: 'Parent must travel for funeral, needs emergency custody transfer.',
    events: [{ type: 'funeral_travel', day: 8, duration: 3, parent: 'parent_a' }],
  },
  {
    id: 'grandparent_visit',
    name: 'Grandparent Visit',
    category: 'family',
    difficulty: 1,
    description: 'Grandparent visiting from out of town, parent requests extra day.',
    events: [{ type: 'grandparent_visit', day: 10, duration: 3, parent: 'parent_b' }],
  },
  {
    id: 'religious_holiday_conflict',
    name: 'Religious Holiday Conflict',
    category: 'holiday',
    difficulty: 3,
    description: 'Religious observance conflicts with standard schedule rotation.',
    events: [{ type: 'religious_holiday', day: 18, duration: 2, parent: 'parent_a' }],
  },

  // ── Expanded: Conflict ──
  {
    id: 'schedule_swap_chain',
    name: 'Schedule Swap Chain',
    category: 'conflict',
    difficulty: 4,
    description: 'Multiple sequential swap requests create cascading fairness debt.',
    events: [
      { type: 'schedule_swap_request', day: 3, parent: 'parent_a' },
      { type: 'schedule_swap_request', day: 7, parent: 'parent_b' },
      { type: 'schedule_swap_request', day: 12, parent: 'parent_a' },
    ],
  },
  {
    id: 'unilateral_schedule_change',
    name: 'Unilateral Schedule Change',
    category: 'conflict',
    difficulty: 4,
    description: 'Parent changes schedule without consulting the other parent.',
    events: [{ type: 'unilateral_change', day: 5, parent: 'parent_a' }],
  },
  {
    id: 'parent_refuses_exchange',
    name: 'Parent Refuses Exchange',
    category: 'conflict',
    difficulty: 5,
    description: 'Parent refuses to hand over child at scheduled exchange.',
    events: [{ type: 'exchange_refusal', day: 7, parent: 'parent_b' }],
  },
  {
    id: 'major_schedule_change_request',
    name: 'Major Schedule Change Request',
    category: 'conflict',
    difficulty: 4,
    description: 'Parent requests permanent schedule change (e.g. new job hours).',
    events: [{ type: 'major_change_request', day: 1, parent: 'parent_a' }],
  },

  // ── Expanded: Edge Cases ──
  {
    id: 'child_preference_conflict',
    name: 'Child Preference Conflict',
    category: 'edgecase',
    difficulty: 3,
    description: 'Older child expresses preference to stay with one parent.',
    events: [{ type: 'child_preference', day: 10, description: 'Teen requests schedule change' }],
  },
  {
    id: 'child_refuses_exchange',
    name: 'Child Refuses Exchange',
    category: 'edgecase',
    difficulty: 4,
    description: 'Child refuses to go to other parent at handoff time.',
    events: [{ type: 'child_refusal', day: 6 }],
  },
  {
    id: 'emergency_relocation',
    name: 'Emergency Relocation',
    category: 'edgecase',
    difficulty: 5,
    description: 'Parent must relocate on short notice, changes all logistics.',
    events: [{ type: 'emergency_relocation', day: 3, parent: 'parent_a' }],
  },

  // ── Expanded: Legal ──
  {
    id: 'court_order_update',
    name: 'Court Order Update',
    category: 'legal',
    difficulty: 5,
    description: 'New court order changes custody split or constraints mid-schedule.',
    events: [{ type: 'court_order_update', day: 14 }],
  },

  // ── Expanded: Stress Tests ──
  {
    id: 'multi_disruption_overlap',
    name: 'Multi-Disruption Overlap',
    category: 'stress',
    difficulty: 5,
    description: 'Four disruptions within one week: illness, school closure, travel, and holiday.',
    events: [
      { type: 'child_sick', day: 1 },
      { type: 'school_closed', day: 2 },
      { type: 'parent_travel', day: 3, duration: 2, parent: 'parent_a' },
      { type: 'holiday', day: 4 },
    ],
  },
];

// ── Disruption Response Patterns ──────────────────────────────

export const DISRUPTION_RESPONSE_PATTERNS: DisruptionResponsePattern[] = [
  {
    scenario: 'child_sick_exchange',
    typical_resolution: ['delay_exchange', 'temporary_care_by_current_parent', 'compensation_option_generated'],
    likely_conflict_archetypes: ['strategic_scorekeeper', 'high_conflict_scorekeeper'],
  },
  {
    scenario: 'parent_travel',
    typical_resolution: ['temporary_custody_transfer', 'future_compensation_block'],
    likely_conflict_archetypes: ['strategic_scorekeeper', 'strategic_avoidant'],
  },
  {
    scenario: 'unexpected_school_closure',
    typical_resolution: ['logistics_adjustment', 'daytime_coverage_request'],
    likely_conflict_archetypes: ['flexible_scorekeeper'],
  },
  {
    scenario: 'proposal_rejection_loop',
    typical_resolution: ['new_proposal_bundle', 'compensation_balancing'],
    likely_conflict_archetypes: ['high_conflict_scorekeeper', 'high_conflict_strategic'],
  },
  {
    scenario: 'response_timeout',
    typical_resolution: ['auto_accept_after_timeout'],
    likely_conflict_archetypes: ['organizer_avoidant', 'avoidant_pair'],
  },
  {
    scenario: 'vacation_request',
    typical_resolution: ['future_compensation_block', 'split_vacation_days'],
    likely_conflict_archetypes: ['strategic_scorekeeper', 'high_conflict_organizer'],
  },
  {
    scenario: 'holiday_override',
    typical_resolution: ['alternating_year_rule', 'split_day', 'compensation_option_generated'],
    likely_conflict_archetypes: ['high_conflict_scorekeeper', 'strategic_scorekeeper'],
  },
  {
    scenario: 'parent_refuses_exchange',
    typical_resolution: ['escalation_to_mediator', 'documentation_log', 'compensation_option_generated'],
    likely_conflict_archetypes: ['high_conflict_strategic', 'high_conflict_organizer'],
  },
  {
    scenario: 'child_refuses_exchange',
    typical_resolution: ['temporary_flex', 'parent_mediation', 'schedule_review'],
    likely_conflict_archetypes: ['high_conflict_scorekeeper', 'organizer_avoidant'],
  },
  {
    scenario: 'emergency_relocation',
    typical_resolution: ['complete_schedule_rebuild', 'temporary_primary_custody', 'court_review'],
    likely_conflict_archetypes: ['high_conflict_strategic', 'high_conflict_scorekeeper'],
  },
  {
    scenario: 'court_order_update',
    typical_resolution: ['constraint_rebuild', 'schedule_regeneration'],
    likely_conflict_archetypes: ['high_conflict_organizer', 'strategic_avoidant'],
  },
  {
    scenario: 'multi_disruption_overlap',
    typical_resolution: ['triage_priority_queue', 'temporary_single_parent', 'batch_compensation'],
    likely_conflict_archetypes: ['high_conflict_strategic', 'strategic_scorekeeper'],
  },
];

export const SCENARIO_CATEGORIES = [
  { value: 'health', label: 'Health', color: 'bg-red-100 text-red-700' },
  { value: 'school', label: 'School', color: 'bg-blue-100 text-blue-700' },
  { value: 'work', label: 'Work', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'logistics', label: 'Logistics', color: 'bg-amber-100 text-amber-700' },
  { value: 'travel', label: 'Travel', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'holiday', label: 'Holiday', color: 'bg-purple-100 text-purple-700' },
  { value: 'family', label: 'Family', color: 'bg-pink-100 text-pink-700' },
  { value: 'conflict', label: 'Conflict', color: 'bg-orange-100 text-orange-700' },
  { value: 'legal', label: 'Legal', color: 'bg-slate-100 text-slate-700' },
  { value: 'stress', label: 'Stress Test', color: 'bg-rose-100 text-rose-700' },
  { value: 'edgecase', label: 'Edge Case', color: 'bg-gray-100 text-gray-700' },
] as const;

// ── Simulation Matrix ──

export const SIMULATION_MATRIX = {
  family_structures: 6,
  interaction_archetypes: 12,
  scenarios: SCENARIO_CATALOG.length,
  get total_high_value_simulations() {
    return this.family_structures * this.interaction_archetypes * this.scenarios;
  },
} as const;
