import type { ScenarioFlow } from '../types';

/**
 * Policy Review Flow
 * "Save as default?" → Policy preview → Confirm/Decline
 */
export const POLICY_REVIEW_FLOW: ScenarioFlow = {
  id: 'policy_review',
  name: 'Save as Default',
  description: 'Save a disruption response as your default for future similar events',
  turns: [
    {
      message: "I noticed you've handled this type of event the same way twice. Would you like to save this as your default?",
      card: {
        type: 'policy_preview',
        data: { loading: true },
      },
      chips: [
        { label: 'Yes, save as default', value: 'accept' },
        { label: 'No, ask me each time', value: 'decline' },
      ],
      actionType: 'confirm_policy_save',
    },
    {
      message: "Saved! Next time this happens, I'll apply it automatically. You can always change this in Settings.",
      card: {
        type: 'confirmation',
        data: { icon: 'check' },
      },
      actionType: 'policy_save_complete',
      condition: (ctx) => ctx.policyAccepted === true,
    },
    {
      message: "No problem — I'll keep asking each time.",
      actionType: 'policy_save_declined',
      condition: (ctx) => ctx.policyAccepted === false,
    },
  ],
};
