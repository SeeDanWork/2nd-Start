import { OnboardingTurn } from '../types';

export const ONBOARDING_TURNS: OnboardingTurn[] = [
  // Turn 0 (index 0)
  {
    message: "Welcome! Let's set up a schedule that works for everyone.\n\nHow many children do you have?",
    chips: [
      { label: '1', value: '1' },
      { label: '2', value: '2' },
      { label: '3+', value: '3' },
    ],
    actionType: 'set_children_count',
  },
  // Turn 1
  {
    message: 'What age range? Select all that apply.',
    chips: [
      { label: 'Under 5', value: 'under_5' },
      { label: '5 to 10', value: '5_to_10' },
      { label: '11 to 17', value: '11_to_17' },
    ],
    actionType: 'set_age_bands',
  },
  // Turn 2
  {
    message: "How will your children's time be divided between homes?",
    chips: [
      { label: 'Two homes, shared time', value: 'shared' },
      { label: 'Primary home with visits', value: 'primary_visits' },
      { label: "We're not sure yet", value: 'undecided' },
    ],
    actionType: 'set_living_arrangement',
  },
  // Turn 3
  {
    message: 'Which days is school or daycare?',
    card: {
      type: 'day_selector',
      data: { selected: [1, 2, 3, 4, 5], label: 'School/daycare days' },
    },
    chips: [
      { label: 'These days look right', value: 'confirm' },
      { label: "I've adjusted them", value: 'adjusted' },
    ],
    actionType: 'set_school_days',
  },
  // Turn 4
  {
    message: 'Where do handoffs usually happen?',
    chips: [
      { label: 'School drop-off', value: 'school' },
      { label: 'Daycare', value: 'daycare' },
      { label: 'Home', value: 'home' },
      { label: 'Other', value: 'other' },
    ],
    actionType: 'set_exchange_location',
  },
  // Turn 5
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
    actionType: 'set_locked_nights',
  },
  // Turn 6
  {
    message: 'How should overnights be split?',
    chips: [
      { label: 'Even split (50/50)', value: '50' },
      { label: 'Mostly with me (60/40)', value: '60' },
      { label: 'Mostly with co-parent (40/60)', value: '40' },
    ],
    actionType: 'set_target_split',
  },
  // Turn 7 — Visual pattern picker
  {
    message: "Pick a pattern that feels right for your family. These show two weeks of overnights.",
    card: { type: 'visual_pattern', data: {} },
    actionType: 'select_pattern',
  },
  // Turn 8 — Schedule start date
  {
    message: 'When should your schedule start?',
    chips: [
      { label: 'Immediately', value: 'immediately' },
      { label: 'Next Day', value: 'next_day' },
      { label: 'Choose a Date', value: 'choose_date' },
    ],
    actionType: 'set_start_date',
  },
  // Turn 9
  {
    message: "Great! Let's create your family.",
    card: {
      type: 'text_input',
      data: { placeholder: 'Family name (optional)', field: 'familyName' },
    },
    chips: [{ label: 'Create Family', value: 'create' }],
    actionType: 'create_family',
  },
  // Turn 10
  {
    message: 'Want to invite your co-parent now?',
    card: {
      type: 'text_input',
      data: { placeholder: 'Co-parent email', field: 'inviteEmail' },
    },
    chips: [
      { label: 'Send Invite', value: 'send' },
      { label: 'Skip for now', value: 'skip' },
    ],
    actionType: 'invite_coparent',
  },
  // Turn 11
  {
    message: 'Building your schedule options...',
    card: {
      type: 'loading',
      data: {
        phases: [
          'Analyzing constraints...',
          'Generating patterns...',
          'Scoring options...',
          'Almost ready...',
        ],
      },
    },
    actionType: 'generate_options',
    autoAdvance: true,
  },
  // Turn 12
  {
    message: 'Here are your schedule options. Tap to see details.',
    card: {
      type: 'schedule_option',
      data: {},
    },
    actionType: 'select_schedule',
  },
  // Turn 13
  {
    message: "You're all set! Your schedule is ready.",
    card: {
      type: 'checklist',
      data: {
        items: [
          { label: 'Family created', done: true },
          { label: 'Schedule set', done: true },
          { label: 'Invite co-parent', done: false },
          { label: 'Review next month', done: false },
        ],
      },
    },
    chips: [
      { label: 'View Calendar', value: 'nav_calendar' },
      { label: 'Explore Chat', value: 'explore_chat' },
    ],
    actionType: 'onboarding_complete',
  },
];
