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
            { title: 'Premium plan \u2014 $9.99/month', bullets: [
              'Unlimited swap requests',
              'Fairness tracking and rebalancing',
              'Holiday and vacation planning',
              'Priority support',
            ]},
            { title: 'Family plan \u2014 $14.99/month', bullets: [
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

// ─── 46. Payment failed retry (FULL) ──────────────────────────

const scenario46: ScenarioDefinition = {
  number: 46,
  key: 'payment-failed-retry',
  title: 'Payment failed retry',
  category: CATEGORIES.BILLING,
  description: 'Card declined; update payment method or retry',
  implemented: true,
  paramsSchema: z.object({
    failedDate: z.string().default('2026-03-01'),
    cardLast4: z.string().default('4242'),
    planName: z.string().default('Premium'),
    amount: z.number().default(9.99),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(46, {
          to: [PARENT_A_ID],
          text: `Payment of $${params.amount} for your ${params.planName} plan failed on ${params.failedDate} (card ending ${params.cardLast4}).`,
          sections: [
            { title: 'What happens next', bullets: [
              'Your plan remains active for 7 days',
              'We\u2019ll retry automatically in 3 days',
              'Update your payment method to avoid service interruption',
            ]},
          ],
          actions: [
            { actionId: 'update-payment', label: 'Update Payment Method', style: 'primary' },
            { actionId: 'retry-now', label: 'Retry Now', style: 'secondary' },
            { actionId: 'downgrade', label: 'Switch to Free Plan', style: 'danger' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'update-payment': (state) => state,
    'retry-now': (state) => state,
    downgrade: (state) => ({
      ...state,
      subscriptions: state.subscriptions.map((s) =>
        s.parentId === PARENT_A_ID ? { ...s, plan: 'free' } : s,
      ),
    }),
  },
};

// ─── 47. Plan change confirmation (FULL) ──────────────────────

const scenario47: ScenarioDefinition = {
  number: 47,
  key: 'plan-change-confirmation',
  title: 'Plan change confirmation',
  category: CATEGORIES.BILLING,
  description: 'Confirm upgrade/downgrade; show prorated amount',
  implemented: true,
  paramsSchema: z.object({
    currentPlan: z.string().default('Premium'),
    newPlan: z.string().default('Family'),
    proratedAmount: z.number().default(5.00),
    effectiveDate: z.string().default('2026-03-01'),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    const isUpgrade = params.newPlan === 'Family';
    return {
      state,
      outgoingMessages: [
        msg(47, {
          to: [PARENT_A_ID],
          text: `Confirm plan change from ${params.currentPlan} to ${params.newPlan}. ${isUpgrade ? 'Prorated charge' : 'Credit'}: $${params.proratedAmount.toFixed(2)}.`,
          sections: [
            { title: 'Change summary', bullets: [
              `From: ${params.currentPlan}`,
              `To: ${params.newPlan}`,
              `Effective: ${params.effectiveDate}`,
              `${isUpgrade ? 'Additional charge' : 'Credit'}: $${params.proratedAmount.toFixed(2)}`,
            ]},
            ...(isUpgrade ? [{ title: 'New features', bullets: [
              'Multiple children support',
              'Activity coordination',
              'Shared expense tracking',
            ]}] : []),
          ],
          actions: [
            { actionId: 'confirm-change', label: `Confirm ${isUpgrade ? 'Upgrade' : 'Downgrade'}`, style: 'primary' },
            { actionId: 'cancel-change', label: 'Keep Current Plan', style: 'secondary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'confirm-change': (state) => ({
      ...state,
      subscriptions: state.subscriptions.map((s) =>
        s.parentId === PARENT_A_ID ? { ...s, plan: 'family' } : s,
      ),
    }),
    'cancel-change': (state) => state,
  },
};

// ─── 48. Referral reward notification (FULL) ──────────────────

const scenario48: ScenarioDefinition = {
  number: 48,
  key: 'referral-reward-notification',
  title: 'Referral reward notification',
  category: CATEGORIES.BILLING,
  description: 'Friend signed up; credit applied to account',
  implemented: true,
  paramsSchema: z.object({
    referredName: z.string().default('Taylor'),
    creditAmount: z.number().default(5.00),
    totalCredits: z.number().default(15.00),
  }),
  seedStateBuilder: () => stateWithSchedule(),
  triggerEvent: (state, params) => {
    resetMessageSeq();
    return {
      state,
      outgoingMessages: [
        msg(48, {
          to: [PARENT_A_ID],
          urgency: 'low',
          text: `${params.referredName} signed up using your referral. $${params.creditAmount.toFixed(2)} credit has been applied to your account.`,
          sections: [
            { title: 'Referral details', bullets: [
              `New signup: ${params.referredName}`,
              `Credit earned: $${params.creditAmount.toFixed(2)}`,
              `Total credits: $${params.totalCredits.toFixed(2)}`,
            ]},
          ],
          actions: [
            { actionId: 'view-credits', label: 'View Credits', style: 'secondary' },
            { actionId: 'share-more', label: 'Share Referral Link', style: 'primary' },
          ],
        }),
      ],
    };
  },
  expectedStateTransitions: {
    'view-credits': (state) => state,
    'share-more': (state) => state,
  },
};

export const billingScenarios: ScenarioDefinition[] = [
  scenario45, scenario46, scenario47, scenario48,
];
