import { z } from 'zod';
import { ScenarioDefinition, CATEGORIES } from '../types';
import {
  PARENT_A_ID, PARENT_B_ID,
  stateWithSchedule, msg, resetMessageSeq, stub,
} from '../helpers';

// ─── 37. Weekly fairness nudge (FULL) ──────────────────────────

const scenario37: ScenarioDefinition = {
  number: 37,
  key: 'weekly-fairness-nudge',
  title: 'Weekly fairness nudge',
  category: CATEGORIES.FAIRNESS,
  description: 'Display imbalance and suggest voluntary swap',
  implemented: true,
  paramsSchema: z.object({
    parentANights: z.number().default(9),
    parentBNights: z.number().default(5),
    weekNumber: z.number().default(3),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    ledger: {
      parentAOvernights: params.parentANights,
      parentBOvernights: params.parentBNights,
      parentAWeekends: 3,
      parentBWeekends: 3,
      transitionsThisWeek: 2,
      maxConsecutiveA: 3,
      maxConsecutiveB: 3,
    },
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const parentA = state.parents[0];
    const parentB = state.parents[1];
    const diff = params.parentANights - params.parentBNights;
    return {
      state,
      outgoingMessages: [
        msg(37, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'low',
          text: `Week ${params.weekNumber} fairness check: ${parentA.name} has had ${params.parentANights} nights vs ${parentB.name}'s ${params.parentBNights} nights (${diff}-night difference).`,
          sections: [
            { title: 'Current balance', bullets: [
              `${parentA.name}: ${params.parentANights} nights`,
              `${parentB.name}: ${params.parentBNights} nights`,
              `Difference: ${diff} nights`,
            ]},
            { title: 'Suggestion', bullets: [
              'A voluntary swap of 1 night would reduce the gap',
              'No action needed if both parents are satisfied',
            ]},
          ],
          actions: [
            { actionId: 'offer-swap', label: 'Offer a Swap Night', style: 'primary', payload: { from: PARENT_A_ID } },
            { actionId: 'looks-good', label: 'Looks Good to Me', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'offer-swap': (state) => state,
    'looks-good': (state) => state,
  },
};

// ─── 38. Rebalance proposal after many swaps (FULL) ────────────

const scenario38: ScenarioDefinition = {
  number: 38,
  key: 'rebalance-proposal-after-swaps',
  title: 'Rebalance proposal after many swaps',
  category: CATEGORIES.FAIRNESS,
  description: 'Drift detected; system proposes multi-day correction',
  implemented: true,
  paramsSchema: z.object({
    driftNights: z.number().default(4),
    heavyParent: z.string().default(PARENT_A_ID),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    ledger: {
      parentAOvernights: params.heavyParent === PARENT_A_ID ? 32 : 28,
      parentBOvernights: params.heavyParent === PARENT_A_ID ? 28 : 32,
      parentAWeekends: 4,
      parentBWeekends: 4,
      transitionsThisWeek: 2,
      maxConsecutiveA: params.heavyParent === PARENT_A_ID ? 5 : 3,
      maxConsecutiveB: params.heavyParent === PARENT_A_ID ? 3 : 5,
    },
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const heavy = state.parents.find((p) => p.id === params.heavyParent);
    const light = state.parents.find((p) => p.id !== params.heavyParent);
    return {
      state,
      outgoingMessages: [
        msg(38, {
          to: [PARENT_A_ID, PARENT_B_ID],
          text: `Schedule drift detected: ${heavy?.name} has ${params.driftNights} more nights than ${light?.name} over the past 8 weeks. We suggest a multi-day rebalance.`,
          sections: [
            { title: 'Drift summary', bullets: [
              `${heavy?.name}: ${params.heavyParent === PARENT_A_ID ? 32 : 28} nights`,
              `${light?.name}: ${params.heavyParent === PARENT_A_ID ? 28 : 32} nights`,
              `Imbalance: ${params.driftNights} nights`,
            ]},
            { title: 'Proposed correction', bullets: [
              `Shift ${Math.ceil(params.driftNights / 2)} nights to ${light?.name} over the next 2 weeks`,
              'This will bring the balance within 1 night',
              'Both parents must agree to proceed',
            ]},
          ],
          actions: [
            { actionId: 'accept-rebalance', label: 'Accept Rebalance', style: 'primary', payload: { shiftNights: Math.ceil(params.driftNights / 2) } },
            { actionId: 'decline-rebalance', label: 'Decline', style: 'danger' },
            { actionId: 'customize', label: 'Customize Plan', style: 'secondary' },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'accept-rebalance': (state) => ({
      ...state,
      ledger: {
        ...state.ledger,
        parentAOvernights: 30,
        parentBOvernights: 30,
      },
    }),
    'decline-rebalance': (state) => state,
    customize: (state) => state,
  },
};

// ─── 39. End-of-month fairness report (FULL) ──────────────────

const scenario39: ScenarioDefinition = {
  number: 39,
  key: 'end-of-month-fairness-report',
  title: 'End-of-month fairness report',
  category: CATEGORIES.FAIRNESS,
  description: 'Monthly summary with counts, trends, and optional correction',
  implemented: true,
  paramsSchema: z.object({
    month: z.string().default('February 2026'),
    parentATotal: z.number().default(14),
    parentBTotal: z.number().default(14),
    parentAWeekends: z.number().default(4),
    parentBWeekends: z.number().default(4),
    transitions: z.number().default(8),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    ledger: {
      parentAOvernights: params.parentATotal,
      parentBOvernights: params.parentBTotal,
      parentAWeekends: params.parentAWeekends,
      parentBWeekends: params.parentBWeekends,
      transitionsThisWeek: 2,
      maxConsecutiveA: 4,
      maxConsecutiveB: 4,
    },
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const diff = Math.abs(params.parentATotal - params.parentBTotal);
    const balanced = diff <= 1;
    return {
      state,
      outgoingMessages: [
        msg(39, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'low',
          text: `${params.month} summary: ${balanced ? 'Schedule was balanced.' : `${diff}-night imbalance detected.`}`,
          sections: [
            { title: 'Overnights', bullets: [
              `${state.parents[0].name}: ${params.parentATotal} nights`,
              `${state.parents[1].name}: ${params.parentBTotal} nights`,
            ]},
            { title: 'Weekends', bullets: [
              `${state.parents[0].name}: ${params.parentAWeekends} weekend nights`,
              `${state.parents[1].name}: ${params.parentBWeekends} weekend nights`,
            ]},
            { title: 'Stability', bullets: [
              `Total transitions: ${params.transitions}`,
              `Average: ${(params.transitions / 4).toFixed(1)} per week`,
            ]},
          ],
          actions: [
            { actionId: 'acknowledge', label: 'OK', style: 'secondary' },
            ...(balanced ? [] : [
              { actionId: 'auto-correct', label: 'Auto-Correct Next Month', style: 'primary' as const },
            ]),
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    acknowledge: (state) => state,
    'auto-correct': (state) => state,
  },
};

// ─── 40. Consecutive-days-away warning (FULL) ─────────────────

const scenario40: ScenarioDefinition = {
  number: 40,
  key: 'consecutive-days-away-warning',
  title: 'Consecutive-days-away warning',
  category: CATEGORIES.FAIRNESS,
  description: 'Child hasn\u2019t seen other parent in X days; suggest visit',
  implemented: true,
  paramsSchema: z.object({
    absentParent: z.string().default(PARENT_B_ID),
    daysAway: z.number().default(6),
    ageAppropriateMax: z.number().default(5),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const absent = state.parents.find((p) => p.id === params.absentParent);
    const present = state.parents.find((p) => p.id !== params.absentParent);
    const child = state.children[0];
    return {
      state,
      outgoingMessages: [
        msg(40, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: params.daysAway > params.ageAppropriateMax ? 'high' : 'normal',
          text: `${child.name} hasn't been with ${absent?.name} for ${params.daysAway} days (age-appropriate max: ${params.ageAppropriateMax}).`,
          sections: [
            { title: 'Details', bullets: [
              `${child.name} has been with ${present?.name} for ${params.daysAway} consecutive nights`,
              `Age-appropriate maximum: ${params.ageAppropriateMax} nights`,
              `This exceeds the recommended limit by ${params.daysAway - params.ageAppropriateMax} night(s)`,
            ]},
            { title: 'Suggestions', bullets: [
              `Schedule a visit or overnight with ${absent?.name}`,
              'This is a suggestion, not a requirement',
            ]},
          ],
          actions: [
            { actionId: 'schedule-visit', label: 'Schedule Visit', style: 'primary' },
            { actionId: 'acknowledged', label: 'Acknowledged', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'schedule-visit': (state) => state,
    acknowledged: (state) => state,
  },
};

// ─── 41. Override fairness band (FULL) ─────────────────────────

const scenario41: ScenarioDefinition = {
  number: 41,
  key: 'override-fairness-band',
  title: 'Override fairness band',
  category: CATEGORIES.FAIRNESS,
  description: 'Both agree to widen or narrow acceptable imbalance',
  implemented: true,
  paramsSchema: z.object({
    currentBand: z.number().default(2),
    proposedBand: z.number().default(4),
    initiatingParent: z.string().default(PARENT_A_ID),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const initiator = state.parents.find((p) => p.id === params.initiatingParent);
    const other = state.parents.find((p) => p.id !== params.initiatingParent);
    const wider = params.proposedBand > params.currentBand;
    return {
      state,
      outgoingMessages: [
        msg(41, {
          to: [other!.id],
          text: `${initiator?.name} proposes ${wider ? 'widening' : 'narrowing'} the fairness band from ${params.currentBand} to ${params.proposedBand} nights.`,
          sections: [
            { title: 'What this means', bullets: [
              `Current: alerts trigger at ${params.currentBand}-night imbalance`,
              `Proposed: alerts trigger at ${params.proposedBand}-night imbalance`,
              wider
                ? 'Wider band = fewer alerts, more flexibility'
                : 'Narrower band = more alerts, tighter balance',
            ]},
            { title: 'Important', bullets: [
              'Both parents must agree to change',
              'Can be changed back at any time',
              'Does not affect court-ordered minimums',
            ]},
          ],
          actions: [
            { actionId: 'agree', label: 'Agree to Change', style: 'primary', payload: { newBand: params.proposedBand } },
            { actionId: 'keep-current', label: 'Keep Current Band', style: 'secondary' },
          ],
          metadata: { requiresBothParents: true },
        }),
      ],
    };
  },
  expectedStateTransitions: {
    agree: (state) => state,
    'keep-current': (state) => state,
  },
};

export const fairnessScenarios: ScenarioDefinition[] = [
  scenario37, scenario38, scenario39, scenario40, scenario41,
];
