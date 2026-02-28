import type { ScenarioFlow } from '../types';

/**
 * Handoff Logistics Flow
 * What changed? → Impact + fallback → Confirm
 */
export const HANDOFF_LOGISTICS_FLOW: ScenarioFlow = {
  id: 'handoff_logistics',
  name: 'Handoff Change',
  description: 'Adjust handoff logistics when something changes (transport, location, etc.)',
  turns: [
    {
      message: "What's changing about the handoff?",
      chips: [
        { label: "Can't get to school", value: 'transport_failure' },
        { label: 'Need a different location', value: 'location_change' },
        { label: 'Need a different time', value: 'time_change' },
      ],
      actionType: 'set_handoff_change',
    },
    {
      message: "Here's the impact and a suggested alternative:",
      card: {
        type: 'impact_preview',
        data: { loading: true },
      },
      chips: [
        { label: 'Use this alternative', value: 'accept' },
        { label: 'Suggest something else', value: 'other' },
      ],
      actionType: 'confirm_handoff_change',
    },
    {
      message: 'Updated! The handoff details have been adjusted.',
      card: {
        type: 'confirmation',
        data: { icon: 'check' },
      },
      actionType: 'handoff_complete',
    },
  ],
};
