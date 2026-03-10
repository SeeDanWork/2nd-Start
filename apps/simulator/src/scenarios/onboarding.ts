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

// ─── 2. Confirm child profile (FULL) ──────────────────────────

const scenario2: ScenarioDefinition = {
  number: 2,
  key: 'confirm-child-profile',
  title: 'Confirm child profile',
  category: CATEGORIES.ONBOARDING,
  description: 'Confirm age band, school/daycare schedule for each child',
  implemented: true,
  paramsSchema: z.object({
    childName: z.string().default('Riley'),
    ageBand: z.string().default('school-age'),
    schoolDays: z.array(z.number()).default([1, 2, 3, 4, 5]),
  }),
  seedStateBuilder: (params) => defaultState({
    children: [defaultChild({ name: params.childName, ageBand: params.ageBand as any })],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const child = state.children[0];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const schoolDayStr = params.schoolDays.map(d => dayNames[d]).join(', ');
    return {
      state,
      outgoingMessages: [
        msg(2, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `Please confirm ${child.name}'s profile details.`,
          sections: [
            { title: 'Profile', bullets: [
              `Name: ${child.name}`,
              `Age band: ${params.ageBand}`,
              `School days: ${schoolDayStr}`,
              `School hours: ${child.schoolStart} – ${child.schoolEnd}`,
            ]},
          ],
          actions: [
            { actionId: 'confirm-profile', label: 'Confirm', style: 'primary' },
            { actionId: 'edit-profile', label: 'Edit', style: 'secondary' },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'confirm-profile': (state) => state,
    'edit-profile': (state) => state,
  },
};

// ─── 3. Confirm exchange defaults (FULL) ──────────────────────

const scenario3: ScenarioDefinition = {
  number: 3,
  key: 'confirm-exchange-defaults',
  title: 'Confirm exchange defaults',
  category: CATEGORIES.ONBOARDING,
  description: 'School/daycare exchange preference, fallback location',
  implemented: true,
  paramsSchema: z.object({
    primaryLocation: z.string().default('school'),
    fallbackLocation: z.string().default('curbside'),
  }),
  seedStateBuilder: () => defaultState(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(3, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: 'Set your default exchange location for handoffs.',
          sections: [
            { title: 'Exchange options', bullets: [
              `Primary: ${params.primaryLocation} (school days)`,
              `Fallback: ${params.fallbackLocation} (weekends/holidays)`,
              'Both parents can suggest changes anytime',
            ]},
          ],
          actions: [
            { actionId: 'confirm-exchange', label: 'Confirm Locations', style: 'primary' },
            { actionId: 'change-primary', label: 'Change Primary', style: 'secondary' },
            { actionId: 'change-fallback', label: 'Change Fallback', style: 'secondary' },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'confirm-exchange': (state) => state,
    'change-primary': (state) => state,
    'change-fallback': (state) => state,
  },
};

// ─── 4. Confirm hard constraints (FULL) ───────────────────────

const scenario4: ScenarioDefinition = {
  number: 4,
  key: 'confirm-hard-constraints',
  title: 'Confirm hard constraints',
  category: CATEGORIES.ONBOARDING,
  description: 'Locked nights, work shifts, no in-person exchange',
  implemented: true,
  paramsSchema: z.object({
    parentId: z.string().default(PARENT_A_ID),
  }),
  seedStateBuilder: () => defaultState(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const parent = state.parents.find(p => p.id === params.parentId);
    return {
      state,
      outgoingMessages: [
        msg(4, {
          to: [params.parentId],
          text: `${parent?.name}, set your hard constraints. These cannot be overridden by the scheduler.`,
          sections: [
            { title: 'Constraint types', bullets: [
              'Locked nights: nights you must always have the child',
              'Work shifts: times you are unavailable for handoffs',
              'Max consecutive: maximum nights in a row',
              'No in-person exchange: require third-party handoffs',
            ]},
          ],
          actions: [
            { actionId: 'save-constraints', label: 'Save Constraints', style: 'primary' },
            { actionId: 'skip', label: 'Skip (No Hard Constraints)', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'save-constraints': (state) => state,
    skip: (state) => state,
  },
};

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

// ─── 7. Confirm schedule start date (FULL) ────────────────────

const scenario7: ScenarioDefinition = {
  number: 7,
  key: 'confirm-schedule-start-date',
  title: 'Confirm schedule start date',
  category: CATEGORIES.ONBOARDING,
  description: 'Start next Monday vs today',
  implemented: true,
  paramsSchema: z.object({
    suggestedDate: z.string().default('2026-03-02'),
  }),
  seedStateBuilder: () => defaultState(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(7, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `When should the schedule start? Suggested: ${params.suggestedDate} (next Monday).`,
          sections: [
            { title: 'Options', bullets: [
              `Next Monday (${params.suggestedDate}) — clean weekly start`,
              'Today — begin immediately',
              'Custom date — choose your own',
            ]},
          ],
          actions: [
            { actionId: 'start-monday', label: 'Start Next Monday', style: 'primary', payload: { date: params.suggestedDate } },
            { actionId: 'start-today', label: 'Start Today', style: 'secondary', payload: { date: SIM_DATE } },
            { actionId: 'custom-date', label: 'Choose Date', style: 'secondary' },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'start-monday': (state) => state,
    'start-today': (state) => state,
    'custom-date': (state) => state,
  },
};

// ─── 8. Confirm special rules (FULL) ──────────────────────────

const scenario8: ScenarioDefinition = {
  number: 8,
  key: 'confirm-special-rules',
  title: 'Confirm special rules',
  category: CATEGORIES.ONBOARDING,
  description: 'Max handoffs/week, max consecutive days away, quiet hours',
  implemented: true,
  paramsSchema: z.object({
    maxHandoffsPerWeek: z.number().default(3),
    maxConsecutive: z.number().default(5),
    quietHoursStart: z.string().default('21:00'),
    quietHoursEnd: z.string().default('08:00'),
  }),
  seedStateBuilder: () => defaultState(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(8, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: 'Review the special rules for your schedule. These affect how the system generates options.',
          sections: [
            { title: 'Proposed rules', bullets: [
              `Max handoffs per week: ${params.maxHandoffsPerWeek}`,
              `Max consecutive nights away: ${params.maxConsecutive}`,
              `Quiet hours: ${params.quietHoursStart} – ${params.quietHoursEnd} (no notifications)`,
            ]},
          ],
          actions: [
            { actionId: 'accept-rules', label: 'Accept Rules', style: 'primary' },
            { actionId: 'customize-rules', label: 'Customize', style: 'secondary' },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'accept-rules': (state) => state,
    'customize-rules': (state) => state,
  },
};

// ─── 9. Confirm pre-consent rules (FULL) ──────────────────────

const scenario9: ScenarioDefinition = {
  number: 9,
  key: 'confirm-pre-consent-rules',
  title: 'Confirm pre-consent rules',
  category: CATEGORIES.ONBOARDING,
  description: 'Auto-approve swaps under certain conditions',
  implemented: true,
  paramsSchema: z.object({}),
  seedStateBuilder: () => defaultState(),
  triggerEvent: (state) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(9, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: 'Set pre-consent rules to auto-approve certain schedule changes without waiting for a response.',
          sections: [
            { title: 'Available pre-consent rules', bullets: [
              'Auto-approve same-day swaps (both parents agree in advance)',
              'Auto-approve if fairness impact is neutral or favorable',
              'Auto-approve emergency coverage requests',
              'Right-of-first-refusal for childcare over 4 hours',
            ]},
            { title: 'Note', bullets: [
              'Both parents must agree to each rule',
              'Rules can be changed at any time',
              'Court-ordered minimums are never bypassed',
            ]},
          ],
          actions: [
            { actionId: 'enable-all', label: 'Enable All', style: 'primary' },
            { actionId: 'choose-individually', label: 'Choose Individually', style: 'secondary' },
            { actionId: 'skip-preconsent', label: 'Skip (Manual Only)', style: 'secondary' },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'enable-all': (state) => ({
      ...state,
      preConsentRules: [
        { id: 'pc-1', type: 'same_day_swap', triggerHours: 0, enabled: true },
        { id: 'pc-2', type: 'neutral_fairness', triggerHours: 0, enabled: true },
        { id: 'pc-3', type: 'emergency_coverage', triggerHours: 0, enabled: true },
        { id: 'pc-4', type: 'right_of_first_refusal', triggerHours: 4, enabled: true },
      ],
    }),
    'choose-individually': (state) => state,
    'skip-preconsent': (state) => state,
  },
};

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
