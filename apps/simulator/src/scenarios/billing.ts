import { z } from 'zod';
import { ScenarioDefinition, CATEGORIES } from '../types';
import {
  PARENT_A_ID, PARENT_B_ID,
  defaultState, stateWithSchedule, msg, resetMessageSeq, stub,
} from '../helpers';

// ─── 45. Trial-ending upgrade prompt (FULL) ────────────────────

const scenario45: ScenarioDefinition = {
  number: 45,
  key: 'trial-ending-upgrade-prompt',
  title: 'Trial-ending upgrade prompt',
  category: CATEGORIES.BILLING,
  description: 'Trial ends in N days; show plan comparison, upgrade/downgrade',
  implemented: true,
  paramsSchema: z.object({
    daysLeft: z.number().default(3),
    trialEndDate: z.string().default('2026-03-04'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(45, {
          to: [PARENT_A_ID],
          text: `Your free trial ends in ${params.daysLeft} days (${params.trialEndDate}). Choose a plan to continue using all features.`,
          sections: [
            { title: 'Free plan', bullets: [
              'Basic schedule view',
              'Up to 2 swap requests per month',
              'No fairness tracking',
            ]},
            { title: 'Premium plan — $9.99/month', bullets: [
              'Unlimited swap requests',
              'Fairness tracking and rebalancing',
              'Holiday and vacation planning',
              'Priority support',
            ]},
            { title: 'Family plan — $14.99/month', bullets: [
              'Everything in Premium',
              'Multiple children support',
              'Activity coordination',
              'Shared expense tracking',
            ]},
          ],
          actions: [
            { actionId: 'upgrade-premium', label: 'Go Premium', style: 'primary', payload: { plan: 'premium', price: 9.99 } },
            { actionId: 'upgrade-family', label: 'Go Family', style: 'primary', payload: { plan: 'family', price: 14.99 } },
            { actionId: 'stay-free', label: 'Continue Free', style: 'secondary', payload: { plan: 'free' } },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'upgrade-premium': (state) => state,
    'upgrade-family': (state) => state,
    'stay-free': (state) => state,
  },
};

// ─── 46. Payment failed retry (stub) ───────────────────────────

const scenario46 = stub(46, 'payment-failed-retry', 'Payment failed retry', CATEGORIES.BILLING,
  'Card declined; update payment method or retry');

// ─── 47. Plan change confirmation (stub) ───────────────────────

const scenario47 = stub(47, 'plan-change-confirmation', 'Plan change confirmation', CATEGORIES.BILLING,
  'Confirm upgrade/downgrade; show prorated amount');

// ─── 48. Referral reward notification (stub) ───────────────────

const scenario48 = stub(48, 'referral-reward-notification', 'Referral reward notification', CATEGORIES.BILLING,
  'Friend signed up; credit applied to account');

export const billingScenarios: ScenarioDefinition[] = [
  scenario45, scenario46, scenario47, scenario48,
];
