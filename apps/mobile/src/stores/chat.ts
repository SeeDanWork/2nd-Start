import { create } from 'zustand';
import { ChatMessage, ChipOption, ActionCard, StructuredAction, ChatContext } from '../chat/types';
import { resolveIntent } from '../chat/intents';
import { executeAction } from '../chat/executors';
import { ONBOARDING_TURNS } from '../chat/flows/onboarding';
import { LIFECYCLE_WELCOME_MESSAGE, LIFECYCLE_CHIPS } from '../chat/flows/lifecycle';
import { useAuthStore } from './auth';
import { onboardingApi, familiesApi } from '../api/client';

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function botMessage(
  content?: string,
  card?: ActionCard,
  chips?: ChipOption[],
): ChatMessage {
  return {
    id: makeId(),
    role: 'bot',
    content,
    card,
    chips,
    timestamp: Date.now(),
  };
}

function userMessage(content: string): ChatMessage {
  return {
    id: makeId(),
    role: 'user',
    content,
    timestamp: Date.now(),
  };
}

export interface WizardState {
  childrenCount: number;
  ageBands: string[];
  schoolDays: number[];
  daycareDays: number[];
  exchangeLocation: string;
  lockedNights: number[];
  targetSharePct: number;
  maxHandoffsPerWeek: number;
  maxConsecutiveAway: number;
  weekendPreference: string;
  familyName: string;
  inviteEmail: string;
}

export interface ScheduleOption {
  id: string;
  profileName: string;
  assignments: Array<{ date: string; parentId: string }>;
  stats: {
    parentANights: number;
    parentBNights: number;
    handoffs: number;
    score: number;
  };
  explanation: string[];
}

interface ChatState {
  messages: ChatMessage[];
  isOnboarding: boolean;
  onboardingStep: number;
  wizard: WizardState;
  options: ScheduleOption[];
  isGenerating: boolean;
  selectedDays: number[];

  addMessage: (msg: ChatMessage) => void;
  processUserInput: (text: string) => Promise<void>;
  processChipSelection: (value: string) => Promise<void>;
  advanceOnboarding: () => void;
  handleGenerate: () => Promise<void>;
  startOnboarding: () => void;
  startLifecycle: () => void;
  setSelectedDays: (days: number[]) => void;
  setWizardField: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  reset: () => void;
}

const DEFAULT_WIZARD: WizardState = {
  childrenCount: 1,
  ageBands: ['5_to_10'],
  schoolDays: [1, 2, 3, 4, 5],
  daycareDays: [1, 2, 3, 4, 5],
  exchangeLocation: 'school',
  lockedNights: [],
  targetSharePct: 50,
  maxHandoffsPerWeek: 3,
  maxConsecutiveAway: 5,
  weekendPreference: 'alternate',
  familyName: '',
  inviteEmail: '',
};

function buildOnboardingInput(wizard: WizardState, userId: string) {
  return {
    userId,
    childrenCount: wizard.childrenCount,
    ageBands: wizard.ageBands,
    schoolDays: wizard.schoolDays,
    daycareDays: wizard.daycareDays,
    exchangeLocation: wizard.exchangeLocation,
    lockedNights: wizard.lockedNights,
    targetSharePct: wizard.targetSharePct,
    maxHandoffsPerWeek: wizard.maxHandoffsPerWeek,
    maxConsecutiveAway: wizard.maxConsecutiveAway,
    weekendPreference: wizard.weekendPreference,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOnboarding: false,
  onboardingStep: 0,
  wizard: { ...DEFAULT_WIZARD },
  options: [],
  isGenerating: false,
  selectedDays: [1, 2, 3, 4, 5],

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  setSelectedDays: (days) => set({ selectedDays: days }),

  setWizardField: (key, value) =>
    set((s) => ({ wizard: { ...s.wizard, [key]: value } })),

  startOnboarding: () => {
    const turn = ONBOARDING_TURNS[0];
    set({
      messages: [botMessage(turn.message, turn.card, turn.chips)],
      isOnboarding: true,
      onboardingStep: 0,
      wizard: { ...DEFAULT_WIZARD },
      options: [],
      selectedDays: [1, 2, 3, 4, 5],
    });
  },

  startLifecycle: () => {
    const state = get();
    if (state.messages.length > 0) return;
    set({
      messages: [botMessage(LIFECYCLE_WELCOME_MESSAGE, undefined, LIFECYCLE_CHIPS)],
      isOnboarding: false,
    });
  },

  advanceOnboarding: () => {
    const { onboardingStep } = get();
    const nextStep = onboardingStep + 1;
    if (nextStep >= ONBOARDING_TURNS.length) {
      set({ isOnboarding: false });
      return;
    }
    const turn = ONBOARDING_TURNS[nextStep];
    set((s) => ({
      onboardingStep: nextStep,
      messages: [...s.messages, botMessage(turn.message, turn.card, turn.chips)],
      selectedDays: turn.card?.type === 'day_selector'
        ? (turn.card.data.selected as number[])
        : s.selectedDays,
    }));

    if (turn.autoAdvance) {
      get().handleGenerate();
    }
  },

  handleGenerate: async () => {
    set({ isGenerating: true });

    try {
      const state = get();
      const authState = useAuthStore.getState();
      const input = buildOnboardingInput(state.wizard, authState.user?.id || '');

      const { data } = await onboardingApi.generateOptions(input);
      const options: ScheduleOption[] = (data.options || data || []).map(
        (opt: any, i: number) => ({
          id: opt.id || `option-${i}`,
          profileName: opt.profileName || opt.profile_name || `Option ${i + 1}`,
          assignments: opt.assignments || [],
          stats: {
            parentANights: opt.stats?.parentANights ?? opt.stats?.parent_a_nights ?? 7,
            parentBNights: opt.stats?.parentBNights ?? opt.stats?.parent_b_nights ?? 7,
            handoffs: opt.stats?.handoffs ?? opt.stats?.transitions ?? 2,
            score: opt.stats?.score ?? opt.stats?.total_score ?? 0,
          },
          explanation: opt.explanation || opt.bullets || [],
        }),
      );

      set({ options, isGenerating: false });
      get().advanceOnboarding();
    } catch {
      set({ isGenerating: false });
      set((s) => ({
        messages: [
          ...s.messages,
          botMessage(
            "I had trouble generating schedule options. Let's try creating a basic schedule instead.",
            undefined,
            [
              { label: 'Try again', value: 'retry_generate' },
              { label: 'Skip to calendar', value: 'nav_calendar' },
            ],
          ),
        ],
      }));
    }
  },

  processUserInput: async (text: string) => {
    const state = get();
    set((s) => ({ messages: [...s.messages, userMessage(text)] }));

    const context: ChatContext = {
      isOnboarding: state.isOnboarding,
      onboardingStep: state.onboardingStep,
      familyId: useAuthStore.getState().family?.id,
      userId: useAuthStore.getState().user?.id,
    };

    const action = resolveIntent(text, context);
    if (action) {
      const result = await executeAction(action);
      const newMessages = result.messages.map((m) => ({
        ...m,
        id: makeId(),
        timestamp: Date.now(),
      })) as ChatMessage[];
      set((s) => ({ messages: [...s.messages, ...newMessages] }));
    } else {
      set((s) => ({
        messages: [
          ...s.messages,
          botMessage(
            "I'm not sure what you mean. Try one of these options:",
            undefined,
            LIFECYCLE_CHIPS,
          ),
        ],
      }));
    }
  },

  processChipSelection: async (value: string) => {
    const state = get();

    if (state.isOnboarding) {
      await handleOnboardingChip(value, get, set);
    } else {
      await get().processUserInput(value);
    }
  },

  reset: () =>
    set({
      messages: [],
      isOnboarding: false,
      onboardingStep: 0,
      wizard: { ...DEFAULT_WIZARD },
      options: [],
      isGenerating: false,
      selectedDays: [1, 2, 3, 4, 5],
    }),
}));

async function handleOnboardingChip(
  value: string,
  get: () => ChatState,
  set: (fn: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) => void,
) {
  const state = get();
  const step = state.onboardingStep;
  const turn = ONBOARDING_TURNS[step];

  const chipLabel =
    turn.chips?.find((c) => c.value === value)?.label || value;
  set((s) => ({ messages: [...s.messages, userMessage(chipLabel)] }));

  switch (turn.actionType) {
    case 'set_children_count':
      set((s) => ({
        wizard: { ...s.wizard, childrenCount: parseInt(value, 10) || 1 },
      }));
      get().advanceOnboarding();
      break;

    case 'set_age_bands':
      set((s) => ({
        wizard: { ...s.wizard, ageBands: [value] },
      }));
      get().advanceOnboarding();
      break;

    case 'set_school_days':
      set((s) => ({
        wizard: {
          ...s.wizard,
          schoolDays: s.selectedDays,
          daycareDays: s.selectedDays,
        },
      }));
      get().advanceOnboarding();
      break;

    case 'set_exchange_location':
      set((s) => ({
        wizard: { ...s.wizard, exchangeLocation: value },
      }));
      get().advanceOnboarding();
      break;

    case 'set_locked_nights':
      if (value === 'none') {
        set((s) => ({
          wizard: { ...s.wizard, lockedNights: [] },
        }));
      } else {
        set((s) => ({
          wizard: { ...s.wizard, lockedNights: s.selectedDays },
        }));
      }
      get().advanceOnboarding();
      break;

    case 'set_target_split':
      set((s) => ({
        wizard: { ...s.wizard, targetSharePct: parseInt(value, 10) || 50 },
      }));
      get().advanceOnboarding();
      break;

    case 'create_family': {
      const wizard = get().wizard;
      try {
        const authStore = useAuthStore.getState();
        await authStore.createFamily(
          wizard.familyName.trim() || 'My Family',
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
        set((s) => ({
          messages: [
            ...s.messages,
            botMessage('Family created!'),
          ],
        }));
        get().advanceOnboarding();
      } catch (err: any) {
        set((s) => ({
          messages: [
            ...s.messages,
            botMessage(
              `Couldn't create family: ${err.response?.data?.message || 'Please try again.'}`,
              undefined,
              [{ label: 'Try again', value: 'create' }],
            ),
          ],
        }));
      }
      break;
    }

    case 'invite_coparent': {
      if (value === 'skip') {
        get().advanceOnboarding();
        break;
      }
      const wizard = get().wizard;
      const family = useAuthStore.getState().family;
      if (!family || !wizard.inviteEmail.trim()) {
        get().advanceOnboarding();
        break;
      }
      try {
        await familiesApi.invite(family.id, {
          email: wizard.inviteEmail.trim().toLowerCase(),
          role: 'parent_b',
          label: 'Parent B',
        });
        set((s) => ({
          messages: [
            ...s.messages,
            botMessage(`Invite sent to ${wizard.inviteEmail}!`),
          ],
        }));
      } catch {
        set((s) => ({
          messages: [
            ...s.messages,
            botMessage("Couldn't send the invite, but you can do it later in Settings."),
          ],
        }));
      }
      get().advanceOnboarding();
      break;
    }

    case 'generate_options':
      break;

    case 'select_schedule':
      break;

    case 'onboarding_complete':
      set({ isOnboarding: false });
      break;

    default:
      get().advanceOnboarding();
      break;
  }
}
