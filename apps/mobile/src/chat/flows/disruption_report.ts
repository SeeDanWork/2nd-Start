import type { ScenarioFlow } from '../types';

/**
 * Disruption Report Flow
 * What happened? → Which dates? → Recommendation preview → Confirm
 */
export const DISRUPTION_REPORT_FLOW: ScenarioFlow = {
  id: 'disruption_report',
  name: 'Report a Disruption',
  description: 'Report something that affects the schedule (closure, travel, etc.)',
  turns: [
    {
      message: 'What happened?',
      chips: [
        { label: 'School/daycare closed', value: 'school_closed' },
        { label: 'Child is sick', value: 'child_sick' },
        { label: "I'm traveling", value: 'parent_travel' },
        { label: 'Something else', value: 'other_declared' },
      ],
      actionType: 'set_disruption_type',
    },
    {
      message: 'Which dates are affected?',
      card: {
        type: 'date_range_picker',
        data: { label: 'Select affected dates' },
      },
      chips: [
        { label: 'Just today', value: 'today' },
        { label: 'This week', value: 'this_week' },
        { label: "I've selected the dates", value: 'custom' },
      ],
      actionType: 'set_disruption_dates',
    },
    {
      message: "Here's what we recommend based on your situation:",
      card: {
        type: 'disruption_preview',
        data: { loading: true },
      },
      chips: [
        { label: 'Looks good, apply it', value: 'accept' },
        { label: "I'd like something different", value: 'modify' },
      ],
      actionType: 'confirm_disruption_action',
    },
    {
      message: "Done! I've updated the schedule. You'll see the changes on your calendar.",
      card: {
        type: 'confirmation',
        data: { icon: 'check' },
      },
      actionType: 'disruption_complete',
    },
  ],
};
