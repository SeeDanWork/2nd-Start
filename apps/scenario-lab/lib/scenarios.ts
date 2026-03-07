// ── Scenario Catalog ─────────────────────────────────────────
// Each scenario represents a real-world custody disruption or conflict pattern.

export interface ScenarioEvent {
  type: string;
  day: number;
  duration?: number;
  parent?: 'parent_a' | 'parent_b';
  description?: string;
}

export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  category: 'health' | 'school' | 'work' | 'logistics' | 'travel' | 'holiday' | 'conflict' | 'stress' | 'edgecase';
  events: ScenarioEvent[];
}

export const SCENARIO_CATALOG: ScenarioDef[] = [
  // ── Routine Disruptions ──
  {
    id: 'child_sick_exchange',
    name: 'Child Sick During Exchange',
    category: 'health',
    description: 'Child becomes sick on the morning of a scheduled exchange.',
    events: [{ type: 'child_sick', day: 3 }],
  },
  {
    id: 'unexpected_school_closure',
    name: 'Unexpected School Closure',
    category: 'school',
    description: 'School closes unexpectedly due to weather or facility issue.',
    events: [{ type: 'school_closed', day: 7 }],
  },
  {
    id: 'work_emergency',
    name: 'Parent Work Emergency',
    category: 'work',
    description: 'Parent suddenly cannot pick up child due to urgent work obligation.',
    events: [{ type: 'work_emergency', day: 4, parent: 'parent_a' }],
  },
  {
    id: 'late_pickup',
    name: 'Late Pickup',
    category: 'logistics',
    description: 'Parent arrives late for scheduled handoff.',
    events: [{ type: 'late_pickup', day: 6, parent: 'parent_b' }],
  },
  {
    id: 'transport_failure',
    name: 'Transport Failure',
    category: 'logistics',
    description: 'Vehicle or transportation issue prevents exchange.',
    events: [{ type: 'transport_failure', day: 5, parent: 'parent_a' }],
  },

  // ── Travel and Scheduling ──
  {
    id: 'parent_travel',
    name: 'Parent Work Travel',
    category: 'travel',
    description: 'Parent A must travel for work during scheduled custody.',
    events: [{ type: 'parent_travel', day: 10, duration: 3, parent: 'parent_a' }],
  },
  {
    id: 'flight_delay',
    name: 'Travel Delay',
    category: 'travel',
    description: 'Parent delayed returning from trip, misses exchange.',
    events: [{ type: 'flight_delay', day: 12, parent: 'parent_a' }],
  },
  {
    id: 'vacation_request',
    name: 'Vacation Request',
    category: 'travel',
    description: 'Parent requests extra days for family vacation.',
    events: [{ type: 'vacation_request', day: 15, duration: 5, parent: 'parent_b' }],
  },

  // ── School and Activity Conflicts ──
  {
    id: 'school_trip',
    name: 'School Trip Conflict',
    category: 'school',
    description: 'School trip falls on exchange day, permission needed from both parents.',
    events: [{ type: 'school_trip', day: 8 }],
  },
  {
    id: 'activity_conflict',
    name: 'After-School Activity Conflict',
    category: 'school',
    description: 'New activity creates pickup conflict on transition day.',
    events: [{ type: 'activity_added', day: 9 }],
  },
  {
    id: 'camp_week',
    name: 'Summer Camp Week',
    category: 'school',
    description: 'Child at day camp for full week, changes exchange logistics.',
    events: [{ type: 'camp_week', day: 21, duration: 5 }],
  },

  // ── Holidays ──
  {
    id: 'holiday_override',
    name: 'Holiday Schedule Conflict',
    category: 'holiday',
    description: 'Holiday falls on scheduled exchange, both parents want the day.',
    events: [{ type: 'holiday', day: 25 }],
  },
  {
    id: 'holiday_extension',
    name: 'Holiday Extension Request',
    category: 'holiday',
    description: 'Parent requests extra days beyond normal holiday allocation.',
    events: [{ type: 'holiday_extension_request', day: 25, parent: 'parent_a' }],
  },

  // ── Health and Emergencies ──
  {
    id: 'parent_illness',
    name: 'Parent Illness',
    category: 'health',
    description: 'Custodial parent too sick to care for child.',
    events: [{ type: 'parent_sick', day: 6, parent: 'parent_a' }],
  },
  {
    id: 'hospitalization',
    name: 'Child Hospitalization',
    category: 'health',
    description: 'Child hospitalized, both parents need access.',
    events: [{ type: 'child_hospitalization', day: 11 }],
  },

  // ── Conflict Scenarios ──
  {
    id: 'proposal_rejection_loop',
    name: 'Proposal Rejection Loop',
    category: 'conflict',
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
    description: 'Parent formally disputes fairness metrics.',
    events: [{ type: 'fairness_complaint', day: 10, parent: 'parent_b' }],
  },

  // ── Multi-Event Stress Tests ──
  {
    id: 'compound_disruption',
    name: 'Compound Disruption',
    category: 'stress',
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
    description: 'Locked night and unavailability create infeasible constraint set.',
    events: [{ type: 'locked_night_conflict', day: 5 }],
  },
  {
    id: 'long_distance_exchange',
    name: 'Long Distance Exchange',
    category: 'edgecase',
    description: 'Heavy traffic or distance makes exchange impractical.',
    events: [{ type: 'traffic_delay', day: 3 }],
  },
  {
    id: 'response_timeout',
    name: 'Parent Does Not Respond',
    category: 'edgecase',
    description: 'Parent fails to respond to proposal within time window.',
    events: [{ type: 'response_timeout', day: 5, parent: 'parent_b' }],
  },
  {
    id: 'weekend_fragmentation',
    name: 'Weekend Fragmentation',
    category: 'edgecase',
    description: 'Swap request fragments a full weekend into split days.',
    events: [{ type: 'schedule_swap_request', day: 13, parent: 'parent_a' }],
  },
];

export const SCENARIO_CATEGORIES = [
  { value: 'health', label: 'Health', color: 'bg-red-100 text-red-700' },
  { value: 'school', label: 'School', color: 'bg-blue-100 text-blue-700' },
  { value: 'work', label: 'Work', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'logistics', label: 'Logistics', color: 'bg-amber-100 text-amber-700' },
  { value: 'travel', label: 'Travel', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'holiday', label: 'Holiday', color: 'bg-purple-100 text-purple-700' },
  { value: 'conflict', label: 'Conflict', color: 'bg-orange-100 text-orange-700' },
  { value: 'stress', label: 'Stress Test', color: 'bg-rose-100 text-rose-700' },
  { value: 'edgecase', label: 'Edge Case', color: 'bg-gray-100 text-gray-700' },
] as const;
