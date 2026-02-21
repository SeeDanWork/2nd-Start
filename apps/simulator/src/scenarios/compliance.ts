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
    const other = state.parents.find((p) => p.id !== params.violatingParent);
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

// ─── 43. Right-of-first-refusal trigger (stub) ────────────────

const scenario43 = stub(43, 'right-of-first-refusal-trigger', 'Right-of-first-refusal trigger', CATEGORIES.COMPLIANCE,
  'Parent leaving child with sitter; must offer other parent first');

// ─── 44. Parenting-plan anniversary review (stub) ──────────────

const scenario44 = stub(44, 'parenting-plan-anniversary-review', 'Parenting-plan anniversary review', CATEGORIES.COMPLIANCE,
  'Annual check-in: is the current plan still working?');

export const complianceScenarios: ScenarioDefinition[] = [
  scenario42, scenario43, scenario44,
];
