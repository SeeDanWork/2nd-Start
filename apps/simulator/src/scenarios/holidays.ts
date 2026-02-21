import { z } from 'zod';
import { ScenarioDefinition, CATEGORIES } from '../types';
import {
  PARENT_A_ID, PARENT_B_ID,
  defaultState, stateWithSchedule, msg, resetMessageSeq, stub,
} from '../helpers';

// ─── 28. Holiday rule selection (FULL) ─────────────────────────

const scenario28: ScenarioDefinition = {
  number: 28,
  key: 'holiday-rule-selection',
  title: 'Holiday rule selection',
  category: CATEGORIES.HOLIDAYS,
  description: 'Rotate/split/attach-to-weekend for holiday handling',
  implemented: true,
  paramsSchema: z.object({
    holidayName: z.string().default('Thanksgiving'),
    holidayDate: z.string().default('2026-11-26'),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    holidays: [{ date: params.holidayDate, name: params.holidayName, rule: 'unset' }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(28, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `${params.holidayName} is on ${params.holidayDate}. Choose how to handle this holiday in your schedule.`,
          sections: [{
            title: 'Options',
            bullets: [
              'Rotate yearly: one parent gets it this year, the other next year',
              'Split the day: morning with one parent, evening with the other',
              'Attach to weekend parent: whoever has the adjacent weekend keeps the holiday',
            ],
          }],
          actions: [
            { actionId: 'rotate', label: 'Rotate Yearly', style: 'primary', payload: { rule: 'rotate' } },
            { actionId: 'split', label: 'Split the Day', style: 'secondary', payload: { rule: 'split' } },
            { actionId: 'attach-weekend', label: 'Weekend Parent Keeps It', style: 'secondary', payload: { rule: 'attach-weekend' } },
          ],
          metadata: {
            requiresBothParents: true,
            relatesToDateRange: { start: params.holidayDate, end: params.holidayDate },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    rotate: (state) => ({
      ...state,
      holidays: state.holidays.map((h) =>
        h.name === 'Thanksgiving' ? { ...h, rule: 'rotate' as const, assignedTo: PARENT_A_ID } : h,
      ),
    }),
    split: (state) => ({
      ...state,
      holidays: state.holidays.map((h) =>
        h.name === 'Thanksgiving' ? { ...h, rule: 'split' as const } : h,
      ),
    }),
    'attach-weekend': (state) => ({
      ...state,
      holidays: state.holidays.map((h) =>
        h.name === 'Thanksgiving' ? { ...h, rule: 'attach-weekend' as const } : h,
      ),
    }),
  },
};

// ─── 29. Upcoming holiday confirmation (stub) ──────────────────

const scenario29 = stub(29, 'upcoming-holiday-confirmation', 'Upcoming holiday confirmation', CATEGORIES.HOLIDAYS,
  'Holiday overrides baseline—confirm?');

// ─── 30. Vacation block request (FULL) ─────────────────────────

const scenario30: ScenarioDefinition = {
  number: 30,
  key: 'vacation-block-request',
  title: 'Vacation block request',
  category: CATEGORIES.HOLIDAYS,
  description: 'Reserve dates for vacation; confirm travel days',
  implemented: true,
  paramsSchema: z.object({
    startDate: z.string().default('2026-06-15'),
    endDate: z.string().default('2026-06-22'),
    requestedBy: z.string().default(PARENT_A_ID),
    destination: z.string().default('Beach trip'),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    pendingProposals: [{
      id: 'vacation-001',
      requestedBy: params.requestedBy,
      type: 'vacation',
      dates: [params.startDate, params.endDate],
      status: 'pending',
    }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const requester = state.parents.find((p) => p.id === params.requestedBy);
    const responder = state.parents.find((p) => p.id !== params.requestedBy);
    const startD = new Date(params.startDate + 'T00:00:00Z');
    const endD = new Date(params.endDate + 'T00:00:00Z');
    const nights = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));
    return {
      state,
      outgoingMessages: [
        msg(30, {
          to: [responder!.id],
          text: `${requester?.name} is requesting a vacation block with ${state.children[0].name}.`,
          sections: [
            { title: 'Vacation details', bullets: [
              `${params.destination}`,
              `Dates: ${params.startDate} to ${params.endDate} (${nights} nights)`,
              `${requester?.name} will have ${state.children[0].name} for the full period`,
            ]},
            { title: 'Impact', bullets: [
              `${nights} nights shift to ${requester?.name}`,
              'Fairness will rebalance over the following weeks',
            ]},
          ],
          actions: [
            { actionId: 'approve', label: 'Approve Vacation', style: 'primary', payload: { proposalId: 'vacation-001' } },
            { actionId: 'decline', label: 'Decline', style: 'danger' },
            { actionId: 'suggest-changes', label: 'Suggest Different Dates', style: 'secondary' },
          ],
          metadata: {
            relatesToDateRange: { start: params.startDate, end: params.endDate },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    approve: (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'vacation-001' ? { ...p, status: 'accepted' as const } : p,
      ),
    }),
    decline: (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'vacation-001' ? { ...p, status: 'declined' as const } : p,
      ),
    }),
  },
};

// ─── 31. Competing vacation requests (stub) ────────────────────

const scenario31 = stub(31, 'competing-vacation-requests', 'Competing vacation requests', CATEGORIES.HOLIDAYS,
  'System prompts negotiation for overlapping vacation requests');

// ─── 32. School break schedule publish (stub) ──────────────────

const scenario32 = stub(32, 'school-break-schedule-publish', 'School break schedule publish', CATEGORIES.HOLIDAYS,
  'Confirm final published plan for school break');

export const holidayScenarios: ScenarioDefinition[] = [
  scenario28, scenario29, scenario30, scenario31, scenario32,
];
