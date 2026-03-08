// ── Scenario Configuration ──────────────────────────────────

export interface ChildConfig {
  age: number;
  name: string;
  schoolDays?: number[];
}

export interface ParentConfig {
  label: string;
  phone: string;
}

export interface ScenarioConfig {
  name: string;
  description: string;
  children: ChildConfig[];
  parentA: ParentConfig;
  parentB: ParentConfig;
  template: string;
  targetSplit: number;
  lockedNights: Array<{ parent: 'parent_a' | 'parent_b'; daysOfWeek: number[] }>;
  distanceMiles: number;
  tags: string[];
  // Persona & scenario catalog references
  personaA?: string;  // parent persona ID
  personaB?: string;  // parent persona ID
  familyStructure?: string; // family structure ID
  scenarioIds?: string[]; // scenario catalog IDs to inject
  simulationWeeks?: number; // how many weeks to simulate
}

// ── Scenario State ──────────────────────────────────────────

export interface Message {
  id: string;
  from: 'user' | 'system';
  text: string;
  timestamp: string;
  phone: string;
}

export interface SimulationLog {
  id: string;
  timestamp: string;
  type: 'api_call' | 'tool_use' | 'stage_change' | 'error' | 'info' | 'disruption';
  phone: string;
  data: Record<string, unknown>;
}

export interface ScheduleDay {
  date: string;
  assignedTo: 'parent_a' | 'parent_b';
  isTransition: boolean;
}

export type ScenarioStatus = 'draft' | 'configuring' | 'simulating' | 'completed' | 'error';

export interface Scenario {
  id: string;
  config: ScenarioConfig;
  status: ScenarioStatus;
  messagesA: Message[];
  messagesB: Message[];
  logs: SimulationLog[];
  schedule: ScheduleDay[];
  currentDay: number;
  activeDisruptions: import('./disruption-engine').ActiveDisruption[];
  bootstrapFacts: Record<string, unknown> | null;
  familyId: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ── Presets ──────────────────────────────────────────────────

export const TEMPLATE_OPTIONS = [
  { value: 'alternating_weeks', label: 'Alternating Weeks', split: '50/50' },
  { value: '2-2-3', label: '2-2-3', split: '50/50' },
  { value: '3-4-4-3', label: '3-4-4-3', split: '50/50' },
  { value: '5-2', label: '5-2', split: '71/29' },
  { value: 'every_other_weekend', label: 'Every Other Weekend', split: '79/21' },
  { value: 'custom', label: 'Custom', split: 'varies' },
] as const;

export const SCENARIO_PRESETS: ScenarioConfig[] = [
  // ── Cooperative Baselines ──
  {
    name: 'Cooperative 50/50',
    description: 'Two school-age kids, alternating weeks, both parents cooperative',
    children: [{ age: 7, name: 'Emma' }, { age: 10, name: 'Jake' }],
    parentA: { label: 'Mom', phone: '+15550001001' },
    parentB: { label: 'Dad', phone: '+15550001002' },
    template: 'alternating_weeks',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 8,
    tags: ['cooperative', '50/50', 'baseline'],
    personaA: 'cooperative_organizer',
    personaB: 'cooperative_organizer',
    scenarioIds: ['child_sick_exchange', 'unexpected_school_closure'],
    simulationWeeks: 8,
  },
  {
    name: 'Toddler Stability',
    description: 'Young child, 2-2-3 with locked Mon-Tue, organizer + scorekeeper',
    children: [{ age: 2, name: 'Lily' }],
    parentA: { label: 'Mom', phone: '+15550002001' },
    parentB: { label: 'Dad', phone: '+15550002002' },
    template: '2-2-3',
    targetSplit: 50,
    lockedNights: [{ parent: 'parent_a', daysOfWeek: [1, 2] }],
    distanceMiles: 5,
    tags: ['toddler', 'locked-nights', '50/50'],
    personaA: 'cooperative_organizer',
    personaB: 'fairness_scorekeeper',
    scenarioIds: ['child_sick_exchange', 'doctor_appointment_conflict'],
    simulationWeeks: 6,
  },

  // ── Fairness-Sensitive ──
  {
    name: 'Scorekeeper vs Organizer',
    description: 'School family, fairness-sensitive dad tracks every day, cooperative mom',
    children: [{ age: 6, name: 'Ava' }, { age: 10, name: 'Noah' }],
    parentA: { label: 'Mom', phone: '+15550003001' },
    parentB: { label: 'Dad', phone: '+15550003002' },
    template: '3-4-4-3',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 15,
    tags: ['fairness', '50/50', 'school'],
    personaA: 'cooperative_organizer',
    personaB: 'fairness_scorekeeper',
    scenarioIds: ['vacation_request', 'fairness_complaint', 'camp_week'],
    simulationWeeks: 8,
  },
  {
    name: 'Scorekeeper vs Flexible',
    description: 'Disorganized parent creates disruptions, other parent tracks balance',
    children: [{ age: 8, name: 'Mia' }],
    parentA: { label: 'Mom', phone: '+15550004001' },
    parentB: { label: 'Dad', phone: '+15550004002' },
    template: '2-2-3',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 12,
    tags: ['fairness', 'disruption-prone', '50/50'],
    personaA: 'flexible_disorganized',
    personaB: 'fairness_scorekeeper',
    scenarioIds: ['late_pickup', 'work_emergency', 'schedule_swap_chain'],
    simulationWeeks: 8,
  },

  // ── High Conflict ──
  {
    name: 'High Conflict / No Contact',
    description: 'Two children, 3-4-4-3, controller vs gamer, adversarial dynamics',
    children: [{ age: 5, name: 'Child 1' }, { age: 8, name: 'Child 2' }],
    parentA: { label: 'Parent A', phone: '+15550005001' },
    parentB: { label: 'Parent B', phone: '+15550005002' },
    template: '3-4-4-3',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 20,
    tags: ['high-conflict', 'no-contact', '50/50'],
    personaA: 'high_conflict_controller',
    personaB: 'strategic_gamer',
    scenarioIds: ['proposal_rejection_loop', 'strategic_gaming', 'fairness_complaint'],
    simulationWeeks: 8,
  },
  {
    name: 'Controller vs Scorekeeper',
    description: 'Frequent fairness disputes, rigid controller rejects proposals',
    children: [{ age: 7, name: 'Ethan' }, { age: 11, name: 'Sophia' }],
    parentA: { label: 'Parent A', phone: '+15550006001' },
    parentB: { label: 'Parent B', phone: '+15550006002' },
    template: 'alternating_weeks',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 18,
    tags: ['high-conflict', 'fairness-dispute'],
    personaA: 'high_conflict_controller',
    personaB: 'fairness_scorekeeper',
    scenarioIds: ['conflict_cascade', 'unilateral_schedule_change', 'parent_refuses_exchange'],
    simulationWeeks: 8,
  },

  // ── Avoidant / Low Engagement ──
  {
    name: 'Organizer vs Avoidant',
    description: 'One parent drives all decisions, other is slow or unresponsive',
    children: [{ age: 14, name: 'Olivia' }],
    parentA: { label: 'Mom', phone: '+15550007001' },
    parentB: { label: 'Dad', phone: '+15550007002' },
    template: 'every_other_weekend',
    targetSplit: 70,
    lockedNights: [{ parent: 'parent_a', daysOfWeek: [1, 2, 3, 4] }],
    distanceMiles: 25,
    tags: ['avoidant', 'teen', '70/30'],
    personaA: 'cooperative_organizer',
    personaB: 'avoidant_parent',
    scenarioIds: ['response_timeout', 'child_preference_conflict', 'parent_travel'],
    simulationWeeks: 8,
  },
  {
    name: 'Avoidant Pair',
    description: 'Both parents low-engagement, system must auto-resolve everything',
    children: [{ age: 9, name: 'Liam' }],
    parentA: { label: 'Parent A', phone: '+15550008001' },
    parentB: { label: 'Parent B', phone: '+15550008002' },
    template: '2-2-3',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 10,
    tags: ['avoidant', 'auto-resolve', '50/50'],
    personaA: 'avoidant_parent',
    personaB: 'avoidant_parent',
    scenarioIds: ['response_timeout', 'late_pickup', 'school_closed'],
    simulationWeeks: 6,
  },

  // ── Strategic / Gaming ──
  {
    name: 'Gamer vs Organizer',
    description: 'Strategic parent exploits disruptions, organizer moderates',
    children: [{ age: 6, name: 'Lucas' }, { age: 9, name: 'Ella' }],
    parentA: { label: 'Dad', phone: '+15550009001' },
    parentB: { label: 'Mom', phone: '+15550009002' },
    template: '3-4-4-3',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 14,
    tags: ['gaming', 'strategic', '50/50'],
    personaA: 'strategic_gamer',
    personaB: 'cooperative_organizer',
    scenarioIds: ['strategic_gaming', 'vacation_request', 'holiday_extension'],
    simulationWeeks: 8,
  },
  {
    name: 'Gamer vs Avoidant',
    description: 'Strategic parent takes advantage of disengaged co-parent',
    children: [{ age: 4, name: 'Harper' }],
    parentA: { label: 'Dad', phone: '+15550010001' },
    parentB: { label: 'Mom', phone: '+15550010002' },
    template: '5-2',
    targetSplit: 60,
    lockedNights: [{ parent: 'parent_a', daysOfWeek: [1, 2, 3, 4, 5] }],
    distanceMiles: 30,
    tags: ['gaming', 'avoidant', '60/40'],
    personaA: 'strategic_gamer',
    personaB: 'avoidant_parent',
    scenarioIds: ['extra_time_request', 'response_timeout', 'major_schedule_change_request'],
    simulationWeeks: 8,
  },

  // ── Long Distance / Logistics Stress ──
  {
    name: 'Long Distance 5-2',
    description: '45 miles apart, scorekeeper mom tracks balance, flexible dad',
    children: [{ age: 9, name: 'Mason' }],
    parentA: { label: 'Mom', phone: '+15550011001' },
    parentB: { label: 'Dad', phone: '+15550011002' },
    template: '5-2',
    targetSplit: 71,
    lockedNights: [{ parent: 'parent_a', daysOfWeek: [1, 2, 3, 4, 5] }],
    distanceMiles: 45,
    tags: ['long-distance', '70/30'],
    personaA: 'fairness_scorekeeper',
    personaB: 'flexible_disorganized',
    scenarioIds: ['transport_failure', 'late_pickup', 'long_distance_exchange'],
    simulationWeeks: 8,
  },

  // ── Multi-Child / Blended Stress ──
  {
    name: 'Blended Ages Stress Test',
    description: '3 kids (toddler to teen), compound disruptions, fairness pressure',
    children: [{ age: 3, name: 'Zoe' }, { age: 8, name: 'Aiden' }, { age: 13, name: 'Chloe' }],
    parentA: { label: 'Mom', phone: '+15550012001' },
    parentB: { label: 'Dad', phone: '+15550012002' },
    template: '3-4-4-3',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 12,
    tags: ['blended', 'stress-test', '50/50'],
    personaA: 'fairness_scorekeeper',
    personaB: 'cooperative_organizer',
    scenarioIds: ['compound_disruption', 'seasonal_chaos', 'child_activity_overload'],
    simulationWeeks: 10,
  },

  // ── Edge Case / Extreme ──
  {
    name: 'Maximum Adversarial',
    description: 'Infant, controller vs gamer, every major conflict scenario injected',
    children: [{ age: 0, name: 'Baby' }],
    parentA: { label: 'Parent A', phone: '+15550013001' },
    parentB: { label: 'Parent B', phone: '+15550013002' },
    template: '5-2',
    targetSplit: 70,
    lockedNights: [{ parent: 'parent_a', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }],
    distanceMiles: 8,
    tags: ['extreme', 'adversarial', 'infant'],
    personaA: 'high_conflict_controller',
    personaB: 'strategic_gamer',
    scenarioIds: ['conflict_cascade', 'parent_refuses_exchange', 'multi_disruption_overlap', 'court_order_update'],
    simulationWeeks: 8,
  },
  {
    name: 'Emergency Relocation',
    description: 'Teen, parent must relocate, complete schedule rebuild required',
    children: [{ age: 15, name: 'Jordan' }],
    parentA: { label: 'Mom', phone: '+15550014001' },
    parentB: { label: 'Dad', phone: '+15550014002' },
    template: 'alternating_weeks',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 20,
    tags: ['relocation', 'edge-case'],
    personaA: 'cooperative_organizer',
    personaB: 'fairness_scorekeeper',
    scenarioIds: ['emergency_relocation', 'child_preference_conflict', 'court_order_update'],
    simulationWeeks: 8,
  },
  {
    name: 'Holiday Gauntlet',
    description: 'School family through holiday season, every holiday scenario active',
    children: [{ age: 7, name: 'Aria' }, { age: 11, name: 'Owen' }],
    parentA: { label: 'Mom', phone: '+15550015001' },
    parentB: { label: 'Dad', phone: '+15550015002' },
    template: '2-2-3',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 15,
    tags: ['holiday', 'seasonal'],
    personaA: 'strategic_gamer',
    personaB: 'fairness_scorekeeper',
    scenarioIds: ['holiday_override', 'holiday_extension', 'religious_holiday_conflict', 'seasonal_chaos', 'family_wedding'],
    simulationWeeks: 10,
  },
];

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
