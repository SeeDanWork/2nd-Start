// ── Conversation Event Types ─────────────────────────────────
// Typed events that represent every meaningful interaction in a
// family conversation session. Both parent views derive from
// the same event stream.
//
// Events are append-only. Nothing mutates an emitted event.

// ── Event Kind Enum ──

export type ConversationEventKind =
  // Parent actions
  | 'ParentMessageReceived'
  | 'ParentIntentParsed'
  // System / LLM actions
  | 'ClarificationRequested'
  | 'ClarificationAnswered'
  | 'SystemAcknowledgment'
  | 'SystemQuestion'
  // Coverage / disruption flow
  | 'CoverageRequestCreated'
  | 'CoverageRequestSent'
  | 'DurationEstimateProvided'
  // Proposal flow
  | 'ProposalBundleGenerated'
  | 'ProposalBundleDelivered'
  | 'ProposalOptionSelected'
  | 'ProposalDeclined'
  // Objection / feedback
  | 'StructuredObjectionRecorded'
  | 'FeedbackRecorded'
  // Resolution
  | 'ResolutionApplied'
  | 'ScheduleUpdated'
  | 'FollowupScheduled'
  | 'FollowupCompleted'
  // Case lifecycle
  | 'CaseOpened'
  | 'CaseClosed'
  // Onboarding
  | 'OnboardingStepCompleted'
  | 'OnboardingComplete'
  // Operational / system
  | 'DaySummaryGenerated'
  | 'FairnessAlertTriggered'
  | 'WeeklyOverviewGenerated';

// ── Base Event ──

export interface ConversationEventBase {
  id: string;
  kind: ConversationEventKind;
  timestamp: string;
  /** Which parent initiated this event, or 'system' */
  origin: 'parent_a' | 'parent_b' | 'system';
  /** Optional case this event belongs to */
  caseId?: string;
  /** Session this event belongs to */
  sessionId: string;
}

// ── Parent Message Events ──

export interface ParentMessageReceivedEvent extends ConversationEventBase {
  kind: 'ParentMessageReceived';
  payload: {
    text: string;
    phone: string;
  };
}

export interface ParentIntentParsedEvent extends ConversationEventBase {
  kind: 'ParentIntentParsed';
  payload: {
    intent: string;
    confidence: number;
    disruptionType?: string;
    durationEstimate?: string;
    urgency?: 'low' | 'medium' | 'high';
    emotionalTone?: 'neutral' | 'stressed' | 'frustrated' | 'angry';
    requestedAction?: string;
    structuredObjection?: string;
    ambiguityFlags: string[];
    /** Raw LLM output or null if fallback */
    llmRaw?: Record<string, unknown> | null;
  };
}

// ── System Response Events ──

export interface ClarificationRequestedEvent extends ConversationEventBase {
  kind: 'ClarificationRequested';
  payload: {
    question: string;
    targetParent: 'parent_a' | 'parent_b';
    field: string;
  };
}

export interface ClarificationAnsweredEvent extends ConversationEventBase {
  kind: 'ClarificationAnswered';
  payload: {
    field: string;
    answer: string;
  };
}

export interface SystemAcknowledgmentEvent extends ConversationEventBase {
  kind: 'SystemAcknowledgment';
  payload: {
    text: string;
    targetParent: 'parent_a' | 'parent_b';
  };
}

export interface SystemQuestionEvent extends ConversationEventBase {
  kind: 'SystemQuestion';
  payload: {
    text: string;
    targetParent: 'parent_a' | 'parent_b';
    /** Structured choices, if any */
    choices?: Array<{ id: string; label: string }>;
  };
}

// ── Coverage / Disruption Events ──

export interface CoverageRequestCreatedEvent extends ConversationEventBase {
  kind: 'CoverageRequestCreated';
  payload: {
    reporter: 'parent_a' | 'parent_b';
    eventType: string;
    duration: string | null;
    description: string;
  };
}

export interface CoverageRequestSentEvent extends ConversationEventBase {
  kind: 'CoverageRequestSent';
  payload: {
    targetParent: 'parent_a' | 'parent_b';
    summary: string;
  };
}

export interface DurationEstimateProvidedEvent extends ConversationEventBase {
  kind: 'DurationEstimateProvided';
  payload: {
    duration: 'today_only' | '2_3_days' | 'week' | 'unknown';
    source: 'parent_stated' | 'system_inferred';
  };
}

// ── Proposal Events ──

export interface ProposalBundleGeneratedEvent extends ConversationEventBase {
  kind: 'ProposalBundleGenerated';
  payload: {
    bundleId: string;
    optionCount: number;
    options: Array<{
      id: string;
      label: string;
      description: string;
      fairnessImpact: { parentADelta: number; parentBDelta: number };
    }>;
  };
}

export interface ProposalBundleDeliveredEvent extends ConversationEventBase {
  kind: 'ProposalBundleDelivered';
  payload: {
    bundleId: string;
    targetParent: 'parent_a' | 'parent_b';
  };
}

export interface ProposalOptionSelectedEvent extends ConversationEventBase {
  kind: 'ProposalOptionSelected';
  payload: {
    bundleId: string;
    optionId: string;
    optionLabel: string;
    selectedBy: 'parent_a' | 'parent_b';
  };
}

export interface ProposalDeclinedEvent extends ConversationEventBase {
  kind: 'ProposalDeclined';
  payload: {
    bundleId: string;
    declinedBy: 'parent_a' | 'parent_b';
    reason?: string;
  };
}

// ── Objection / Feedback Events ──

export interface StructuredObjectionRecordedEvent extends ConversationEventBase {
  kind: 'StructuredObjectionRecorded';
  payload: {
    objectionType: 'fairness' | 'too_many_transitions' | 'routine_disruption' | 'inconvenience' | 'other';
    description: string;
    from: 'parent_a' | 'parent_b';
  };
}

export interface FeedbackRecordedEvent extends ConversationEventBase {
  kind: 'FeedbackRecorded';
  payload: {
    feedbackType: 'positive' | 'negative' | 'neutral' | 'suggestion';
    text: string;
    from: 'parent_a' | 'parent_b';
    mappedTo?: string;
  };
}

// ── Resolution Events ──

export interface ResolutionAppliedEvent extends ConversationEventBase {
  kind: 'ResolutionApplied';
  payload: {
    resolutionType: 'proposal_accepted' | 'proposal_declined' | 'auto_resolved' | 'case_closed';
    summary: string;
    fairnessSnapshot?: {
      parentANights: number;
      parentBNights: number;
      transitionsPerWeek: number;
      stabilityScore: string;
    };
  };
}

export interface ScheduleUpdatedEvent extends ConversationEventBase {
  kind: 'ScheduleUpdated';
  payload: {
    reason: string;
    daysAffected: number;
  };
}

export interface FollowupScheduledEvent extends ConversationEventBase {
  kind: 'FollowupScheduled';
  payload: {
    scheduledFor: string;
    targetParent: 'parent_a' | 'parent_b';
    question: string;
  };
}

export interface FollowupCompletedEvent extends ConversationEventBase {
  kind: 'FollowupCompleted';
  payload: {
    outcome: 'resume_normal' | 'extend_coverage' | 'escalate';
  };
}

// ── Case Lifecycle Events ──

export interface CaseOpenedEvent extends ConversationEventBase {
  kind: 'CaseOpened';
  payload: {
    caseType: string;
    initiator: 'parent_a' | 'parent_b' | 'system';
    summary: string;
  };
}

export interface CaseClosedEvent extends ConversationEventBase {
  kind: 'CaseClosed';
  payload: {
    resolution: string;
  };
}

// ── Onboarding Events ──

export interface OnboardingStepCompletedEvent extends ConversationEventBase {
  kind: 'OnboardingStepCompleted';
  payload: {
    step: string;
    topicsAnswered: string[];
    parent: 'parent_a' | 'parent_b';
  };
}

export interface OnboardingCompleteEvent extends ConversationEventBase {
  kind: 'OnboardingComplete';
  payload: {
    parent: 'parent_a' | 'parent_b';
    scheduleGenerated: boolean;
  };
}

// ── Operational Events ──

export interface DaySummaryGeneratedEvent extends ConversationEventBase {
  kind: 'DaySummaryGenerated';
  payload: {
    day: number;
    date: string;
    assignedTo: 'parent_a' | 'parent_b';
    isTransition: boolean;
    textForA: string;
    textForB: string;
  };
}

export interface FairnessAlertTriggeredEvent extends ConversationEventBase {
  kind: 'FairnessAlertTriggered';
  payload: {
    parentANights: number;
    parentBNights: number;
    drift: number;
    text: string;
  };
}

export interface WeeklyOverviewGeneratedEvent extends ConversationEventBase {
  kind: 'WeeklyOverviewGenerated';
  payload: {
    week: number;
    text: string;
  };
}

// ── Union Type ──

export type ConversationEvent =
  | ParentMessageReceivedEvent
  | ParentIntentParsedEvent
  | ClarificationRequestedEvent
  | ClarificationAnsweredEvent
  | SystemAcknowledgmentEvent
  | SystemQuestionEvent
  | CoverageRequestCreatedEvent
  | CoverageRequestSentEvent
  | DurationEstimateProvidedEvent
  | ProposalBundleGeneratedEvent
  | ProposalBundleDeliveredEvent
  | ProposalOptionSelectedEvent
  | ProposalDeclinedEvent
  | StructuredObjectionRecordedEvent
  | FeedbackRecordedEvent
  | ResolutionAppliedEvent
  | ScheduleUpdatedEvent
  | FollowupScheduledEvent
  | FollowupCompletedEvent
  | CaseOpenedEvent
  | CaseClosedEvent
  | OnboardingStepCompletedEvent
  | OnboardingCompleteEvent
  | DaySummaryGeneratedEvent
  | FairnessAlertTriggeredEvent
  | WeeklyOverviewGeneratedEvent;

// ── Visibility ──

/** Which parents should see a rendered version of this event */
export type EventVisibility = {
  parentA: boolean;
  parentB: boolean;
};

/** Determine default visibility for an event */
export function getEventVisibility(event: ConversationEvent): EventVisibility {
  switch (event.kind) {
    // Both parents see resolution and schedule events
    case 'ResolutionApplied':
    case 'ScheduleUpdated':
    case 'CaseClosed':
    case 'FairnessAlertTriggered':
    case 'WeeklyOverviewGenerated':
      return { parentA: true, parentB: true };

    // Day summaries are always visible but rendered differently
    case 'DaySummaryGenerated':
      return { parentA: true, parentB: true };

    // Events targeting a specific parent
    case 'ClarificationRequested':
    case 'SystemAcknowledgment':
    case 'SystemQuestion':
      return {
        parentA: (event as any).payload.targetParent === 'parent_a',
        parentB: (event as any).payload.targetParent === 'parent_b',
      };

    case 'CoverageRequestSent':
    case 'ProposalBundleDelivered':
      return {
        parentA: (event as any).payload.targetParent === 'parent_a',
        parentB: (event as any).payload.targetParent === 'parent_b',
      };

    case 'FollowupScheduled':
      return {
        parentA: (event as any).payload.targetParent === 'parent_a',
        parentB: (event as any).payload.targetParent === 'parent_b',
      };

    // Parent messages visible to that parent
    case 'ParentMessageReceived':
      return {
        parentA: event.origin === 'parent_a',
        parentB: event.origin === 'parent_b',
      };

    // Intent parsing is internal — not directly visible
    case 'ParentIntentParsed':
      return { parentA: false, parentB: false };

    // Coverage request created → reporter sees confirmation
    case 'CoverageRequestCreated':
      return {
        parentA: (event as CoverageRequestCreatedEvent).payload.reporter === 'parent_a',
        parentB: (event as CoverageRequestCreatedEvent).payload.reporter === 'parent_b',
      };

    // Proposal events → both see (different rendering)
    case 'ProposalBundleGenerated':
      return { parentA: true, parentB: true };
    case 'ProposalOptionSelected':
      return { parentA: true, parentB: true };
    case 'ProposalDeclined':
      return { parentA: true, parentB: true };

    // Objection/feedback → visible to the recording parent
    case 'StructuredObjectionRecorded':
    case 'FeedbackRecorded':
      return {
        parentA: event.origin === 'parent_a',
        parentB: event.origin === 'parent_b',
      };

    // Onboarding → visible to onboarding parent
    case 'OnboardingStepCompleted':
      return {
        parentA: (event as OnboardingStepCompletedEvent).payload.parent === 'parent_a',
        parentB: (event as OnboardingStepCompletedEvent).payload.parent === 'parent_b',
      };

    // Onboarding complete → both see
    case 'OnboardingComplete':
      return { parentA: true, parentB: true };

    // Case opened → both see
    case 'CaseOpened':
      return { parentA: true, parentB: true };

    // Duration estimate → reporter sees
    case 'DurationEstimateProvided':
      return {
        parentA: event.origin === 'parent_a',
        parentB: event.origin === 'parent_b',
      };

    // Clarification answered → that parent sees
    case 'ClarificationAnswered':
      return {
        parentA: event.origin === 'parent_a',
        parentB: event.origin === 'parent_b',
      };

    // Followup completed → both see
    case 'FollowupCompleted':
      return { parentA: true, parentB: true };

    default:
      return { parentA: false, parentB: false };
  }
}
