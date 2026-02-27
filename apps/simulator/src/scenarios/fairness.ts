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

// ─── 39. End-of-month fairness report (stub) ───────────────────

const scenario39 = stub(39, 'end-of-month-fairness-report', 'End-of-month fairness report', CATEGORIES.FAIRNESS,
  'Monthly summary with counts, trends, and optional correction');

// ─── 40. Consecutive-days-away warning (stub) ──────────────────

const scenario40 = stub(40, 'consecutive-days-away-warning', 'Consecutive-days-away warning', CATEGORIES.FAIRNESS,
  'Child hasn\u2019t seen other parent in X days; suggest visit');

// ─── 41. Override fairness band (stub) ──────────────────────────

const scenario41 = stub(41, 'override-fairness-band', 'Override fairness band', CATEGORIES.FAIRNESS,
  'Both agree to widen or narrow acceptable imbalance');

export const fairnessScenarios: ScenarioDefinition[] = [
  scenario37, scenario38, scenario39, scenario40, scenario41,
];
