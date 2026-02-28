import { StructuredAction, ChatMessage } from './types';
import { useAuthStore } from '../stores/auth';

type ExecutorResult = {
  messages: Omit<ChatMessage, 'id' | 'timestamp'>[];
};

const executors: Record<
  string,
  (params: Record<string, unknown>) => Promise<ExecutorResult>
> = {
  propose_swap: async (params) => {
    const family = useAuthStore.getState().family;
    if (!family) {
      return {
        messages: [
          { role: 'bot', content: 'You need to set up a family first before swapping days.' },
        ],
      };
    }
    return {
      messages: [
        {
          role: 'bot',
          content: 'To propose a swap, head to the Requests tab and create a new change request.',
          chips: [
            { label: 'Go to Requests', value: 'nav_requests' },
            { label: 'Never mind', value: 'dismiss' },
          ],
        },
      ],
    };
  },

  notify_late: async (_params) => {
    // Stub — analytics event in the future
    return {
      messages: [
        {
          role: 'bot',
          content: "Got it — we'll let your co-parent know you're running late. (Coming soon!)",
        },
      ],
    };
  },

  explain_schedule: async (params) => {
    const family = useAuthStore.getState().family;
    if (!family) {
      return {
        messages: [
          { role: 'bot', content: "Once you've set up your schedule, I can explain how it works." },
        ],
      };
    }
    return {
      messages: [
        {
          role: 'bot',
          content: 'Your schedule is built to balance fairness, minimize transitions, and respect both parents\' constraints. Check the Calendar tab for details.',
          chips: [
            { label: 'View Calendar', value: 'nav_calendar' },
          ],
        },
      ],
    };
  },

  create_task: async (_params) => {
    // Stub — task lists coming in a future update
    return {
      messages: [
        {
          role: 'bot',
          content: "Task reminders are coming soon! For now, try setting a phone reminder.",
        },
      ],
    };
  },

  view_schedule: async (_params) => {
    return {
      messages: [
        {
          role: 'bot',
          content: 'You can see your full schedule in the Calendar tab.',
          chips: [
            { label: 'View Calendar', value: 'nav_calendar' },
          ],
        },
      ],
    };
  },

  illness_protocol: async (_params) => {
    return {
      messages: [
        {
          role: 'bot',
          content: "I'm sorry to hear someone isn't feeling well. Let me help adjust the schedule.",
          chips: [
            { label: 'A child is sick', value: 'child_sick' },
            { label: 'I / caregiver is sick', value: 'caregiver_sick' },
          ],
        },
      ],
    };
  },

  school_closure: async (_params) => {
    return {
      messages: [
        {
          role: 'bot',
          content: "School or daycare closed? I'll adjust handoff locations while keeping the custody schedule the same.",
          chips: [
            { label: 'Just tomorrow', value: 'tomorrow' },
            { label: 'Multiple days', value: 'multiple' },
          ],
        },
      ],
    };
  },

  disruption_report: async (_params) => {
    return {
      messages: [
        {
          role: 'bot',
          content: "Something unexpected? Let me help you adjust the schedule.",
          chips: [
            { label: 'School/daycare closed', value: 'school_closed' },
            { label: 'Emergency', value: 'emergency' },
            { label: 'Travel plans', value: 'travel' },
            { label: 'Other', value: 'other' },
          ],
        },
      ],
    };
  },

  explain_multi_child: async (_params) => {
    return {
      messages: [
        {
          role: 'bot',
          content: "Your schedule accounts for all your children's ages:\n\n" +
            "• **Safety first**: The most restrictive limits come from your youngest child\n" +
            "• **Stability focus**: Transition penalties are set by the most sensitive age\n" +
            "• **Sibling unity**: All siblings always stay together\n\n" +
            "The schedule automatically adjusts as your children grow.",
          card: {
            type: 'multi_child_summary',
            data: { loading: true },
          },
        },
      ],
    };
  },

  handoff_logistics: async (_params) => {
    return {
      messages: [
        {
          role: 'bot',
          content: "Need to change a handoff? I can help find an alternative.",
          chips: [
            { label: "Can't get to school", value: 'transport' },
            { label: 'Need different location', value: 'location' },
            { label: 'Need different time', value: 'time' },
          ],
        },
      ],
    };
  },
};

export async function executeAction(action: StructuredAction): Promise<ExecutorResult> {
  const executor = executors[action.type];
  if (!executor) {
    return {
      messages: [
        {
          role: 'bot',
          content: "I'm not sure how to help with that yet. Try one of these options:",
          chips: [
            { label: 'Swap days', value: 'swap' },
            { label: 'View schedule', value: 'schedule' },
            { label: 'Running late', value: 'late' },
          ],
        },
      ],
    };
  }
  return executor(action.params);
}
