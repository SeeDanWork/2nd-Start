import { ChipOption } from '../types';

export const LIFECYCLE_WELCOME_MESSAGE =
  "Hey! I'm here to help with your co-parenting schedule. What would you like to do?";

export const LIFECYCLE_CHIPS: ChipOption[] = [
  { label: 'Swap days', value: 'swap' },
  { label: 'View schedule', value: 'schedule' },
  { label: 'Report a disruption', value: 'disruption_checkin' },
  { label: 'Running late', value: 'late' },
  { label: 'Why this schedule?', value: 'why' },
];
