import { z } from 'zod';
import { ScenarioDefinition, CATEGORIES } from '../types';
import {
  PARENT_A_ID, PARENT_B_ID, CHILD_1_ID,
  stateWithSchedule, msg, resetMessageSeq, stub,
} from '../helpers';

// ─── 21. Child illness same-day change (FULL) ─────────────────

const scenario21: ScenarioDefinition = {
  number: 21,
  key: 'child-illness-same-day',
  title: 'Child illness same-day change',
  category: CATEGORIES.EMERGENCIES,
  description: 'Child is sick; who covers daytime care?',
  implemented: true,
  paramsSchema: z.object({
    reportedBy: z.string().default(PARENT_A_ID),
    childName: z.string().default('Riley'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const reporter = state.parents.find((p) => p.id === params.reportedBy);
    const other = state.parents.find((p) => p.id !== params.reportedBy);
    return {
      state,
      outgoingMessages: [
        msg(21, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'high',
          text: `${reporter?.name} reports that ${params.childName} isn't feeling well and can't attend school today. Daytime care is needed.`,
          sections: [{
            title: 'Options',
            bullets: [
              `${reporter?.name} covers the full day (no schedule change)`,
              `${other?.name} picks up for daytime care`,
              'Split the day between both parents',
            ],
          }],
          actions: [
            { actionId: 'reporter-covers', label: `${reporter?.name} Covers`, style: 'primary', payload: { coveredBy: params.reportedBy } },
            { actionId: 'other-covers', label: `${other?.name} Covers`, style: 'primary', payload: { coveredBy: other?.id } },
            { actionId: 'split-day', label: 'Split the Day', style: 'secondary' },
          ],
          metadata: {
            relatesToDateRange: { start: '2026-03-01', end: '2026-03-01' },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'reporter-covers': (state) => state,
    'other-covers': (state) => state,
    'split-day': (state) => state,
  },
};

// ─── 22. School/daycare closure (FULL) ────────────────────────

const scenario22: ScenarioDefinition = {
  number: 22,
  key: 'school-daycare-closure',
  title: 'School/daycare closure',
  category: CATEGORIES.EMERGENCIES,
  description: 'Snow day or strike; coverage request',
  implemented: true,
  paramsSchema: z.object({
    closureReason: z.string().default('snow day'),
    closureDates: z.array(z.string()).default(['2026-03-03', '2026-03-04']),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const child = state.children[0];
    const datesStr = params.closureDates.join(', ');
    return {
      state,
      outgoingMessages: [
        msg(22, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'high',
          text: `${child.name}'s school is closed (${params.closureReason}) on ${datesStr}. Daytime care is needed.`,
          sections: [
            { title: 'Closure details', bullets: [
              `Reason: ${params.closureReason}`,
              `Dates: ${datesStr}`,
              `Affects: ${child.name}`,
            ]},
            { title: 'Options', bullets: [
              'Scheduled parent covers (no change needed)',
              'Non-scheduled parent takes over for the day(s)',
              'Split coverage between both parents',
            ]},
          ],
          actions: [
            { actionId: 'scheduled-covers', label: 'Scheduled Parent Covers', style: 'primary' },
            { actionId: 'swap-coverage', label: 'Swap Coverage', style: 'primary' },
            { actionId: 'split-days', label: 'Split Days', style: 'secondary' },
          ],
          metadata: {
            relatesToDateRange: { start: params.closureDates[0], end: params.closureDates[params.closureDates.length - 1] },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'scheduled-covers': (state) => state,
    'swap-coverage': (state) => state,
    'split-days': (state) => state,
  },
};

// ─── 23. Parent emergency (FULL) ──────────────────────────────

const scenario23: ScenarioDefinition = {
  number: 23,
  key: 'parent-emergency',
  title: 'Parent emergency',
  category: CATEGORIES.EMERGENCIES,
  description: 'Car accident, hospitalization; urgent coverage needed',
  implemented: true,
  paramsSchema: z.object({
    affectedParent: z.string().default(PARENT_A_ID),
    emergencyType: z.string().default('medical'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const affected = state.parents.find((p) => p.id === params.affectedParent);
    const other = state.parents.find((p) => p.id !== params.affectedParent);
    const child = state.children[0];
    const typeLabel = params.emergencyType === 'medical' ? 'a medical situation' : 'an emergency';
    return {
      state: {
        ...state,
        activeEmergency: {
          type: params.emergencyType,
          reportedBy: params.affectedParent,
          startedAt: '2026-03-01T10:00:00.000Z',
          expiresAt: '2026-03-08T10:00:00.000Z',
        },
      },
      outgoingMessages: [
        msg(23, {
          to: [other!.id],
          urgency: 'high',
          text: `${affected?.name} has reported ${typeLabel} and needs immediate coverage for ${child.name}. Normal constraints are temporarily relaxed.`,
          sections: [
            { title: 'What this means', bullets: [
              `${child.name} needs immediate care coverage`,
              'Schedule constraints are relaxed for up to 7 days',
              'The schedule will return to normal when the situation resolves',
            ]},
          ],
          actions: [
            { actionId: 'can-cover', label: 'I Can Cover', style: 'primary', payload: { coverageParent: other?.id } },
            { actionId: 'suggest-caregiver', label: 'Suggest Alternate Caregiver', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'can-cover': (state) => state,
    'suggest-caregiver': (state) => state,
  },
};

// ─── 24. Delayed pickup escalation (FULL) ─────────────────────

const scenario24: ScenarioDefinition = {
  number: 24,
  key: 'delayed-pickup-escalation',
  title: 'Delayed pickup escalation',
  category: CATEGORIES.EMERGENCIES,
  description: 'Daycare closing; other parent asked to cover',
  implemented: true,
  paramsSchema: z.object({
    lateParent: z.string().default(PARENT_A_ID),
    delayMinutes: z.number().default(45),
    pickupLocation: z.string().default('daycare'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const late = state.parents.find((p) => p.id === params.lateParent);
    const other = state.parents.find((p) => p.id !== params.lateParent);
    const child = state.children[0];
    return {
      state,
      outgoingMessages: [
        msg(24, {
          to: [other!.id],
          urgency: 'high',
          text: `${late?.name} is running ${params.delayMinutes} min late for ${child.name}'s pickup at ${params.pickupLocation}. ${params.pickupLocation} closes soon.`,
          sections: [
            { title: 'Situation', bullets: [
              `${late?.name} estimated ${params.delayMinutes} minutes late`,
              `${params.pickupLocation} needs pickup by closing time`,
              `${child.name} needs to be picked up`,
            ]},
          ],
          actions: [
            { actionId: 'can-pickup', label: 'I Can Pick Up', style: 'primary', payload: { coverBy: other?.id } },
            { actionId: 'waiting', label: `${late?.name} Will Make It`, style: 'secondary' },
            { actionId: 'alternate-contact', label: 'Call Emergency Contact', style: 'danger' },
          ],
          metadata: {
            relatesToDateRange: { start: '2026-03-01', end: '2026-03-01' },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'can-pickup': (state) => state,
    waiting: (state) => state,
    'alternate-contact': (state) => state,
  },
};

// ─── 25. Flight delay / travel disruption (FULL) ──────────────

const scenario25: ScenarioDefinition = {
  number: 25,
  key: 'flight-delay-travel-disruption',
  title: 'Flight delay / travel disruption',
  category: CATEGORIES.EMERGENCIES,
  description: 'Handoff impossible; choose fallback plan',
  implemented: true,
  paramsSchema: z.object({
    travelingParent: z.string().default(PARENT_A_ID),
    originalArrival: z.string().default('2026-03-05T15:00:00Z'),
    newArrival: z.string().default('2026-03-06T09:00:00Z'),
    reason: z.string().default('flight cancelled'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const traveler = state.parents.find((p) => p.id === params.travelingParent);
    const other = state.parents.find((p) => p.id !== params.travelingParent);
    const child = state.children[0];
    return {
      state,
      outgoingMessages: [
        msg(25, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'high',
          text: `${traveler?.name}'s ${params.reason}. Originally arriving ${params.originalArrival.split('T')[0]}, now arriving ${params.newArrival.split('T')[0]}. Handoff needs to be rescheduled.`,
          sections: [
            { title: 'Impact', bullets: [
              `Scheduled handoff cannot happen on time`,
              `${child.name} stays with ${other?.name} until ${traveler?.name} arrives`,
              'Fairness adjustment will be applied automatically',
            ]},
          ],
          actions: [
            { actionId: 'extend-stay', label: `${other?.name} Keeps ${child.name}`, style: 'primary', payload: { extendWith: other?.id } },
            { actionId: 'arrange-alternate', label: 'Arrange Alternate Handoff', style: 'secondary' },
          ],
          metadata: {
            relatesToDateRange: { start: params.originalArrival.split('T')[0], end: params.newArrival.split('T')[0] },
          },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'extend-stay': (state) => state,
    'arrange-alternate': (state) => state,
  },
};

// ─── 26. Transportation breakdown (FULL) ──────────────────────

const scenario26: ScenarioDefinition = {
  number: 26,
  key: 'transportation-breakdown',
  title: 'Transportation breakdown',
  category: CATEGORIES.EMERGENCIES,
  description: 'Car won\'t start; request alternate plan',
  implemented: true,
  paramsSchema: z.object({
    strandedParent: z.string().default(PARENT_A_ID),
    handoffTime: z.string().default('15:00'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const stranded = state.parents.find((p) => p.id === params.strandedParent);
    const other = state.parents.find((p) => p.id !== params.strandedParent);
    const child = state.children[0];
    return {
      state,
      outgoingMessages: [
        msg(26, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `${stranded?.name}'s car broke down. Today's ${params.handoffTime} handoff for ${child.name} needs an alternate plan.`,
          sections: [
            { title: 'Options', bullets: [
              `${other?.name} picks up ${child.name} from ${stranded?.name}'s location`,
              `${stranded?.name} arranges rideshare/taxi`,
              `Delay handoff until ${stranded?.name}'s car is fixed`,
            ]},
          ],
          actions: [
            { actionId: 'other-picks-up', label: `${other?.name} Picks Up`, style: 'primary' },
            { actionId: 'rideshare', label: 'Arrange Rideshare', style: 'secondary' },
            { actionId: 'delay-handoff', label: 'Delay Handoff', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'other-picks-up': (state) => state,
    rideshare: (state) => state,
    'delay-handoff': (state) => state,
  },
};

// ─── 27. Safety concern flag (FULL) ───────────────────────────

const scenario27: ScenarioDefinition = {
  number: 27,
  key: 'safety-concern-flag',
  title: 'Safety concern flag',
  category: CATEGORIES.EMERGENCIES,
  description: 'Non-accusatory: choose alternate safe location',
  implemented: true,
  paramsSchema: z.object({
    reportingParent: z.string().default(PARENT_B_ID),
    concernType: z.string().default('environment'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const reporter = state.parents.find((p) => p.id === params.reportingParent);
    const child = state.children[0];
    return {
      state,
      outgoingMessages: [
        msg(27, {
          to: [params.reportingParent],
          urgency: 'high',
          text: `Safety concern noted for ${child.name}. This will be logged and reviewed. No accusation is made — we're focusing on ${child.name}'s wellbeing.`,
          sections: [
            { title: 'What happens next', bullets: [
              'Concern is logged privately',
              'A mediator will review within 24 hours',
              'No schedule changes are made automatically',
              'Both parents will be informed if action is needed',
            ]},
            { title: 'Immediate options', bullets: [
              'Suggest an alternate safe exchange location',
              'Request a supervised handoff',
              'Contact emergency services if urgent',
            ]},
          ],
          actions: [
            { actionId: 'alternate-location', label: 'Suggest Alternate Location', style: 'primary' },
            { actionId: 'supervised-handoff', label: 'Request Supervised Handoff', style: 'secondary' },
            { actionId: 'logged-only', label: 'Log Only', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'alternate-location': (state) => state,
    'supervised-handoff': (state) => state,
    'logged-only': (state) => state,
  },
};

export const emergencyScenarios: ScenarioDefinition[] = [
  scenario21, scenario22, scenario23, scenario24, scenario25, scenario26, scenario27,
];
