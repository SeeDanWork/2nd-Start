export interface ChipOption {
  label: string;
  value: string;
  icon?: string;
}

export interface ActionCard {
  type:
    | 'schedule_option'
    | 'schedule_preview'
    | 'confirmation'
    | 'stats'
    | 'checklist'
    | 'info'
    | 'day_selector'
    | 'text_input'
    | 'loading'
    | 'disruption_preview'
    | 'policy_preview'
    | 'multi_child_summary'
    | 'date_range_picker'
    | 'impact_preview'
    | 'visual_pattern'
    | 'disruption_checkin'
    | 'start_date_picker';
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

// ─── Scenario Flows ───────────────────────────────────────────

export interface ScenarioTurn {
  message: string;
  chips?: ChipOption[];
  card?: ActionCard;
  actionType: string;
  /** If set, skip this turn when the condition is false */
  condition?: (context: Record<string, unknown>) => boolean;
}

export interface ScenarioFlow {
  id: string;
  name: string;
  description: string;
  turns: ScenarioTurn[];
}
