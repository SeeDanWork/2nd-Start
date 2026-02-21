import { z } from 'zod';
import { ScenarioDefinition, CATEGORIES } from '../types';
import {
  PARENT_A_ID, PARENT_B_ID, CHILD_1_ID,
  defaultState, defaultParentA, defaultParentB, defaultChild,
  stateWithSchedule, generateSchedule, msg, resetMessageSeq, stub, SIM_DATE,
} from '../helpers';

// ─── 1. Invite other parent (FULL) ────────────────────────────

const scenario1: ScenarioDefinition = {
  number: 1,
  key: 'invite-other-parent',
  title: 'Invite other parent',
  category: CATEGORIES.ONBOARDING,
  description: 'Accept/decline join invitation; set preferred contact channel',
  implemented: true,
  paramsSchema: z.object({
    inviteeName: z.string().default('Jordan'),
    contactChannel: z.enum(['email', 'sms', 'in-app']).default('in-app'),
  }),
  seedStateBuilder: (params) => defaultState({
    parents: [
      defaultParentA(),
      defaultParentB({ name: params.inviteeName, joined: false }),
    ],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const inviter = state.parents[0];
    return {
      state,
      outgoingMessages: [
        msg(1, {
          to: [state.parents[1].id],
          text: `${inviter.name} has invited you to co-parent on this app. Accept to start building your shared schedule.`,
          sections: [{
            title: 'What happens next',
            bullets: [
              'Set up your child\'s profile together',
              'Define your scheduling preferences',
              'Choose a fair schedule from generated options',
            ],
          }],
          actions: [
            { actionId: 'accept', label: 'Accept Invitation', style: 'primary', payload: { channel: params.contactChannel } },
            { actionId: 'decline', label: 'Decline', style: 'danger' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    accept: (state) => ({
      ...state,
      parents: state.parents.map((p) =>
        p.id === PARENT_B_ID ? { ...p, joined: true } : p,
      ),
    }),
    decline: (state) => state,
  },
  timeoutPolicy: {
    durationMinutes: 72 * 60,
    onTimeout: (state) => {
      resetMessageSeq();
      return {
        state,
        outgoingMessages: [
          msg(1, {
            to: [PARENT_A_ID],
            urgency: 'low',
            text: 'Your invitation is still pending. Would you like to send a reminder?',
            actions: [
              { actionId: 'resend', label: 'Send Reminder', style: 'primary' },
              { actionId: 'cancel-invite', label: 'Cancel Invitation', style: 'secondary' },
            ],
          }),
        ],
      };
    },
  },
};

// ─── 2. Confirm child profile (stub) ──────────────────────────

const scenario2 = stub(2, 'confirm-child-profile', 'Confirm child profile', CATEGORIES.ONBOARDING,
  'Confirm age band, school/daycare schedule for each child');

// ─── 3. Confirm exchange defaults (stub) ───────────────────────

const scenario3 = stub(3, 'confirm-exchange-defaults', 'Confirm exchange defaults', CATEGORIES.ONBOARDING,
  'School/daycare exchange preference, fallback location');

// ─── 4. Confirm hard constraints (stub) ────────────────────────

const scenario4 = stub(4, 'confirm-hard-constraints', 'Confirm hard constraints', CATEGORIES.ONBOARDING,
  'Locked nights, work shifts, no in-person exchange');

// ─── 5. Resolve conflicting constraints (FULL) ────────────────

const scenario5: ScenarioDefinition = {
  number: 5,
  key: 'resolve-conflicting-constraints',
  title: 'Resolve conflicting constraints',
  category: CATEGORIES.ONBOARDING,
  description: 'System flags infeasible inputs; asks which constraint to relax',
  implemented: true,
  paramsSchema: z.object({
    conflictDay: z.number().int().min(0).max(6).default(2),
  }),
  seedStateBuilder: (params) => defaultState({
    parents: [
      defaultParentA({ constraints: { lockedNights: [params.conflictDay], maxConsecutive: 5, workShifts: [], noInPersonExchange: false } }),
      defaultParentB({ constraints: { lockedNights: [params.conflictDay], maxConsecutive: 5, workShifts: [], noInPersonExchange: false } }),
    ],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[params.conflictDay];
    const parentA = state.parents[0];
    const parentB = state.parents[1];
    return {
      state,
      outgoingMessages: [
        msg(5, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `Both parents have locked ${dayName} night. Only one parent can be assigned per night. Choose how to resolve this.`,
          sections: [
            { title: 'Conflict details', bullets: [
              `${parentA.name} locked ${dayName}`,
              `${parentB.name} locked ${dayName}`,
              'The schedule cannot satisfy both constraints simultaneously.',
            ]},
            { title: 'Options', bullets: [
              `Keep ${parentA.name}'s lock, remove ${parentB.name}'s`,
              `Keep ${parentB.name}'s lock, remove ${parentA.name}'s`,
              'Alternate this night every other week',
            ]},
          ],
          actions: [
            { actionId: 'keep-a', label: `Keep ${parentA.name}'s Lock`, style: 'primary', payload: { keep: PARENT_A_ID } },
            { actionId: 'keep-b', label: `Keep ${parentB.name}'s Lock`, style: 'primary', payload: { keep: PARENT_B_ID } },
            { actionId: 'alternate', label: 'Alternate Weekly', style: 'secondary', payload: { alternate: true } },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'keep-a': (state, payload) => ({
      ...state,
      parents: state.parents.map((p) =>
        p.id === PARENT_B_ID
          ? { ...p, constraints: { ...p.constraints, lockedNights: [] } }
          : p,
      ),
    }),
    'keep-b': (state) => ({
      ...state,
      parents: state.parents.map((p) =>
        p.id === PARENT_A_ID
          ? { ...p, constraints: { ...p.constraints, lockedNights: [] } }
          : p,
      ),
    }),
    alternate: (state) => ({
      ...state,
      parents: state.parents.map((p) => ({
        ...p, constraints: { ...p.constraints, lockedNights: [] },
      })),
    }),
  },
};

// ─── 6. Choose schedule option (FULL) ──────────────────────────

const scenario6: ScenarioDefinition = {
  number: 6,
  key: 'choose-schedule-option',
  title: 'Choose schedule option',
  category: CATEGORIES.ONBOARDING,
  description: 'Pick 1 of 3-5 generated schedule options',
  implemented: true,
  paramsSchema: z.object({
    numOptions: z.number().int().min(2).max(5).default(3),
  }),
  seedStateBuilder: () => defaultState(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const options = [];
    const patterns = [
      { name: 'Balanced 3/4', pattern: [3, 4], handoffs: 2, score: 92 },
      { name: 'Week On/Off', pattern: [7, 7], handoffs: 1, score: 85 },
      { name: 'Short Rotation 2/2/3', pattern: [2, 2, 3], handoffs: 3, score: 88 },
      { name: 'Extended 5/2', pattern: [5, 2], handoffs: 2, score: 80 },
      { name: 'Equal 3.5/3.5', pattern: [4, 3], handoffs: 2, score: 90 },
    ];
    for (let i = 0; i < params.numOptions && i < patterns.length; i++) {
      const p = patterns[i];
      const sched = generateSchedule(SIM_DATE, 14, p.pattern);
      const aNights = sched.filter((a) => a.assignedTo === PARENT_A_ID).length;
      const bNights = sched.length - aNights;
      options.push({
        id: `option-${i + 1}`,
        name: p.name,
        aNights,
        bNights,
        handoffsPerWeek: p.handoffs,
        score: p.score,
      });
    }
    return {
      state,
      outgoingMessages: [
        msg(6, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `We generated ${options.length} schedule options based on your constraints. Review and choose the one that works best for your family.`,
          sections: options.map((o) => ({
            title: `Option ${o.id.split('-')[1]}: ${o.name}`,
            bullets: [
              `${state.parents[0].name}: ${o.aNights} nights / ${state.parents[1].name}: ${o.bNights} nights per 2 weeks`,
              `${o.handoffsPerWeek} handoffs per week`,
              `Stability score: ${o.score}/100`,
            ],
          })),
          actions: options.map((o, i) => ({
            actionId: `select-${o.id}`,
            label: `Choose ${o.name}`,
            style: (i === 0 ? 'primary' : 'secondary') as 'primary' | 'secondary',
            payload: { optionId: o.id, pattern: patterns[i].pattern },
          })),
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'select-option-1': (state) => ({
      ...state,
      baselineSchedule: generateSchedule(SIM_DATE, 84, [3, 4]),
    }),
    'select-option-2': (state) => ({
      ...state,
      baselineSchedule: generateSchedule(SIM_DATE, 84, [7, 7]),
    }),
    'select-option-3': (state) => ({
      ...state,
      baselineSchedule: generateSchedule(SIM_DATE, 84, [2, 2, 3]),
    }),
  },
};

// ─── 7. Confirm schedule start date (stub) ─────────────────────

const scenario7 = stub(7, 'confirm-schedule-start-date', 'Confirm schedule start date', CATEGORIES.ONBOARDING,
  'Start next Monday vs today');

// ─── 8. Confirm special rules (stub) ───────────────────────────

const scenario8 = stub(8, 'confirm-special-rules', 'Confirm special rules', CATEGORIES.ONBOARDING,
  'Max handoffs/week, max consecutive days away, quiet hours');

// ─── 9. Confirm pre-consent rules (stub) ───────────────────────

const scenario9 = stub(9, 'confirm-pre-consent-rules', 'Confirm pre-consent rules', CATEGORIES.ONBOARDING,
  'Auto-approve swaps under certain conditions');

// ─── 10. Finalize baseline schedule (FULL) ─────────────────────

const scenario10: ScenarioDefinition = {
  number: 10,
  key: 'finalize-baseline-schedule',
  title: 'Finalize baseline schedule',
  category: CATEGORIES.ONBOARDING,
  description: 'Both parents tap "agree" to confirm the selected schedule',
  implemented: true,
  paramsSchema: z.object({}),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state) => {
    resetMessageSeq();
    const sched = state.baselineSchedule;
    const aNights = sched.filter((a) => a.assignedTo === PARENT_A_ID).length;
    const bNights = sched.length - aNights;
    const transitions = sched.filter((a) => a.isTransition).length;
    return {
      state,
      outgoingMessages: [
        msg(10, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: 'Review the final schedule below. Both parents must confirm to activate it.',
          sections: [
            { title: 'Schedule summary', bullets: [
              `${state.parents[0].name}: ${aNights} nights over 12 weeks`,
              `${state.parents[1].name}: ${bNights} nights over 12 weeks`,
              `${transitions} total handoffs`,
              `Starts: ${sched[0]?.date ?? 'N/A'}`,
            ]},
          ],
          actions: [
            { actionId: 'confirm', label: 'Confirm Schedule', style: 'primary' },
            { actionId: 'request-changes', label: 'Request Changes', style: 'secondary' },
          ],
          metadata: {
            requiresBothParents: true,
            relatesToDateRange: {
              start: sched[0]?.date ?? SIM_DATE,
              end: sched[sched.length - 1]?.date ?? SIM_DATE,
            },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    confirm: (state) => state,
    'request-changes': (state) => ({ ...state, baselineSchedule: [] }),
  },
};

export const onboardingScenarios: ScenarioDefinition[] = [
  scenario1, scenario2, scenario3, scenario4, scenario5,
  scenario6, scenario7, scenario8, scenario9, scenario10,
];
