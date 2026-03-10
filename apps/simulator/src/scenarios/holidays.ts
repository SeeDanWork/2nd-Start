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

// ─── 29. Upcoming holiday confirmation (FULL) ─────────────────

const scenario29: ScenarioDefinition = {
  number: 29,
  key: 'upcoming-holiday-confirmation',
  title: 'Upcoming holiday confirmation',
  category: CATEGORIES.HOLIDAYS,
  description: 'Holiday overrides baseline — confirm?',
  implemented: true,
  paramsSchema: z.object({
    holidayName: z.string().default('Christmas'),
    holidayDate: z.string().default('2026-12-25'),
    assignedTo: z.string().default(PARENT_A_ID),
    rule: z.string().default('rotate'),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    holidays: [{ date: params.holidayDate, name: params.holidayName, rule: params.rule, assignedTo: params.assignedTo }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const assigned = state.parents.find((p) => p.id === params.assignedTo);
    const other = state.parents.find((p) => p.id !== params.assignedTo);
    return {
      state,
      outgoingMessages: [
        msg(29, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `${params.holidayName} (${params.holidayDate}) is coming up. Per the ${params.rule} rule, ${assigned?.name} has ${state.children[0].name} this year.`,
          sections: [
            { title: 'Holiday plan', bullets: [
              `${params.holidayName}: ${params.holidayDate}`,
              `Assigned to: ${assigned?.name}`,
              `Rule: ${params.rule}`,
              `Next year: ${other?.name}`,
            ]},
          ],
          actions: [
            { actionId: 'confirm-holiday', label: 'Confirm', style: 'primary' },
            { actionId: 'request-swap', label: 'Request Swap', style: 'secondary' },
          ],
          metadata: {
            relatesToDateRange: { start: params.holidayDate, end: params.holidayDate },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'confirm-holiday': (state) => state,
    'request-swap': (state) => state,
  },
};

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

// ─── 31. Competing vacation requests (FULL) ───────────────────

const scenario31: ScenarioDefinition = {
  number: 31,
  key: 'competing-vacation-requests',
  title: 'Competing vacation requests',
  category: CATEGORIES.HOLIDAYS,
  description: 'System prompts negotiation for overlapping vacation requests',
  implemented: true,
  paramsSchema: z.object({
    parentADates: z.array(z.string()).default(['2026-07-10', '2026-07-17']),
    parentBDates: z.array(z.string()).default(['2026-07-14', '2026-07-21']),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    pendingProposals: [
      { id: 'vac-a', requestedBy: PARENT_A_ID, type: 'vacation', dates: params.parentADates, status: 'pending' },
      { id: 'vac-b', requestedBy: PARENT_B_ID, type: 'vacation', dates: params.parentBDates, status: 'pending' },
    ],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const parentA = state.parents[0];
    const parentB = state.parents[1];
    return {
      state,
      outgoingMessages: [
        msg(31, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'high',
          text: 'Both parents have requested overlapping vacation dates. The overlap needs to be resolved.',
          sections: [
            { title: `${parentA.name}'s request`, bullets: [
              `Dates: ${params.parentADates.join(' to ')}`,
            ]},
            { title: `${parentB.name}'s request`, bullets: [
              `Dates: ${params.parentBDates.join(' to ')}`,
            ]},
            { title: 'Resolution options', bullets: [
              `${parentA.name} keeps their dates, ${parentB.name} adjusts`,
              `${parentB.name} keeps their dates, ${parentA.name} adjusts`,
              'Split the overlap period between both parents',
            ]},
          ],
          actions: [
            { actionId: 'priority-a', label: `${parentA.name} Gets Priority`, style: 'primary' },
            { actionId: 'priority-b', label: `${parentB.name} Gets Priority`, style: 'primary' },
            { actionId: 'split-overlap', label: 'Split Overlap', style: 'secondary' },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'priority-a': (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'vac-a' ? { ...p, status: 'accepted' as const } :
        p.id === 'vac-b' ? { ...p, status: 'declined' as const } : p,
      ),
    }),
    'priority-b': (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'vac-b' ? { ...p, status: 'accepted' as const } :
        p.id === 'vac-a' ? { ...p, status: 'declined' as const } : p,
      ),
    }),
    'split-overlap': (state) => state,
  },
};

// ─── 32. School break schedule publish (FULL) ─────────────────

const scenario32: ScenarioDefinition = {
  number: 32,
  key: 'school-break-schedule-publish',
  title: 'School break schedule publish',
  category: CATEGORIES.HOLIDAYS,
  description: 'Confirm final published plan for school break',
  implemented: true,
  paramsSchema: z.object({
    breakName: z.string().default('Spring Break'),
    breakStart: z.string().default('2026-03-23'),
    breakEnd: z.string().default('2026-03-27'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const startD = new Date(params.breakStart + 'T00:00:00Z');
    const endD = new Date(params.breakEnd + 'T00:00:00Z');
    const days = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const halfDays = Math.floor(days / 2);
    return {
      state,
      outgoingMessages: [
        msg(32, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `${params.breakName} schedule (${params.breakStart} to ${params.breakEnd}) is ready for review.`,
          sections: [
            { title: 'Proposed plan', bullets: [
              `${state.parents[0].name}: first ${halfDays} days`,
              `${state.parents[1].name}: remaining ${days - halfDays} days`,
              'Handoff at midpoint of break',
            ]},
            { title: 'Note', bullets: [
              'This replaces the regular schedule during the break',
              'Regular schedule resumes after the break ends',
              'Both parents must confirm to finalize',
            ]},
          ],
          actions: [
            { actionId: 'confirm-break', label: 'Confirm Plan', style: 'primary' },
            { actionId: 'swap-halves', label: 'Swap Halves', style: 'secondary' },
            { actionId: 'custom-split', label: 'Custom Split', style: 'secondary' },
          ],
          metadata: {
            requiresBothParents: true,
            relatesToDateRange: { start: params.breakStart, end: params.breakEnd },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'confirm-break': (state) => state,
    'swap-halves': (state) => state,
    'custom-split': (state) => state,
  },
};

export const holidayScenarios: ScenarioDefinition[] = [
  scenario28, scenario29, scenario30, scenario31, scenario32,
];
