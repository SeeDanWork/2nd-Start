import { OnboardingTurn } from '../types';

export const JOINER_TURNS: OnboardingTurn[] = [
  // Turn 0 — Welcome
  {
    message: "Welcome! You've been invited to join your co-parenting family.",
    card: {
      type: 'info',
      data: { text: 'We just need a few preferences from you to build a schedule that works for both parents.' },
    },
    chips: [{ label: "Let's go", value: 'start' }],
    actionType: 'joiner_welcome',
  },
  // Turn 1 — Preview existing schedule
  {
    message: "Here's the current schedule your co-parent set up.",
    card: {
      type: 'schedule_preview',
      data: {},
    },
    chips: [
      { label: 'Looks good', value: 'ok' },
      { label: "Let's optimize", value: 'optimize' },
    ],
    actionType: 'joiner_review_schedule',
  },
  // Turn 2 — Locked nights
  {
    message: "Any nights you're regularly unavailable?",
    card: {
      type: 'day_selector',
      data: { selected: [], label: 'Unavailable nights' },
    },
    chips: [
      { label: "None — I'm flexible", value: 'none' },
      { label: "I've selected my nights", value: 'selected' },
    ],
    actionType: 'set_locked_nights_b',
  },
  // Turn 3 — Target split
  {
    message: 'How should overnights be split?',
    chips: [
      { label: 'Even split (50/50)', value: '50' },
      { label: 'Mostly with me (60/40)', value: '60' },
      { label: 'Mostly with co-parent (40/60)', value: '40' },
    ],
    actionType: 'set_target_split_b',
  },
  // Turn 4 — Max consecutive
  {
    message: "What's the longest stretch (nights) away from either parent?",
    chips: [
      { label: '3 nights', value: '3' },
      { label: '5 nights', value: '5' },
      { label: '7 nights', value: '7' },
    ],
    actionType: 'set_max_consecutive_b',
  },
  // Turn 5 — Loading / generate
  {
    message: 'Generating an optimized schedule with both parents...',
    card: {
      type: 'loading',
      data: {
        phases: [
          'Loading preferences...',
          'Merging constraints...',
          'Optimizing schedule...',
          'Almost ready...',
        ],
      },
    },
    actionType: 'generate_joiner_options',
    autoAdvance: true,
  },
  // Turn 6 — Show options
  {
    message: 'Here are your updated schedule options. Tap to see details.',
    card: {
      type: 'schedule_option',
      data: {},
    },
    actionType: 'select_joiner_schedule',
  },
  // Turn 7 — Complete
  {
    message: "You're all set! Your shared schedule is ready.",
    card: {
      type: 'checklist',
      data: {
        items: [
          { label: 'Joined family', done: true },
          { label: 'Preferences collected', done: true },
          { label: 'Schedule optimized', done: true },
          { label: 'Ready to go', done: true },
        ],
      },
    },
    chips: [
      { label: 'View Calendar', value: 'nav_calendar' },
      { label: 'Explore Chat', value: 'explore_chat' },
    ],
    actionType: 'joiner_complete',
  },
];
