// ── LLM Output Schema ────────────────────────────────────────
// Structured types for LLM interpretation and recommendation.
// The LLM returns these objects; the policy engine consumes them.
//
// The LLM decides conversational next steps, not scheduling outcomes.

// ── Message Interpretation ──

export type MessageIntent =
  | 'report_disruption'
  | 'request_coverage'
  | 'respond_to_request'
  | 'respond_to_proposal'
  | 'ask_schedule_question'
  | 'provide_feedback'
  | 'complaint'
  | 'clarification_answer'
  | 'onboarding_answer'
  | 'confirm_action'
  | 'reject_action'
  | 'counter_proposal'
  | 'general_unknown';

export type EmotionalTone = 'neutral' | 'stressed' | 'frustrated' | 'angry';
export type Urgency = 'low' | 'medium' | 'high';

export type RequestedAction =
  | 'inform_other_parent'
  | 'show_options'
  | 'show_schedule'
  | 'show_fairness'
  | 'ask_followup'
  | 'record_feedback';

export type StructuredObjectionType =
  | 'fairness'
  | 'too_many_transitions'
  | 'routine_disruption'
  | 'inconvenience'
  | 'other';

export interface LLMMessageInterpretation {
  intent: MessageIntent;
  /** If this message references an existing case */
  referencedCaseId?: string;
  /** Disruption classification */
  disruptionType?: string;
  /** Duration if mentioned */
  durationEstimate?: 'today_only' | '2_3_days' | 'week' | 'unknown';
  /** How urgent this is */
  urgency?: Urgency;
  /** Who the parent is addressing */
  targetParent?: 'parent_a' | 'parent_b' | 'system';
  /** Detected emotional tone */
  emotionalTone?: EmotionalTone;
  /** What the parent seems to want */
  requestedAction?: RequestedAction;
  /** If this is a structured objection */
  structuredObjection?: StructuredObjectionType;
  /** Onboarding topics answered in this message */
  onboardingTopics?: string[];
  /** Extracted entities (names, dates, numbers) */
  extractedEntities?: Record<string, unknown>;
  /** Flags for potential ambiguity */
  ambiguityFlags: string[];
  /** LLM confidence in this interpretation */
  confidence: number;
}

// ── Next Step Recommendation ──

export type NextStep =
  | 'acknowledge'
  | 'ask_clarification'
  | 'create_change_request'
  | 'notify_other_parent'
  | 'generate_proposals'
  | 'present_guided_response'
  | 'show_metrics'
  | 'record_feedback_only'
  | 'advance_onboarding'
  | 'complete_onboarding'
  | 'open_case'
  | 'update_case'
  | 'close_case'
  | 'no_action';

export interface NextStepRecommendation {
  nextStep: NextStep;
  /** Why the LLM recommends this step */
  rationale: string;
  /** What to ask if clarification is needed */
  clarificationQuestion?: string;
  /** Which field needs clarification */
  clarificationField?: string;
  /** Structured choices to present to the parent */
  suggestedChoices?: Array<{ id: string; label: string }>;
  /** Acknowledgment text to send */
  acknowledgmentText?: string;
  /** Case type to open if applicable */
  caseType?: string;
  /** LLM confidence */
  confidence: number;
}

// ── Clarification Policy ──

export interface ClarificationNeed {
  field: string;
  question: string;
  required: boolean;
  /** If we can infer a default when unclear */
  defaultInference?: string;
}

// ── LLM Context (what we send to the LLM) ──

export interface LLMContext {
  /** Current conversation mode */
  mode: 'onboarding' | 'operational' | 'mediation' | 'followup';
  /** Parent who sent the message */
  sender: 'parent_a' | 'parent_b';
  /** The message text */
  messageText: string;
  /** Recent event history (last 10 events, summarized) */
  recentEvents: Array<{ kind: string; origin: string; summary: string }>;
  /** Active case summary if any */
  activeCase: {
    id: string;
    type: string;
    status: string;
    pendingResponseFrom: string | null;
    summary: string;
  } | null;
  /** Family context */
  family: {
    childNames: string[];
    parentALabel: string;
    parentBLabel: string;
    template: string;
    targetSplit: number;
  };
  /** Schedule context */
  schedule: {
    exists: boolean;
    currentDay: number;
    todayAssignment?: string;
  };
  /** Onboarding progress */
  onboarding: {
    parentADone: boolean;
    parentBDone: boolean;
    answeredTopics: string[];
  };
}
