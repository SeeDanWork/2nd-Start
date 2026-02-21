import { z } from 'zod';
import { ScenarioDefinition, CATEGORIES } from '../types';
import {
  PARENT_A_ID, PARENT_B_ID,
  stateWithSchedule, msg, resetMessageSeq, stub,
} from '../helpers';

// ─── 49. Mediator/admin override (FULL) ────────────────────────

const scenario49: ScenarioDefinition = {
  number: 49,
  key: 'mediator-admin-override',
  title: 'Mediator/admin override',
  category: CATEGORIES.ADMIN,
  description: 'Mediator forces a schedule change; both parents notified',
  implemented: true,
  paramsSchema: z.object({
    overrideDate: z.string().default('2026-03-15'),
    newAssignedTo: z.string().default(PARENT_B_ID),
    reason: z.string().default('Court-ordered adjustment'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const newParent = state.parents.find((p) => p.id === params.newAssignedTo);
    const otherParent = state.parents.find((p) => p.id !== params.newAssignedTo);
    const currentAssignment = state.baselineSchedule.find((a) => a.date === params.overrideDate);
    const currentParent = state.parents.find((p) => p.id === currentAssignment?.assignedTo);
    return {
      state: {
        ...state,
        baselineSchedule: state.baselineSchedule.map((a) =>
          a.date === params.overrideDate
            ? { ...a, assignedTo: params.newAssignedTo, isTransition: a.assignedTo !== params.newAssignedTo }
            : a,
        ),
      },
      outgoingMessages: [
        msg(49, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'high',
          text: `A mediator has made a schedule adjustment for ${params.overrideDate}. This change is effective immediately.`,
          sections: [
            { title: 'Change details', bullets: [
              `Date: ${params.overrideDate}`,
              `Previously: ${currentParent?.name ?? 'unassigned'}`,
              `Now: ${newParent?.name}`,
              `Reason: ${params.reason}`,
            ]},
            { title: 'Note', bullets: [
              'This change was made by an authorized mediator',
              'Both parents are notified for transparency',
              'Contact your mediator with questions',
            ]},
          ],
          actions: [
            { actionId: 'acknowledge', label: 'Acknowledged', style: 'primary' },
            { actionId: 'request-review', label: 'Request Review', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    acknowledge: (state) => state,
    'request-review': (state) => state,
  },
};

// ─── 50. Export data request (stub) ────────────────────────────

const scenario50 = stub(50, 'export-data-request', 'Export data request', CATEGORIES.ADMIN,
  'GDPR/privacy export; confirm and deliver');

// ─── 51. Account deactivation (stub) ──────────────────────────

const scenario51 = stub(51, 'account-deactivation', 'Account deactivation', CATEGORIES.ADMIN,
  'One parent leaves; confirm data retention and schedule freeze');

export const adminScenarios: ScenarioDefinition[] = [
  scenario49, scenario50, scenario51,
];
