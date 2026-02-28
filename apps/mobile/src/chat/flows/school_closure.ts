import type { ScenarioFlow } from '../types';

/**
 * School Closure Flow
 * Which days? → Logistics fallback preview → Confirm
 */
export const SCHOOL_CLOSURE_FLOW: ScenarioFlow = {
  id: 'school_closure',
  name: 'School Closure',
  description: 'Handle school or daycare closures',
  turns: [
    {
      message: 'Which days is school/daycare closed?',
      card: {
        type: 'date_range_picker',
        data: { label: 'Select closure dates' },
      },
      chips: [
        { label: 'Just tomorrow', value: 'tomorrow' },
        { label: 'Rest of this week', value: 'rest_of_week' },
        { label: "I've selected the dates", value: 'custom' },
      ],
      actionType: 'set_closure_dates',
    },
    {
      message: "The schedule stays the same — I'll adjust handoff locations since school is closed:",
      card: {
        type: 'disruption_preview',
        data: { loading: true },
      },
      chips: [
        { label: 'Looks good', value: 'accept' },
        { label: 'Change the schedule too', value: 'change_schedule' },
      ],
      actionType: 'confirm_closure_action',
    },
    {
      message: 'All set! Handoff locations updated on your calendar.',
      card: {
        type: 'confirmation',
        data: { icon: 'check' },
      },
      actionType: 'closure_complete',
    },
  ],
};
