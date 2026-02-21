import { z } from 'zod';
import {
  AppState, Parent, Child, ScheduleAssignment, ChatMessage,
  ScenarioDefinition, Category, FairnessLedger,
} from './types';

// ─── Constants ─────────────────────────────────────────────────

export const PARENT_A_ID = 'parent-a-001';
export const PARENT_B_ID = 'parent-b-001';
export const CHILD_1_ID = 'child-001';
export const SIM_DATE = '2026-03-01';
export const SIM_TIMESTAMP = '2026-03-01T10:00:00.000Z';

// ─── Default Builders ──────────────────────────────────────────

export function defaultParentA(overrides?: Partial<Parent>): Parent {
  return {
    id: PARENT_A_ID,
    name: 'Alex',
    joined: true,
    preferences: { exchangeLocation: 'school', notificationMuted: false },
    constraints: { lockedNights: [], maxConsecutive: 5, workShifts: [], noInPersonExchange: false },
    ...overrides,
  };
}

export function defaultParentB(overrides?: Partial<Parent>): Parent {
  return {
    id: PARENT_B_ID,
    name: 'Jordan',
    joined: true,
    preferences: { exchangeLocation: 'school', notificationMuted: false },
    constraints: { lockedNights: [], maxConsecutive: 5, workShifts: [], noInPersonExchange: false },
    ...overrides,
  };
}

export function defaultChild(overrides?: Partial<Child>): Child {
  return {
    id: CHILD_1_ID,
    name: 'Riley',
    ageBand: 'school-age',
    schoolDays: [1, 2, 3, 4, 5],
    schoolStart: '08:00',
    schoolEnd: '15:00',
    ...overrides,
  };
}

export function defaultLedger(overrides?: Partial<FairnessLedger>): FairnessLedger {
  return {
    parentAOvernights: 42,
    parentBOvernights: 42,
    parentAWeekends: 6,
    parentBWeekends: 6,
    transitionsThisWeek: 2,
    maxConsecutiveA: 3,
    maxConsecutiveB: 3,
    ...overrides,
  };
}

export function defaultState(overrides?: Partial<AppState>): AppState {
  return {
    parents: [defaultParentA(), defaultParentB()],
    children: [defaultChild()],
    baselineSchedule: [],
    pendingProposals: [],
    ledger: defaultLedger(),
    holidays: [],
    activities: [],
    preConsentRules: [],
    subscriptions: [
      { parentId: PARENT_A_ID, plan: 'pro', status: 'active' },
      { parentId: PARENT_B_ID, plan: 'pro', status: 'active' },
    ],
    ...overrides,
  };
}

// ─── Schedule Generator ────────────────────────────────────────

export function generateSchedule(
  startDate: string,
  days: number,
  pattern: number[] = [3, 4],
): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  const start = new Date(startDate + 'T00:00:00Z');
  let parentIdx = 0;
  let streakCount = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const currentParent = parentIdx === 0 ? PARENT_A_ID : PARENT_B_ID;
    const prevParent = i > 0 ? assignments[i - 1].assignedTo : currentParent;

    assignments.push({
      date: d.toISOString().split('T')[0],
      assignedTo: currentParent,
      isTransition: currentParent !== prevParent,
    });

    streakCount++;
    if (streakCount >= pattern[parentIdx % pattern.length]) {
      parentIdx = (parentIdx + 1) % 2;
      streakCount = 0;
    }
  }

  return assignments;
}

export function stateWithSchedule(overrides?: Partial<AppState>): AppState {
  return defaultState({
    baselineSchedule: generateSchedule(SIM_DATE, 84),
    ...overrides,
  });
}

// ─── Message Builder ───────────────────────────────────────────

let msgSeq = 0;

export function resetMessageSeq(): void {
  msgSeq = 0;
}

export function msg(
  scenarioNumber: number,
  opts: {
    to: string[];
    text: string;
    urgency?: 'low' | 'normal' | 'high';
    expiresAt?: string;
    sections?: { title?: string; bullets?: string[] }[];
    actions: {
      actionId: string;
      label: string;
      style?: 'primary' | 'secondary' | 'danger';
      payload?: any;
    }[];
    metadata?: ChatMessage['metadata'];
  },
): ChatMessage {
  msgSeq++;
  return {
    messageId: `msg-${String(scenarioNumber).padStart(3, '0')}-${String(msgSeq).padStart(3, '0')}`,
    scenarioNumber,
    createdAt: SIM_TIMESTAMP,
    to: { parentIds: opts.to },
    urgency: opts.urgency ?? 'normal',
    expiresAt: opts.expiresAt,
    text: opts.text,
    sections: opts.sections,
    actions: opts.actions.map((a) => ({
      actionId: a.actionId,
      label: a.label,
      style: a.style ?? 'primary',
      payload: a.payload ?? {},
    })),
    metadata: opts.metadata,
  };
}

// ─── Stub Scenario Factory ─────────────────────────────────────

export function stub(
  number: number,
  key: string,
  title: string,
  category: Category,
  description: string,
): ScenarioDefinition {
  return {
    number,
    key,
    title,
    category,
    description,
    implemented: false,
    paramsSchema: z.object({}).passthrough(),
    seedStateBuilder: () => defaultState(),
    triggerEvent: (state) => {
      resetMessageSeq();
      return {
        state,
        outgoingMessages: [
          msg(number, {
            to: [PARENT_A_ID, PARENT_B_ID],
            text: `[Stub] ${title} — This scenario is defined but not yet fully implemented.`,
            actions: [{ actionId: 'acknowledge', label: 'OK', style: 'secondary' }],
          }),
        ],
      };
    },
  };
}
