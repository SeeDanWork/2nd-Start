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

// ─── 50. Export data request (FULL) ────────────────────────────

const scenario50: ScenarioDefinition = {
  number: 50,
  key: 'export-data-request',
  title: 'Export data request',
  category: CATEGORIES.ADMIN,
  description: 'GDPR/privacy export; confirm and deliver',
  implemented: true,
  paramsSchema: z.object({
    requestingParent: z.string().default(PARENT_A_ID),
    exportFormat: z.string().default('JSON'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const requester = state.parents.find((p) => p.id === params.requestingParent);
    return {
      state,
      outgoingMessages: [
        msg(50, {
          to: [params.requestingParent],
          text: `${requester?.name}, your data export request has been received. Your data will be prepared in ${params.exportFormat} format.`,
          sections: [
            { title: 'What\u2019s included', bullets: [
              'Schedule history and assignments',
              'Request and proposal history',
              'Fairness ledger snapshots',
              'Activity records',
              'Account settings',
            ]},
            { title: 'What\u2019s NOT included', bullets: [
              'Other parent\u2019s personal data',
              'System-internal logs',
              'Payment card details (masked only)',
            ]},
            { title: 'Timeline', bullets: [
              'Export will be ready within 24 hours',
              'Download link will be sent via email',
              'Link expires after 7 days',
            ]},
          ],
          actions: [
            { actionId: 'confirm-export', label: 'Confirm Export', style: 'primary' },
            { actionId: 'cancel-export', label: 'Cancel', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'confirm-export': (state) => state,
    'cancel-export': (state) => state,
  },
};

// ─── 51. Account deactivation (FULL) ──────────────────────────

const scenario51: ScenarioDefinition = {
  number: 51,
  key: 'account-deactivation',
  title: 'Account deactivation',
  category: CATEGORIES.ADMIN,
  description: 'One parent leaves; confirm data retention and schedule freeze',
  implemented: true,
  paramsSchema: z.object({
    leavingParent: z.string().default(PARENT_A_ID),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const leaving = state.parents.find((p) => p.id === params.leavingParent);
    const staying = state.parents.find((p) => p.id !== params.leavingParent);
    const child = state.children[0];
    return {
      state,
      outgoingMessages: [
        msg(51, {
          to: [params.leavingParent],
          urgency: 'high',
          text: `${leaving?.name}, you are about to deactivate your account. Please review what happens next.`,
          sections: [
            { title: 'What happens', bullets: [
              'Your account will be deactivated (not deleted)',
              `The current schedule for ${child.name} will be frozen`,
              `${staying?.name} will retain full access`,
              'You can reactivate within 90 days',
            ]},
            { title: 'Data retention', bullets: [
              'All your data is retained for 90 days',
              'After 90 days, personal data is permanently deleted',
              'Schedule history is anonymized and retained',
              'You can request a data export before deactivating',
            ]},
          ],
          actions: [
            { actionId: 'confirm-deactivation', label: 'Deactivate Account', style: 'danger' },
            { actionId: 'export-first', label: 'Export Data First', style: 'secondary' },
            { actionId: 'cancel', label: 'Cancel', style: 'primary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'confirm-deactivation': (state) => ({
      ...state,
      parents: state.parents.map((p) =>
        p.id === PARENT_A_ID ? { ...p, joined: false } : p,
      ),
    }),
    'export-first': (state) => state,
    cancel: (state) => state,
  },
};

export const adminScenarios: ScenarioDefinition[] = [
  scenario49, scenario50, scenario51,
];
