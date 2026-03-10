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

// ─── 34. Activity conflict with schedule (FULL) ───────────────

const scenario34: ScenarioDefinition = {
  number: 34,
  key: 'activity-conflict-with-schedule',
  title: 'Activity conflict with schedule',
  category: CATEGORIES.ACTIVITIES,
  description: 'Practice falls on other parent\u2019s night; suggest handoff time',
  implemented: true,
  paramsSchema: z.object({
    activityName: z.string().default('Soccer Practice'),
    activityDay: z.string().default('2026-03-04'),
    activityTime: z.string().default('16:00'),
    scheduledParent: z.string().default(PARENT_B_ID),
    activityParent: z.string().default(PARENT_A_ID),
  }),
  seedStateBuilder: () => stateWithSchedule({
    activities: [{
      id: 'activity-002',
      childId: CHILD_1_ID,
      name: 'Soccer Practice',
      dayOfWeek: 3,
      time: '16:00',
      transportParent: PARENT_A_ID,
    }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const scheduled = state.parents.find((p) => p.id === params.scheduledParent);
    const activityP = state.parents.find((p) => p.id === params.activityParent);
    const child = state.children[0];
    return {
      state,
      outgoingMessages: [
        msg(34, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `${params.activityName} on ${params.activityDay} falls on ${scheduled?.name}'s night, but ${activityP?.name} handles transport.`,
          sections: [
            { title: 'Conflict', bullets: [
              `${child.name}'s ${params.activityName} at ${params.activityTime}`,
              `${activityP?.name} drives to/from the activity`,
              `${scheduled?.name} has the overnight`,
              'A mid-day handoff is needed',
            ]},
            { title: 'Options', bullets: [
              `${activityP?.name} picks up at school, drives to practice, drops off at ${scheduled?.name}'s after`,
              `${scheduled?.name} handles transport this week`,
              'Skip practice this week',
            ]},
          ],
          actions: [
            { actionId: 'mid-day-handoff', label: 'Mid-Day Handoff', style: 'primary' },
            { actionId: 'scheduled-drives', label: `${scheduled?.name} Drives`, style: 'secondary' },
            { actionId: 'skip-activity', label: 'Skip This Week', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'mid-day-handoff': (state) => state,
    'scheduled-drives': (state) => state,
    'skip-activity': (state) => state,
  },
};

// ─── 35. Activity cancellation propagation (FULL) ─────────────

const scenario35: ScenarioDefinition = {
  number: 35,
  key: 'activity-cancellation-propagation',
  title: 'Activity cancellation propagation',
  category: CATEGORIES.ACTIVITIES,
  description: 'Game cancelled; transport plan no longer needed',
  implemented: true,
  paramsSchema: z.object({
    activityName: z.string().default('Soccer Game'),
    cancelledDate: z.string().default('2026-03-08'),
    reason: z.string().default('weather'),
  }),
  seedStateBuilder: () => stateWithSchedule({
    activities: [{
      id: 'activity-003',
      childId: CHILD_1_ID,
      name: 'Soccer Game',
      dayOfWeek: 6,
      time: '10:00',
      transportParent: PARENT_A_ID,
    }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(35, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'low',
          text: `${params.activityName} on ${params.cancelledDate} has been cancelled (${params.reason}). No transport needed.`,
          sections: [
            { title: 'Impact', bullets: [
              'Transport plan for this date is cancelled',
              'No schedule changes needed',
              'Regular overnight assignment remains',
            ]},
          ],
          actions: [
            { actionId: 'acknowledged', label: 'OK', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    acknowledged: (state) => state,
  },
};

// ─── 36. Seasonal activity registration (FULL) ────────────────

const scenario36: ScenarioDefinition = {
  number: 36,
  key: 'seasonal-activity-registration',
  title: 'Seasonal activity registration',
  category: CATEGORIES.ACTIVITIES,
  description: 'New season signup; both parents must acknowledge cost split',
  implemented: true,
  paramsSchema: z.object({
    activityName: z.string().default('Spring Soccer'),
    seasonStart: z.string().default('2026-04-01'),
    seasonEnd: z.string().default('2026-06-15'),
    cost: z.number().default(350),
    addedBy: z.string().default(PARENT_A_ID),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const adder = state.parents.find((p) => p.id === params.addedBy);
    const other = state.parents.find((p) => p.id !== params.addedBy);
    const child = state.children[0];
    const halfCost = (params.cost / 2).toFixed(2);
    return {
      state,
      outgoingMessages: [
        msg(36, {
          to: [other!.id],
          text: `${adder?.name} wants to register ${child.name} for ${params.activityName} ($${params.cost}). Both parents split the cost.`,
          sections: [
            { title: 'Season details', bullets: [
              `Activity: ${params.activityName}`,
              `Dates: ${params.seasonStart} to ${params.seasonEnd}`,
              `Total cost: $${params.cost}`,
              `Each parent: $${halfCost}`,
            ]},
            { title: 'Transport', bullets: [
              'Transport responsibility follows the existing activity rules',
              'New schedule impacts will be shown once registered',
            ]},
          ],
          actions: [
            { actionId: 'approve-and-split', label: `Approve ($${halfCost} each)`, style: 'primary', payload: { eachPays: halfCost } },
            { actionId: 'decline-registration', label: 'Decline Registration', style: 'danger' },
            { actionId: 'discuss-first', label: 'Discuss First', style: 'secondary' },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'approve-and-split': (state) => ({
      ...state,
      activities: [
        ...state.activities,
        {
          id: 'activity-seasonal-001',
          childId: CHILD_1_ID,
          name: 'Spring Soccer',
          dayOfWeek: 6,
          time: '09:00',
          transportParent: 'scheduled-parent',
        },
      ],
    }),
    'decline-registration': (state) => state,
    'discuss-first': (state) => state,
  },
};

export const activityScenarios: ScenarioDefinition[] = [
  scenario33, scenario34, scenario35, scenario36,
];
