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
  {
    name: 'Standard 50/50 Alternating',
    description: 'Two school-age children, alternating weeks, cooperative parents',
    children: [{ age: 7, name: 'Child 1' }, { age: 10, name: 'Child 2' }],
    parentA: { label: 'Mom', phone: '+15550001001' },
    parentB: { label: 'Dad', phone: '+15550001002' },
    template: 'alternating_weeks',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 8,
    tags: ['standard', '50/50'],
  },
  {
    name: '2-2-3 with Locked Nights',
    description: 'Toddler, 2-2-3 pattern, Mom has Mon-Tue locked',
    children: [{ age: 3, name: 'Child 1' }],
    parentA: { label: 'Mom', phone: '+15550002001' },
    parentB: { label: 'Dad', phone: '+15550002002' },
    template: '2-2-3',
    targetSplit: 50,
    lockedNights: [{ parent: 'parent_a', daysOfWeek: [1, 2] }],
    distanceMiles: 15,
    tags: ['young-child', 'locked-nights', '50/50'],
  },
  {
    name: 'Primary Custody 70/30',
    description: 'Teen, every other weekend to Dad, school nights with Mom',
    children: [{ age: 14, name: 'Child 1' }],
    parentA: { label: 'Mom', phone: '+15550003001' },
    parentB: { label: 'Dad', phone: '+15550003002' },
    template: 'every_other_weekend',
    targetSplit: 70,
    lockedNights: [{ parent: 'parent_a', daysOfWeek: [1, 2, 3, 4] }],
    distanceMiles: 25,
    tags: ['primary', 'teen', '70/30'],
  },
  {
    name: 'High Conflict / No Contact',
    description: 'Two children, 3-4-4-3 pattern, no direct contact order',
    children: [{ age: 5, name: 'Child 1' }, { age: 8, name: 'Child 2' }],
    parentA: { label: 'Parent A', phone: '+15550004001' },
    parentB: { label: 'Parent B', phone: '+15550004002' },
    template: '3-4-4-3',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 20,
    tags: ['high-conflict', 'no-contact', '50/50'],
  },
  {
    name: 'Long Distance 5-2',
    description: 'School-age child, weekday parent A, weekend parent B, 45 miles apart',
    children: [{ age: 9, name: 'Child 1' }],
    parentA: { label: 'Mom', phone: '+15550005001' },
    parentB: { label: 'Dad', phone: '+15550005002' },
    template: '5-2',
    targetSplit: 71,
    lockedNights: [{ parent: 'parent_a', daysOfWeek: [1, 2, 3, 4, 5] }],
    distanceMiles: 45,
    tags: ['long-distance', 'primary'],
  },
];

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
