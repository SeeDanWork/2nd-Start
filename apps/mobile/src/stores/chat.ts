import { create } from 'zustand';
import { Platform } from 'react-native';
import { ChatMessage, ChipOption, ActionCard, StructuredAction, ChatContext } from '../chat/types';
import { resolveIntent } from '../chat/intents';
import { executeAction } from '../chat/executors';
import { ONBOARDING_TURNS } from '../chat/flows/onboarding';
import { JOINER_TURNS } from '../chat/flows/joiner';
import { LIFECYCLE_WELCOME_MESSAGE, LIFECYCLE_CHIPS } from '../chat/flows/lifecycle';
import { useAuthStore } from './auth';
import { onboardingApi, familiesApi, calendarApi, apiClient } from '../api/client';
import { DEFAULT_SCHEDULE_HORIZON_WEEKS } from '@adcp/shared';

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
  livingArrangement: string;
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

  // Joiner onboarding state
  isJoinerOnboarding: boolean;
  joinerStep: number;
  joinerFamilyId: string | null;
  joinerFamilyName: string | null;
  parentAInput: Record<string, unknown> | null;
  existingSchedulePreview: string[];

  addMessage: (msg: ChatMessage) => void;
  processUserInput: (text: string) => Promise<void>;
  processChipSelection: (value: string) => Promise<void>;
  advanceOnboarding: () => void;
  handleGenerate: () => Promise<void>;
  startOnboarding: () => void;
  startLifecycle: () => void;
  setSelectedDays: (days: number[]) => void;
  setWizardField: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  startJoinerOnboarding: (familyId: string, familyName: string) => Promise<void>;
  advanceJoinerOnboarding: () => void;
  handleJoinerGenerate: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_WIZARD: WizardState = {
  childrenCount: 1,
  ageBands: ['5_to_10'],
  livingArrangement: 'shared',
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

/** Map mobile chip values to Python AgeBand enum values */
const AGE_BAND_MAP: Record<string, string> = {
  under_5: '0-4',
  '5_to_10': '5-10',
  '11_to_17': '11-17',
};

/** Compute next Monday as YYYY-MM-DD */
function nextMonday(): string {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const daysToMon = dow === 0 ? 1 : 8 - dow;
  const start = new Date(today);
  start.setDate(today.getDate() + daysToMon);
  return start.toISOString().split('T')[0];
}

/**
 * Build the payload that matches the Python OnboardingInput Pydantic model.
 * Snake_case keys, nested parent_a / shared / school_schedule objects.
 */
function buildOnboardingInput(wizard: WizardState, userId: string) {
  const startDate = nextMonday();
  const hasDaycare = wizard.ageBands.some((b) => b === 'under_5');

  return {
    number_of_children: wizard.childrenCount,
    children_age_bands: wizard.ageBands.map((b) => AGE_BAND_MAP[b] || b),
    living_arrangement: wizard.livingArrangement,
    school_schedule: {
      school_days: wizard.schoolDays,
    },
    ...(hasDaycare
      ? { daycare_schedule: { daycare_days: wizard.daycareDays } }
      : {}),
    preferred_exchange_location: wizard.exchangeLocation,
    parent_a: {
      parent_id: userId,
      availability: {
        locked_nights: wizard.lockedNights,
      },
      preferences: {
        target_share_pct: wizard.targetSharePct,
        max_handoffs_per_week: wizard.maxHandoffsPerWeek,
        max_consecutive_nights_away: wizard.maxConsecutiveAway,
        weekend_preference: wizard.weekendPreference,
      },
    },
    shared: {
      start_date: startDate,
      horizon_days: DEFAULT_SCHEDULE_HORIZON_WEEKS * 7,
    },
  };
}

/** Map optimizer response options to mobile ScheduleOption[] */
function mapOptions(data: any): ScheduleOption[] {
  return (data.options || []).map((opt: any, i: number) => ({
    id: opt.id || `option-${i}`,
    profileName: opt.name || opt.profile || `Option ${i + 1}`,
    assignments: (opt.schedule || []).map((d: any) => ({
      date: d.date,
      parentId: d.assigned_to,
    })),
    stats: {
      parentANights: opt.stats?.parent_a_overnights ?? 7,
      parentBNights: opt.stats?.parent_b_overnights ?? 7,
      handoffs: opt.stats?.transitions_count ?? 2,
      score: opt.stats?.stability_score ?? 0,
    },
    explanation: opt.explanation?.bullets || [],
  }));
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOnboarding: false,
  onboardingStep: 0,
  wizard: { ...DEFAULT_WIZARD },
  options: [],
  isGenerating: false,
  selectedDays: [1, 2, 3, 4, 5],

  // Joiner defaults
  isJoinerOnboarding: false,
  joinerStep: 0,
  joinerFamilyId: null,
  joinerFamilyName: null,
  parentAInput: null,
  existingSchedulePreview: [],

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
      isJoinerOnboarding: false,
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

  // ── Joiner onboarding ────────────────────────────────────────────

  startJoinerOnboarding: async (familyId: string, familyName: string) => {
    let parentAInput: Record<string, unknown> | null = null;
    let preview: string[] = [];

    // Load Parent A's saved optimizer input
    try {
      const { data } = await onboardingApi.getSavedInput(familyId);
      parentAInput = data?.input ?? null;
    } catch {
      // No saved input — will fall back to single-parent mode
    }

    // Load existing schedule for preview
    try {
      const today = new Date();
      const end = new Date(today);
      end.setDate(today.getDate() + 21);
      const { data } = await calendarApi.getCalendar(
        familyId,
        today.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
      );
      // Build MiniCalendar-compatible assignments array
      const days = Array.isArray(data) ? data : data.days || [];
      if (days.length > 0) {
        const startDow = new Date(days[0]?.date || today).getDay();
        // Pad leading days
        const padding = Array(startDow).fill('');
        const cells = days.map((d: any) =>
          d.assignment?.assignedTo === 'parent_a' ? 'A'
            : d.assignment?.assignedTo === 'parent_b' ? 'B'
            : '',
        );
        preview = [...padding, ...cells];
        // Pad trailing to fill last week
        while (preview.length % 7 !== 0) preview.push('');
      }
    } catch {
      // No schedule yet
    }

    const turn = JOINER_TURNS[0];
    const welcomeMsg = familyName
      ? `Welcome! You've been invited to join "${familyName}".`
      : turn.message;

    set({
      messages: [botMessage(welcomeMsg, turn.card, turn.chips)],
      isOnboarding: true,
      isJoinerOnboarding: true,
      joinerStep: 0,
      joinerFamilyId: familyId,
      joinerFamilyName: familyName,
      parentAInput,
      existingSchedulePreview: preview,
      wizard: { ...DEFAULT_WIZARD },
      options: [],
      selectedDays: [],
    });
  },

  advanceJoinerOnboarding: () => {
    const { joinerStep } = get();
    const nextStep = joinerStep + 1;
    if (nextStep >= JOINER_TURNS.length) {
      set({ isOnboarding: false, isJoinerOnboarding: false });
      return;
    }
    const turn = JOINER_TURNS[nextStep];

    // Inject existing schedule preview data into the schedule_preview card
    let card = turn.card;
    if (card?.type === 'schedule_preview') {
      const preview = get().existingSchedulePreview;
      card = { ...card, data: { ...card.data, assignments: preview } };
    }

    set((s) => ({
      joinerStep: nextStep,
      messages: [...s.messages, botMessage(turn.message, card, turn.chips)],
      selectedDays: turn.card?.type === 'day_selector'
        ? (turn.card.data.selected as number[])
        : s.selectedDays,
    }));

    if (turn.autoAdvance) {
      get().handleJoinerGenerate();
    }
  },

  handleJoinerGenerate: async () => {
    set({ isGenerating: true });

    try {
      const state = get();
      const authState = useAuthStore.getState();
      const userId = authState.user?.id || '';
      let input: Record<string, unknown>;

      if (state.parentAInput) {
        // Merge Parent A's saved input with Parent B's preferences
        input = {
          ...state.parentAInput,
          parent_b: {
            parent_id: userId,
            availability: {
              locked_nights: state.wizard.lockedNights,
            },
            preferences: {
              target_share_pct: state.wizard.targetSharePct,
              max_consecutive_nights_away: state.wizard.maxConsecutiveAway,
            },
          },
          shared: {
            ...(state.parentAInput.shared as Record<string, unknown> || {}),
            start_date: nextMonday(),
          },
        };
      } else {
        // Fallback: build single-parent input
        input = buildOnboardingInput(state.wizard, userId);
      }

      const { data } = await onboardingApi.generateOptions(input);
      const options = mapOptions(data);

      set({ options, isGenerating: false });
      get().advanceJoinerOnboarding();
    } catch {
      set({ isGenerating: false });
      set((s) => ({
        messages: [
          ...s.messages,
          botMessage(
            "I had trouble generating schedule options. Let's try again or skip ahead.",
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

  // ── Standard onboarding ──────────────────────────────────────────

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
      const options = mapOptions(data);

      set({ options, isGenerating: false });

      // Fire-and-forget: save optimizer input to family for Parent B later
      const familyId = authState.family?.id;
      if (familyId) {
        onboardingApi.saveInput(familyId, input).catch(() => {});
      }

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

    if (state.isJoinerOnboarding) {
      await handleJoinerChip(value, get, set);
    } else if (state.isOnboarding) {
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
      isJoinerOnboarding: false,
      joinerStep: 0,
      joinerFamilyId: null,
      joinerFamilyName: null,
      parentAInput: null,
      existingSchedulePreview: [],
    }),
}));

// ── Joiner chip handler ─────────────────────────────────────────────

async function handleJoinerChip(
  value: string,
  get: () => ChatState,
  set: (fn: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) => void,
) {
  const state = get();
  const step = state.joinerStep;
  const turn = JOINER_TURNS[step];

  const chipLabel =
    turn.chips?.find((c) => c.value === value)?.label || value;
  set((s) => ({ messages: [...s.messages, userMessage(chipLabel)] }));

  switch (turn.actionType) {
    case 'joiner_welcome':
      get().advanceJoinerOnboarding();
      break;

    case 'joiner_review_schedule':
      get().advanceJoinerOnboarding();
      break;

    case 'set_locked_nights_b':
      if (value === 'none') {
        set((s) => ({
          wizard: { ...s.wizard, lockedNights: [] },
        }));
      } else {
        set((s) => ({
          wizard: { ...s.wizard, lockedNights: s.selectedDays },
        }));
      }
      get().advanceJoinerOnboarding();
      break;

    case 'set_target_split_b':
      set((s) => ({
        wizard: { ...s.wizard, targetSharePct: parseInt(value, 10) || 50 },
      }));
      get().advanceJoinerOnboarding();
      break;

    case 'set_max_consecutive_b':
      set((s) => ({
        wizard: { ...s.wizard, maxConsecutiveAway: parseInt(value, 10) || 5 },
      }));
      get().advanceJoinerOnboarding();
      break;

    case 'generate_joiner_options':
      // Auto-advance handles this
      break;

    case 'select_joiner_schedule':
      // Handled by ChatScreen handleSelectSchedule
      break;

    case 'joiner_complete':
      set({ isOnboarding: false, isJoinerOnboarding: false });
      break;

    default:
      get().advanceJoinerOnboarding();
      break;
  }
}

// ── Original onboarding chip handler ────────────────────────────────

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

    case 'set_living_arrangement':
      set((s) => ({
        wizard: { ...s.wizard, livingArrangement: value },
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

      // Dev shortcut: typing "other" resolves to the other test user,
      // sends the invite, and auto-accepts it in one step.
      const isOtherShortcut =
        Platform.OS === 'web' &&
        wizard.inviteEmail.trim().toLowerCase() === 'other';

      let targetEmail = wizard.inviteEmail.trim().toLowerCase();

      if (isOtherShortcut) {
        // Resolve "other" to the other test user's email
        const currentEmail = useAuthStore.getState().user?.email || '';
        const fatherEmail = (typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('storagePrefix') === 'father_')
          ? currentEmail
          : '';
        // If we're father, other = mother. If we're mother, other = father.
        const envFather = 'father@test.local';
        const envMother = 'mother@test.local';
        targetEmail = currentEmail === envFather ? envMother : envFather;
      }

      try {
        await familiesApi.invite(family.id, {
          email: targetEmail,
          role: 'parent_b',
          label: 'Parent B',
        });

        if (isOtherShortcut) {
          // Auto-accept: dev-login as the other user, find their invite, accept it
          try {
            const loginRes = await apiClient.post('/auth/dev-login', { email: targetEmail });
            const otherToken = loginRes.data.accessToken;
            // Find pending invite for the other user
            const invitesRes = await apiClient.get('/families/my-invites', {
              headers: { Authorization: `Bearer ${otherToken}` },
            });
            const invites = Array.isArray(invitesRes.data) ? invitesRes.data : [];
            const matching = invites.find((inv: any) => inv.familyId === family.id);
            if (matching) {
              await apiClient.post('/families/accept-invite-by-id',
                { membershipId: matching.membershipId },
                { headers: { Authorization: `Bearer ${otherToken}` } },
              );
            }
            set((s) => ({
              messages: [
                ...s.messages,
                botMessage(`Invited ${targetEmail} and auto-accepted! Both accounts are now linked.`),
              ],
            }));
          } catch {
            set((s) => ({
              messages: [
                ...s.messages,
                botMessage(`Invite sent to ${targetEmail}, but auto-accept failed. Accept manually in the other panel.`),
              ],
            }));
          }
        } else {
          set((s) => ({
            messages: [
              ...s.messages,
              botMessage(`Invite sent to ${targetEmail}!`),
            ],
          }));
        }
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
