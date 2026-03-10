import { create } from 'zustand';
import {
  DisruptionEventType,
  RequestType,
  RequestUrgency,
  ParentRole,
} from '@adcp/shared';

// ─── Types ─────────────────────────────────────────────────────────

export interface FamilyConfig {
  childCount: number;
  childAges: number[];
  distanceMiles: number;
  targetSplit: number; // 50 = 50/50
  schoolAnchor: string;
  exchangeLocation: string;
  arrangement: 'shared' | 'primary_visits' | 'undecided';
}

export interface ConstraintConfig {
  lockedNights: Record<string, string>; // day -> parent
  maxConsecutive: number;
  minConsecutive: number;
  maxTransitionsPerWeek: number;
  weekendSplit: 'alternating' | 'split' | 'none';
  fairnessBand: number; // percent
}

export interface DisruptionEntry {
  id: string;
  type: DisruptionEventType;
  startDate: string;
  endDate: string;
  affectedParent?: string;
  description: string;
}

export interface RequestEntry {
  id: string;
  type: RequestType;
  urgency: RequestUrgency;
  requestingParent: ParentRole;
  dates: string[];
  reason: string;
}

export interface ScheduleDay {
  date: string;
  assignedTo: 'parent_a' | 'parent_b';
  isHandoff: boolean;
  disruption?: DisruptionEventType;
  isLocked: boolean;
  source: 'template' | 'disruption' | 'manual' | 'solver';
}

export interface SolverTrace {
  runId: number;
  timestamp: string;
  status: string;
  penaltyScore: number;
  tieBreakRanking: string[];
  selectedTemplate: string;
  durationMs: number;
}

export interface MetricsSnapshot {
  parentANights: number;
  parentBNights: number;
  parentAPercent: number;
  transitionsPerWeek: number;
  maxConsecutiveA: number;
  maxConsecutiveB: number;
  weekendBalanceA: number;
  weekendBalanceB: number;
  stabilityScore: number;
}

export interface EventLogEntry {
  id: string;
  timestamp: string;
  category: 'disruption' | 'solver' | 'proposal' | 'mediation' | 'system';
  message: string;
  details?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'system';
  text: string;
  parsedIntent?: {
    type: string;
    dateRange?: string;
    parent?: string;
    confidence: number;
  };
  systemResult?: {
    action: string;
    proposals?: number;
    explanation: string;
  };
}

export interface ScenarioPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  family: FamilyConfig;
  constraints: ConstraintConfig;
  disruptions: DisruptionEntry[];
}

// ─── Store ─────────────────────────────────────────────────────────

interface ScenarioState {
  // Family
  family: FamilyConfig;
  setFamily: (f: Partial<FamilyConfig>) => void;

  // Constraints
  constraints: ConstraintConfig;
  setConstraints: (c: Partial<ConstraintConfig>) => void;

  // Disruptions
  disruptions: DisruptionEntry[];
  addDisruption: (d: DisruptionEntry) => void;
  removeDisruption: (id: string) => void;
  clearDisruptions: () => void;

  // Requests
  requests: RequestEntry[];
  addRequest: (r: RequestEntry) => void;
  removeRequest: (id: string) => void;

  // Schedule
  schedule: ScheduleDay[];
  setSchedule: (s: ScheduleDay[]) => void;

  // Solver
  solverTraces: SolverTrace[];
  addSolverTrace: (t: SolverTrace) => void;
  solverRunCount: number;

  // Metrics
  metrics: MetricsSnapshot;
  setMetrics: (m: MetricsSnapshot) => void;

  // Event log
  eventLog: EventLogEntry[];
  addEvent: (e: EventLogEntry) => void;
  clearLog: () => void;

  // Chat (per-parent)
  chatMessagesA: ChatMessage[];
  chatMessagesB: ChatMessage[];
  addChatMessage: (parent: 'a' | 'b', m: ChatMessage) => void;
  clearChat: (parent: 'a' | 'b') => void;

  // Time
  currentDate: string;
  setCurrentDate: (d: string) => void;
  advanceDays: (n: number) => void;

  // Scenario management
  scenarioName: string;
  setScenarioName: (n: string) => void;
  loadPreset: (p: ScenarioPreset) => void;
  reset: () => void;

  // UI state
  isRunning: boolean;
  setIsRunning: (r: boolean) => void;
  activeBottomTab: 'metrics' | 'solver' | 'log' | 'constraints';
  setActiveBottomTab: (t: 'metrics' | 'solver' | 'log' | 'constraints') => void;
}

const DEFAULT_FAMILY: FamilyConfig = {
  childCount: 2,
  childAges: [6, 10],
  distanceMiles: 12,
  targetSplit: 50,
  schoolAnchor: 'Elementary School',
  exchangeLocation: 'At School',
  arrangement: 'shared',
};

const DEFAULT_CONSTRAINTS: ConstraintConfig = {
  lockedNights: {},
  maxConsecutive: 7,
  minConsecutive: 2,
  maxTransitionsPerWeek: 3,
  weekendSplit: 'alternating',
  fairnessBand: 5,
};

const DEFAULT_METRICS: MetricsSnapshot = {
  parentANights: 0,
  parentBNights: 0,
  parentAPercent: 50,
  transitionsPerWeek: 0,
  maxConsecutiveA: 0,
  maxConsecutiveB: 0,
  weekendBalanceA: 50,
  weekendBalanceB: 50,
  stabilityScore: 0,
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

let nextEventId = 1;
function eventId(): string {
  return `evt-${nextEventId++}`;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  family: { ...DEFAULT_FAMILY },
  setFamily: (f) => set((s) => ({ family: { ...s.family, ...f } })),

  constraints: { ...DEFAULT_CONSTRAINTS },
  setConstraints: (c) => set((s) => ({ constraints: { ...s.constraints, ...c } })),

  disruptions: [],
  addDisruption: (d) => set((s) => ({
    disruptions: [...s.disruptions, d],
    eventLog: [...s.eventLog, {
      id: eventId(),
      timestamp: new Date().toISOString(),
      category: 'disruption',
      message: `Disruption added: ${d.type}`,
      details: `${d.startDate} to ${d.endDate}`,
    }],
  })),
  removeDisruption: (id) => set((s) => ({
    disruptions: s.disruptions.filter((d) => d.id !== id),
  })),
  clearDisruptions: () => set({ disruptions: [] }),

  requests: [],
  addRequest: (r) => set((s) => ({
    requests: [...s.requests, r],
    eventLog: [...s.eventLog, {
      id: eventId(),
      timestamp: new Date().toISOString(),
      category: 'proposal',
      message: `Request created: ${r.type}`,
      details: `${r.requestingParent} — ${r.dates.join(', ')}`,
    }],
  })),
  removeRequest: (id) => set((s) => ({
    requests: s.requests.filter((r) => r.id !== id),
  })),

  schedule: [],
  setSchedule: (s) => set({ schedule: s }),

  solverTraces: [],
  addSolverTrace: (t) => set((s) => ({
    solverTraces: [...s.solverTraces, t],
    solverRunCount: s.solverRunCount + 1,
  })),
  solverRunCount: 0,

  metrics: { ...DEFAULT_METRICS },
  setMetrics: (m) => set({ metrics: m }),

  eventLog: [],
  addEvent: (e) => set((s) => ({ eventLog: [...s.eventLog, e] })),
  clearLog: () => set({ eventLog: [] }),

  chatMessagesA: [],
  chatMessagesB: [],
  addChatMessage: (parent, m) => set((s) => (
    parent === 'a'
      ? { chatMessagesA: [...s.chatMessagesA, m] }
      : { chatMessagesB: [...s.chatMessagesB, m] }
  )),
  clearChat: (parent) => set(
    parent === 'a' ? { chatMessagesA: [] } : { chatMessagesB: [] }
  ),

  currentDate: todayStr(),
  setCurrentDate: (d) => set({ currentDate: d }),
  advanceDays: (n) => set((s) => {
    const newDate = addDaysToDate(s.currentDate, n);
    return {
      currentDate: newDate,
      eventLog: [...s.eventLog, {
        id: eventId(),
        timestamp: new Date().toISOString(),
        category: 'system',
        message: `Time advanced ${n} days`,
        details: `Now: ${newDate}`,
      }],
    };
  }),

  scenarioName: 'Untitled Scenario',
  setScenarioName: (n) => set({ scenarioName: n }),
  loadPreset: (p) => set({
    family: { ...p.family },
    constraints: { ...p.constraints },
    disruptions: [...p.disruptions],
    requests: [],
    schedule: [],
    solverTraces: [],
    solverRunCount: 0,
    metrics: { ...DEFAULT_METRICS },
    eventLog: [{
      id: eventId(),
      timestamp: new Date().toISOString(),
      category: 'system',
      message: `Loaded scenario: ${p.name}`,
    }],
    chatMessagesA: [],
    chatMessagesB: [],
    scenarioName: p.name,
    currentDate: todayStr(),
  }),
  reset: () => set({
    family: { ...DEFAULT_FAMILY },
    constraints: { ...DEFAULT_CONSTRAINTS },
    disruptions: [],
    requests: [],
    schedule: [],
    solverTraces: [],
    solverRunCount: 0,
    metrics: { ...DEFAULT_METRICS },
    eventLog: [],
    chatMessagesA: [],
    chatMessagesB: [],
    scenarioName: 'Untitled Scenario',
    currentDate: todayStr(),
    isRunning: false,
  }),

  isRunning: false,
  setIsRunning: (r) => set({ isRunning: r }),
  activeBottomTab: 'metrics',
  setActiveBottomTab: (t) => set({ activeBottomTab: t }),
}));
