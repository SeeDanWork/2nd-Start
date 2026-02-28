import type { ScenarioFlow } from '../types';

/**
 * Illness Protocol Flow
 * Who is sick? → How long? → Decision tree result → Confirm
 */
export const ILLNESS_PROTOCOL_FLOW: ScenarioFlow = {
  id: 'illness_protocol',
  name: 'Illness Protocol',
  description: 'Handle schedule changes when someone is sick',
  turns: [
    {
      message: "Who isn't feeling well?",
      chips: [
        { label: 'A child', value: 'child_sick' },
        { label: 'Me / a caregiver', value: 'caregiver_sick' },
      ],
      actionType: 'set_illness_who',
    },
    {
      message: 'How long do you expect this to last?',
      chips: [
        { label: '1-2 days', value: 'short' },
        { label: '3-4 days', value: 'medium' },
        { label: 'A week or more', value: 'long' },
      ],
      actionType: 'set_illness_duration',
    },
    {
      message: "Based on the illness duration, here's what we suggest:",
      card: {
        type: 'disruption_preview',
        data: { loading: true },
      },
      chips: [
        { label: 'Apply this', value: 'accept' },
        { label: 'Let me decide', value: 'manual' },
      ],
      actionType: 'confirm_illness_action',
    },
    {
      message: 'Take care! The schedule has been updated.',
      card: {
        type: 'confirmation',
        data: { icon: 'heart' },
      },
      actionType: 'illness_complete',
    },
  ],
};
