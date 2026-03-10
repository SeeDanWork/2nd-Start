import { z } from 'zod';
import { ScenarioDefinition, CATEGORIES } from '../types';
import {
  PARENT_A_ID, PARENT_B_ID,
  stateWithSchedule, msg, resetMessageSeq, stub,
} from '../helpers';

// ─── 42. Court-order guardrail trigger (FULL) ──────────────────

const scenario42: ScenarioDefinition = {
  number: 42,
  key: 'court-order-guardrail-trigger',
  title: 'Court-order guardrail trigger',
  category: CATEGORIES.COMPLIANCE,
  description: 'Proposed swap would violate court-ordered minimum; block with explanation',
  implemented: true,
  paramsSchema: z.object({
    violatingParent: z.string().default(PARENT_A_ID),
    courtMinNights: z.number().default(10),
    currentNights: z.number().default(10),
  }),
  seedStateBuilder: (params) => stateWithSchedule({
    courtOrder: {
      minimumNights: { [params.violatingParent]: params.courtMinNights },
      enforced: true,
    },
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const violator = state.parents.find((p) => p.id === params.violatingParent);
    return {
      state,
      outgoingMessages: [
        msg(42, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'high',
          text: `This change cannot proceed. It would reduce ${violator?.name}'s nights below the court-ordered minimum of ${params.courtMinNights} per month.`,
          sections: [
            { title: 'Guardrail details', bullets: [
              `Court-ordered minimum: ${params.courtMinNights} nights/month for ${violator?.name}`,
              `Current count: ${params.currentNights} nights`,
              'Removing even 1 night would violate the order',
            ]},
            { title: 'What you can do', bullets: [
              'Choose a different date that doesn\u2019t affect the minimum',
              'Request a court modification if circumstances have changed',
              'Contact your mediator for guidance',
            ]},
          ],
          actions: [
            { actionId: 'choose-different-date', label: 'Choose Different Date', style: 'primary' },
            { actionId: 'acknowledge', label: 'Understood', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'choose-different-date': (state) => state,
    acknowledge: (state) => state,
  },
};

// ─── 43. Right-of-first-refusal trigger (FULL) ────────────────

const scenario43: ScenarioDefinition = {
  number: 43,
  key: 'right-of-first-refusal-trigger',
  title: 'Right-of-first-refusal trigger',
  category: CATEGORIES.COMPLIANCE,
  description: 'Parent leaving child with sitter; must offer other parent first',
  implemented: true,
  paramsSchema: z.object({
    leavingParent: z.string().default(PARENT_A_ID),
    durationHours: z.number().default(6),
    reason: z.string().default('work event'),
  }),
  seedStateBuilder: () => stateWithSchedule({
    preConsentRules: [{
      id: 'rofr-001',
      type: 'right_of_first_refusal',
      triggerHours: 4,
      enabled: true,
    }],
  }),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const leaving = state.parents.find((p) => p.id === params.leavingParent);
    const other = state.parents.find((p) => p.id !== params.leavingParent);
    const child = state.children[0];
    return {
      state,
      outgoingMessages: [
        msg(43, {
          to: [other!.id],
          text: `${leaving?.name} will be away for ${params.durationHours} hours (${params.reason}). Right-of-first-refusal: would you like to have ${child.name} during this time?`,
          sections: [
            { title: 'Details', bullets: [
              `${leaving?.name} is away for ${params.durationHours} hours`,
              `Reason: ${params.reason}`,
              `Right-of-first-refusal threshold: 4+ hours`,
              `${other?.name} gets first option before a sitter is arranged`,
            ]},
          ],
          actions: [
            { actionId: 'accept-rofr', label: `I'll Take ${child.name}`, style: 'primary' },
            { actionId: 'decline-rofr', label: 'Decline — Sitter OK', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'accept-rofr': (state) => state,
    'decline-rofr': (state) => state,
  },
};

// ─── 44. Parenting-plan anniversary review (FULL) ─────────────

const scenario44: ScenarioDefinition = {
  number: 44,
  key: 'parenting-plan-anniversary-review',
  title: 'Parenting-plan anniversary review',
  category: CATEGORIES.COMPLIANCE,
  description: 'Annual check-in: is the current plan still working?',
  implemented: true,
  paramsSchema: z.object({
    planStartDate: z.string().default('2025-03-01'),
    totalSwaps: z.number().default(24),
    avgFairnessDelta: z.number().default(1.5),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(44, {
          to: [PARENT_A_ID, PARENT_B_ID],
          urgency: 'low',
          text: `Your parenting plan has been active for 1 year (since ${params.planStartDate}). Here's a summary to help you decide if adjustments are needed.`,
          sections: [
            { title: 'Year in review', bullets: [
              `${params.totalSwaps} schedule changes processed`,
              `Average fairness delta: ${params.avgFairnessDelta} nights`,
              `${state.children.length} child(ren) covered`,
            ]},
            { title: 'Considerations', bullets: [
              'Has the child\u2019s age band changed? (may affect recommendations)',
              'Are school schedules or activities different?',
              'Do exchange logistics still work?',
            ]},
          ],
          actions: [
            { actionId: 'keep-plan', label: 'Keep Current Plan', style: 'primary' },
            { actionId: 'review-adjustments', label: 'Review Adjustments', style: 'secondary' },
            { actionId: 'schedule-mediator', label: 'Schedule Mediator', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'keep-plan': (state) => state,
    'review-adjustments': (state) => state,
    'schedule-mediator': (state) => state,
  },
};

export const complianceScenarios: ScenarioDefinition[] = [
  scenario42, scenario43, scenario44,
];
