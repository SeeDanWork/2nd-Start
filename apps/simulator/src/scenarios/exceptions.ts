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

// ─── 16. Bundled swap request (FULL) ─────────────────────────

const scenario16: ScenarioDefinition = {
  number: 16,
  key: 'bundled-swap-request',
  title: 'Bundled swap request',
  category: CATEGORIES.EXCEPTIONS,
  description: 'Trade multiple dates as one proposal',
  implemented: true,
  paramsSchema: z.object({
    requestedBy: z.string().default(PARENT_A_ID),
    dates: z.array(z.string()).default(['2026-03-10', '2026-03-11', '2026-03-12']),
    reason: z.string().default('business trip'),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    pendingProposals: [{
      id: 'proposal-bundle-001',
      requestedBy: params.requestedBy,
      type: 'swap',
      dates: params.dates,
      status: 'pending',
    }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const requester = state.parents.find((p) => p.id === params.requestedBy);
    const responder = state.parents.find((p) => p.id !== params.requestedBy);
    return {
      state,
      outgoingMessages: [
        msg(16, {
          to: [responder!.id],
          text: `${requester?.name} is requesting a ${params.dates.length}-day schedule change (${params.dates.join(', ')}).`,
          sections: [
            { title: 'Request details', bullets: [
              `Dates: ${params.dates.join(', ')}`,
              `Reason: ${params.reason}`,
              `${params.dates.length} consecutive nights affected`,
            ]},
            { title: 'Impact', bullets: [
              `Fairness impact: ${params.dates.length} nights shift`,
              'Compensation days will be suggested if approved',
              'Both parents must agree to proceed',
            ]},
          ],
          actions: [
            { actionId: 'approve-all', label: 'Approve All', style: 'primary', payload: { proposalId: 'proposal-bundle-001' } },
            { actionId: 'decline-all', label: 'Decline All', style: 'danger' },
            { actionId: 'partial', label: 'Approve Some Dates', style: 'secondary' },
          ],
          metadata: {
            relatesToDateRange: { start: params.dates[0], end: params.dates[params.dates.length - 1] },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'approve-all': (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-bundle-001' ? { ...p, status: 'accepted' as const } : p,
      ),
    }),
    'decline-all': (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-bundle-001' ? { ...p, status: 'declined' as const } : p,
      ),
    }),
    partial: (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-bundle-001' ? { ...p, status: 'partial' as const } : p,
      ),
    }),
  },
};

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

// ─── 18. Partial acceptance (FULL) ───────────────────────────

const scenario18: ScenarioDefinition = {
  number: 18,
  key: 'partial-acceptance',
  title: 'Partial acceptance',
  category: CATEGORIES.EXCEPTIONS,
  description: 'Accept some dates but not others from a bundled request',
  implemented: true,
  paramsSchema: z.object({
    requestedDates: z.array(z.string()).default(['2026-03-10', '2026-03-11', '2026-03-12']),
    respondingParent: z.string().default(PARENT_B_ID),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    pendingProposals: [{
      id: 'proposal-partial-001',
      requestedBy: PARENT_A_ID,
      type: 'swap',
      dates: params.requestedDates,
      status: 'pending',
    }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const responder = state.parents.find((p) => p.id === params.respondingParent);
    const requester = state.parents.find((p) => p.id !== params.respondingParent);
    return {
      state,
      outgoingMessages: [
        msg(18, {
          to: [params.respondingParent],
          text: `${requester?.name} requested ${params.requestedDates.length} dates. You can accept all, some, or none.`,
          sections: [
            { title: 'Requested dates', bullets: params.requestedDates.map((d, i) =>
              `${d} — select individually below`,
            )},
          ],
          actions: [
            { actionId: 'accept-all', label: 'Accept All', style: 'primary' },
            ...params.requestedDates.map((d, i) => ({
              actionId: `accept-${d}`,
              label: `Accept ${d} only`,
              style: 'secondary' as const,
              payload: { acceptedDates: [d] },
            })),
            { actionId: 'decline-all', label: 'Decline All', style: 'danger' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'accept-all': (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-partial-001' ? { ...p, status: 'accepted' as const } : p,
      ),
    }),
    'decline-all': (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-partial-001' ? { ...p, status: 'declined' as const } : p,
      ),
    }),
  },
};

// ─── 19. Request for clarification (FULL) ─────────────────────

const scenario19: ScenarioDefinition = {
  number: 19,
  key: 'request-for-clarification',
  title: 'Request for clarification',
  category: CATEGORIES.EXCEPTIONS,
  description: 'What time? Which exchange location? Who drives?',
  implemented: true,
  paramsSchema: z.object({
    requestDate: z.string().default('2026-03-10'),
    requestedBy: z.string().default(PARENT_A_ID),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    pendingProposals: [{
      id: 'proposal-clarify-001',
      requestedBy: params.requestedBy,
      type: 'swap',
      dates: [params.requestDate],
      status: 'pending',
    }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const responder = state.parents.find((p) => p.id !== params.requestedBy);
    const requester = state.parents.find((p) => p.id === params.requestedBy);
    return {
      state,
      outgoingMessages: [
        msg(19, {
          to: [params.requestedBy],
          text: `${responder?.name} needs more details before deciding on the ${params.requestDate} swap.`,
          sections: [
            { title: 'Questions', bullets: [
              'What time would the handoff happen?',
              'Which exchange location works?',
              'Who handles transportation?',
            ]},
          ],
          actions: [
            { actionId: 'provide-details', label: 'Provide Details', style: 'primary' },
            { actionId: 'use-defaults', label: 'Use Default Settings', style: 'secondary' },
            { actionId: 'cancel-request', label: 'Cancel Request', style: 'danger' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'provide-details': (state) => state,
    'use-defaults': (state) => state,
    'cancel-request': (state) => ({
      ...state,
      pendingProposals: state.pendingProposals.map((p) =>
        p.id === 'proposal-clarify-001' ? { ...p, status: 'cancelled' as const } : p,
      ),
    }),
  },
};

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
