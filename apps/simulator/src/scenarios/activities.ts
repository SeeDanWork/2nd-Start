import { z } from 'zod';
import { ScenarioDefinition, CATEGORIES } from '../types';
import {
  PARENT_A_ID, PARENT_B_ID, CHILD_1_ID,
  stateWithSchedule, msg, resetMessageSeq, stub,
} from '../helpers';

// ─── 33. Add recurring activity (FULL) ─────────────────────────

const scenario33: ScenarioDefinition = {
  number: 33,
  key: 'add-recurring-activity',
  title: 'Add recurring activity',
  category: CATEGORIES.ACTIVITIES,
  description: 'Soccer every Tuesday; confirm transport responsibility',
  implemented: true,
  paramsSchema: z.object({
    activityName: z.string().default('Soccer Practice'),
    dayOfWeek: z.number().int().min(0).max(6).default(2),
    time: z.string().default('16:00'),
    addedBy: z.string().default(PARENT_A_ID),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[params.dayOfWeek];
    const adder = state.parents.find((p) => p.id === params.addedBy);
    const other = state.parents.find((p) => p.id !== params.addedBy);
    const child = state.children[0];
    return {
      state: {
        ...state,
        activities: [
          ...state.activities,
          {
            id: 'activity-001',
            childId: child.id,
            name: params.activityName,
            dayOfWeek: params.dayOfWeek,
            time: params.time,
            transportParent: 'unset',
          },
        ],
      },
      outgoingMessages: [
        msg(33, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `${adder?.name} added ${params.activityName} for ${child.name} every ${dayName} at ${params.time}. Who handles transport?`,
          sections: [
            { title: 'Activity details', bullets: [
              `${params.activityName}`,
              `Every ${dayName} at ${params.time}`,
              `For ${child.name}`,
            ]},
            { title: 'Transport options', bullets: [
              'Whichever parent has the child that day drives',
              `${adder?.name} always drives`,
              `${other?.name} always drives`,
            ]},
          ],
          actions: [
            { actionId: 'scheduled-parent', label: 'Scheduled Parent Drives', style: 'primary', payload: { transport: 'scheduled-parent' } },
            { actionId: 'adder-drives', label: `${adder?.name} Always Drives`, style: 'secondary', payload: { transport: params.addedBy } },
            { actionId: 'other-drives', label: `${other?.name} Always Drives`, style: 'secondary', payload: { transport: other?.id } },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'scheduled-parent': (state) => ({
      ...state,
      activities: state.activities.map((a) =>
        a.id === 'activity-001' ? { ...a, transportParent: 'scheduled-parent' } : a,
      ),
    }),
    'adder-drives': (state) => ({
      ...state,
      activities: state.activities.map((a) =>
        a.id === 'activity-001' ? { ...a, transportParent: PARENT_A_ID } : a,
      ),
    }),
    'other-drives': (state) => ({
      ...state,
      activities: state.activities.map((a) =>
        a.id === 'activity-001' ? { ...a, transportParent: PARENT_B_ID } : a,
      ),
    }),
  },
};

// ─── 34. Activity conflict with schedule (stub) ────────────────

const scenario34 = stub(34, 'activity-conflict-with-schedule', 'Activity conflict with schedule', CATEGORIES.ACTIVITIES,
  'Practice falls on other parent\u2019s night; suggest handoff time');

// ─── 35. Activity cancellation propagation (stub) ──────────────

const scenario35 = stub(35, 'activity-cancellation-propagation', 'Activity cancellation propagation', CATEGORIES.ACTIVITIES,
  'Game cancelled; transport plan no longer needed');

// ─── 36. Seasonal activity registration (stub) ─────────────────

const scenario36 = stub(36, 'seasonal-activity-registration', 'Seasonal activity registration', CATEGORIES.ACTIVITIES,
  'New season signup; both parents must acknowledge cost split');

export const activityScenarios: ScenarioDefinition[] = [
  scenario33, scenario34, scenario35, scenario36,
];
