export interface ChipOption {
  label: string;
  value: string;
  icon?: string;
}

export interface ActionCard {
  type: 'schedule_option' | 'confirmation' | 'stats' | 'checklist' | 'info' | 'day_selector' | 'text_input' | 'loading';
  data: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'bot' | 'user';
  content?: string;
  card?: ActionCard;
  chips?: ChipOption[];
  timestamp: number;
}

export interface StructuredAction {
  type: string;
  params: Record<string, unknown>;
}

export interface ChatContext {
  isOnboarding: boolean;
  onboardingStep: number;
  familyId?: string;
  userId?: string;
}

export interface OnboardingTurn {
  message: string;
  chips?: ChipOption[];
  card?: ActionCard;
  actionType: string;
  autoAdvance?: boolean;
}
