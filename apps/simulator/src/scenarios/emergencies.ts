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

// ─── 22. School/daycare closure (stub) ────────────────────────

const scenario22 = stub(22, 'school-daycare-closure', 'School/daycare closure', CATEGORIES.EMERGENCIES,
  'Snow day or strike; coverage request');

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

// ─── 24. Delayed pickup escalation (stub) ─────────────────────

const scenario24 = stub(24, 'delayed-pickup-escalation', 'Delayed pickup escalation', CATEGORIES.EMERGENCIES,
  'Daycare closing; other parent asked to cover');

// ─── 25. Flight delay / travel disruption (stub) ──────────────

const scenario25 = stub(25, 'flight-delay-travel-disruption', 'Flight delay / travel disruption', CATEGORIES.EMERGENCIES,
  'Handoff impossible; choose fallback plan');

// ─── 26. Transportation breakdown (stub) ──────────────────────

const scenario26 = stub(26, 'transportation-breakdown', 'Transportation breakdown', CATEGORIES.EMERGENCIES,
  'Car won\'t start; request alternate plan');

// ─── 27. Safety concern flag (stub) ──────────────────────────

const scenario27 = stub(27, 'safety-concern-flag', 'Safety concern flag', CATEGORIES.EMERGENCIES,
  'Non-accusatory: choose alternate safe location');

export const emergencyScenarios: ScenarioDefinition[] = [
  scenario21, scenario22, scenario23, scenario24, scenario25, scenario26, scenario27,
];
