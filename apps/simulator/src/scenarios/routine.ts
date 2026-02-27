import { z } from 'zod';
import { ScenarioDefinition, CATEGORIES } from '../types';
import {
  PARENT_A_ID, PARENT_B_ID,
  stateWithSchedule, msg, resetMessageSeq, stub, SIM_DATE,
} from '../helpers';

// ─── 11. Reminder acknowledgements (FULL) ──────────────────────

const scenario11: ScenarioDefinition = {
  number: 11,
  key: 'reminder-acknowledgement',
  title: 'Reminder acknowledgements',
  category: CATEGORIES.ROUTINE,
  description: 'Handoff coming up; optional OK acknowledgement',
  implemented: true,
  paramsSchema: z.object({
    handoffDate: z.string().default('2026-03-04'),
    currentParent: z.string().default(PARENT_A_ID),
    receivingParent: z.string().default(PARENT_B_ID),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const current = state.parents.find((p) => p.id === params.currentParent);
    const receiving = state.parents.find((p) => p.id === params.receivingParent);
    const location = receiving?.preferences.exchangeLocation ?? 'school';
    return {
      state,
      outgoingMessages: [
        msg(11, {
          to: [params.currentParent, params.receivingParent],
          urgency: 'low',
          text: `Handoff reminder: ${state.children[0].name} transitions from ${current?.name} to ${receiving?.name} tomorrow at ${location}.`,
          sections: [{
            title: 'Details',
            bullets: [
              `Date: ${params.handoffDate}`,
              `Exchange at: ${location}`,
              `Current: ${current?.name} | Next: ${receiving?.name}`,
            ],
          }],
          actions: [
            { actionId: 'acknowledge', label: 'Got It', style: 'primary' },
            { actionId: 'flag-issue', label: 'Flag an Issue', style: 'secondary' },
          ],
          metadata: {
            relatesToDateRange: { start: params.handoffDate, end: params.handoffDate },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    acknowledge: (state) => state,
    'flag-issue': (state) => state,
  },
};

// ─── 12. Handoff status updates (FULL) ─────────────────────────

const scenario12: ScenarioDefinition = {
  number: 12,
  key: 'handoff-status-update',
  title: 'Handoff status updates',
  category: CATEGORIES.ROUTINE,
  description: 'On my way / running late / arrived / pickup complete',
  implemented: true,
  paramsSchema: z.object({
    handoffDate: z.string().default('2026-03-04'),
    droppingOffParent: z.string().default(PARENT_A_ID),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const parent = state.parents.find((p) => p.id === params.droppingOffParent);
    return {
      state,
      outgoingMessages: [
        msg(12, {
          to: [params.droppingOffParent],
          text: `Today is exchange day. Update your status so ${state.parents.find((p) => p.id !== params.droppingOffParent)?.name} knows what to expect.`,
          actions: [
            { actionId: 'on-my-way', label: 'On My Way', style: 'primary', payload: { status: 'on_my_way' } },
            { actionId: 'running-late', label: 'Running Late', style: 'secondary', payload: { status: 'running_late' } },
            { actionId: 'arrived', label: 'Arrived', style: 'primary', payload: { status: 'arrived' } },
            { actionId: 'pickup-complete', label: 'Pickup Complete', style: 'primary', payload: { status: 'pickup_complete' } },
          ],
          metadata: {
            relatesToDateRange: { start: params.handoffDate, end: params.handoffDate },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'on-my-way': (state) => state,
    'running-late': (state) => state,
    arrived: (state) => state,
    'pickup-complete': (state) => state,
  },
};

// ─── 13. Missed check-in (FULL) ───────────────────────────────

const scenario13: ScenarioDefinition = {
  number: 13,
  key: 'missed-check-in',
  title: 'Missed check-in',
  category: CATEGORIES.ROUTINE,
  description: 'System asks if pickup happened; confirm who has child',
  implemented: true,
  paramsSchema: z.object({
    handoffDate: z.string().default('2026-03-04'),
    expectedParent: z.string().default(PARENT_B_ID),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const expected = state.parents.find((p) => p.id === params.expectedParent);
    const other = state.parents.find((p) => p.id !== params.expectedParent);
    const child = state.children[0];
    return {
      state,
      outgoingMessages: [
        msg(13, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'high',
          text: `We haven't received a check-in for today's exchange. Please confirm who has ${child.name}.`,
          sections: [{
            title: 'Expected plan',
            bullets: [
              `Date: ${params.handoffDate}`,
              `${child.name} was expected to be with ${expected?.name}`,
            ],
          }],
          actions: [
            { actionId: 'with-expected', label: `${child.name} is with ${expected?.name}`, style: 'primary', payload: { withParent: params.expectedParent } },
            { actionId: 'with-other', label: `${child.name} is with ${other?.name}`, style: 'secondary', payload: { withParent: other?.id } },
          ],
          metadata: {
            relatesToDateRange: { start: params.handoffDate, end: params.handoffDate },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'with-expected': (state) => state,
    'with-other': (state) => state,
  },
  timeoutPolicy: {
    durationMinutes: 60,
    onTimeout: (state) => {
      resetMessageSeq();
      return {
        state,
        outgoingMessages: [
          msg(13, {
            to: [PARENT_A_ID, PARENT_B_ID],
            urgency: 'high',
            text: 'No response received. The schedule will remain as planned. Please update if the situation differs.',
            actions: [
              { actionId: 'acknowledge-timeout', label: 'OK', style: 'secondary' },
            ],
          }),
        ],
      };
    },
  },
};

// ─── 14. Change-of-location confirmation (stub) ────────────────

const scenario14 = stub(14, 'change-of-location', 'Change-of-location confirmation', CATEGORIES.ROUTINE,
  'Handoff moved from school to curb/home');

export const routineScenarios: ScenarioDefinition[] = [
  scenario11, scenario12, scenario13, scenario14,
];
