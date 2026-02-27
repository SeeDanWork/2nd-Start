import { z } from 'zod';
import { ScenarioDefinition, CATEGORIES, AppState } from '../types';
import {
  PARENT_A_ID, PARENT_B_ID,
  stateWithSchedule, msg, resetMessageSeq, stub, SIM_DATE,
} from '../helpers';

// ─── 15. One-off swap request (FULL) ──────────────────────────

const scenario15: ScenarioDefinition = {
  number: 15,
  key: 'one-off-swap-request',
  title: 'One-off swap request',
  category: CATEGORIES.EXCEPTIONS,
  description: 'Request a day/time change; other parent reviews',
  implemented: true,
  paramsSchema: z.object({
    requestDate: z.string().default('2026-03-10'),
    requestedBy: z.string().default(PARENT_A_ID),
    reason: z.string().default('work_travel'),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    pendingProposals: [{
      id: 'proposal-001',
      requestedBy: params.requestedBy,
      type: 'swap',
      dates: [params.requestDate],
      status: 'pending',
    }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const requester = state.parents.find((p) => p.id === params.requestedBy);
    const responder = state.parents.find((p) => p.id !== params.requestedBy);
    const assignment = state.baselineSchedule.find((a) => a.date === params.requestDate);
    const currentlyWith = state.parents.find((p) => p.id === assignment?.assignedTo);
    return {
      state,
      outgoingMessages: [
        msg(15, {
          to: [responder!.id],
          text: `${requester?.name} is requesting a schedule change for ${params.requestDate}.`,
          sections: [
            { title: 'Request details', bullets: [
              `Date: ${params.requestDate}`,
              `Currently assigned to: ${currentlyWith?.name ?? 'unassigned'}`,
              `Reason: ${params.reason.replace('_', ' ')}`,
            ]},
            { title: 'Impact', bullets: [
              'This is a one-night swap',
              'Fairness balance stays within band',
              'Adds 1 extra handoff this week',
            ]},
          ],
          actions: [
            { actionId: 'approve', label: 'Approve Swap', style: 'primary', payload: { proposalId: 'proposal-001' } },
            { actionId: 'decline', label: 'Decline', style: 'danger', payload: { proposalId: 'proposal-001' } },
            { actionId: 'suggest-alternative', label: 'Suggest Alternative', style: 'secondary' },
          ],
          metadata: {
            relatesToDateRange: { start: params.requestDate, end: params.requestDate },
            scheduleDeltaPreview: {
              date: params.requestDate,
              from: assignment?.assignedTo,
              to: params.requestedBy,
            },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    approve: (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-001' ? { ...p, status: 'accepted' as const } : p,
      ),
    }),
    decline: (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-001' ? { ...p, status: 'declined' as const } : p,
      ),
    }),
    'suggest-alternative': (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-001' ? { ...p, status: 'counter' as const } : p,
      ),
    }),
  },
};

// ─── 16. Bundled swap request (stub) ──────────────────────────

const scenario16 = stub(16, 'bundled-swap-request', 'Bundled swap request', CATEGORIES.EXCEPTIONS,
  'Trade multiple dates as one proposal');

// ─── 17. Counterproposal selection (FULL) ─────────────────────

const scenario17: ScenarioDefinition = {
  number: 17,
  key: 'counterproposal-selection',
  title: 'Counterproposal selection',
  category: CATEGORIES.EXCEPTIONS,
  description: 'Choose 1 of suggested counterproposals after a decline',
  implemented: true,
  paramsSchema: z.object({
    originalDate: z.string().default('2026-03-10'),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    pendingProposals: [{
      id: 'proposal-002',
      requestedBy: PARENT_A_ID,
      type: 'swap',
      dates: [params.originalDate],
      status: 'counter',
      counterOptions: [
        { id: 'counter-1', label: 'Swap March 8 instead', dates: ['2026-03-08'] },
        { id: 'counter-2', label: 'Swap March 12 instead', dates: ['2026-03-12'] },
        { id: 'counter-3', label: 'Split: evening only on March 10', dates: ['2026-03-10'] },
      ],
    }],
  }),
  triggerEvent: (state) => {
    resetMessageSeq();
    const proposal = state.pendingProposals[0];
    return {
      state,
      outgoingMessages: [
        msg(17, {
          to: [PARENT_A_ID],
          text: `${state.parents[1].name} couldn't accommodate the original date but suggested alternatives. Choose one or decline all.`,
          sections: (proposal.counterOptions ?? []).map((c, i) => ({
            title: `Alternative ${i + 1}`,
            bullets: [c.label, `Dates: ${c.dates.join(', ')}`],
          })),
          actions: [
            ...(proposal.counterOptions ?? []).map((c, i) => ({
              actionId: `select-${c.id}`,
              label: c.label,
              style: (i === 0 ? 'primary' : 'secondary') as 'primary' | 'secondary',
              payload: { counterId: c.id, dates: c.dates },
            })),
            { actionId: 'decline-all', label: 'Decline All', style: 'danger' as const },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'select-counter-1': (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-002' ? { ...p, status: 'accepted' as const, dates: ['2026-03-08'] } : p,
      ),
    }),
    'decline-all': (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-002' ? { ...p, status: 'declined' as const } : p,
      ),
    }),
  },
};

// ─── 18. Partial acceptance (stub) ────────────────────────────

const scenario18 = stub(18, 'partial-acceptance', 'Partial acceptance', CATEGORIES.EXCEPTIONS,
  'Accept some dates but not others from a bundled request');

// ─── 19. Request for clarification (stub) ──────────────────────

const scenario19 = stub(19, 'request-for-clarification', 'Request for clarification', CATEGORIES.EXCEPTIONS,
  'What time? Which exchange location? Who drives?');

// ─── 20. Time-bounded decision (FULL) ──────────────────────────

const scenario20: ScenarioDefinition = {
  number: 20,
  key: 'time-bounded-decision',
  title: 'Time-bounded decision',
  category: CATEGORIES.EXCEPTIONS,
  description: 'Approve by X time or system proposes fallback',
  implemented: true,
  paramsSchema: z.object({
    requestDate: z.string().default('2026-03-10'),
    deadlineHours: z.number().default(24),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    pendingProposals: [{
      id: 'proposal-003',
      requestedBy: PARENT_A_ID,
      type: 'swap',
      dates: [params.requestDate],
      status: 'pending',
      expiresAt: '2026-03-09T10:00:00.000Z',
    }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(20, {
          to: [PARENT_B_ID],
          text: `A schedule change request needs your response within ${params.deadlineHours} hours. If no response is received, the original schedule will remain in effect.`,
          expiresAt: '2026-03-09T10:00:00.000Z',
          sections: [{
            title: 'Request',
            bullets: [
              `${state.parents[0].name} requests a swap on ${params.requestDate}`,
              `Deadline: ${params.deadlineHours} hours from now`,
              'No response = original schedule stands (no change)',
            ],
          }],
          actions: [
            { actionId: 'approve', label: 'Approve', style: 'primary' },
            { actionId: 'decline', label: 'Decline', style: 'danger' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    approve: (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-003' ? { ...p, status: 'accepted' as const } : p,
      ),
    }),
    decline: (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-003' ? { ...p, status: 'declined' as const } : p,
      ),
    }),
  },
  timeoutPolicy: {
    durationMinutes: 24 * 60,
    onTimeout: (state) => {
      resetMessageSeq();
      return {
        state: {
          ...state,
          pendingProposals: state.pendingProposals.map((p) =>
            p.id === 'proposal-003' ? { ...p, status: 'expired' as const } : p,
          ),
        },
        outgoingMessages: [
          msg(20, {
            to: [PARENT_A_ID, PARENT_B_ID],
            urgency: 'low',
            text: 'The response deadline has passed. The original schedule remains unchanged.',
            actions: [
              { actionId: 'acknowledge-timeout', label: 'OK', style: 'secondary' },
            ],
          }),
        ],
      };
    },
  },
};

export const exceptionScenarios: ScenarioDefinition[] = [
  scenario15, scenario16, scenario17, scenario18, scenario19, scenario20,
];
