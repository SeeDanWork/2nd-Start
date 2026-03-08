// ── Conversation Policy Engine ───────────────────────────────
// The decision layer between LLM interpretation and action.
//
// Flow:
//   Parent message → interpret → recommend → policy decides → emit events
//
// The policy engine:
//   1. Builds LLM context from session state
//   2. Interprets the message (LLM or heuristic)
//   3. Gets a next-step recommendation
//   4. Applies guardrails and overrides
//   5. Executes the action by emitting events
//
// The policy engine NEVER touches schedule data directly.
// Scheduling remains fully deterministic.

import { ConversationSession, emitEvent, openCase, getActiveCase, completeOnboarding, enterMediation } from './session';
import { interpretMessage, heuristicInterpret } from '../llm/interpret-message';
import { recommendNextStep, heuristicRecommend } from '../llm/next-step-recommender';
import { LLMContext, LLMMessageInterpretation, NextStepRecommendation } from '../llm/schema';
import { MediationCase } from './case-manager';

// ── Policy Result ──

export interface PolicyResult {
  /** The interpreted message */
  interpretation: LLMMessageInterpretation;
  /** The recommended next step */
  recommendation: NextStepRecommendation;
  /** Events emitted during execution */
  eventsEmitted: string[];
  /** Whether the session mode changed */
  modeChanged: boolean;
  /** Previous mode (if changed) */
  previousMode?: string;
}

// ── Build LLM Context ──

export function buildLLMContext(
  session: ConversationSession,
  sender: 'parent_a' | 'parent_b',
  messageText: string,
): LLMContext {
  const activeCase = getActiveCase(session);
  const recentEvents = session.events.last(10);

  return {
    mode: session.mode,
    sender,
    messageText,
    recentEvents: recentEvents.map(e => ({
      kind: e.kind,
      origin: e.origin,
      summary: summarizeEvent(e),
    })),
    activeCase: activeCase ? {
      id: activeCase.id,
      type: activeCase.type,
      status: activeCase.status,
      pendingResponseFrom: activeCase.pendingResponseFrom,
      summary: activeCase.summary,
    } : null,
    family: {
      childNames: session.config.children.map(c => c.name),
      parentALabel: session.config.parentA.label,
      parentBLabel: session.config.parentB.label,
      template: session.config.template,
      targetSplit: session.config.targetSplit,
    },
    schedule: {
      exists: session.schedule.length > 0,
      currentDay: session.currentDay,
      todayAssignment: session.schedule[session.currentDay]?.assignedTo,
    },
    onboarding: {
      parentADone: session.onboarding.parentA.completed,
      parentBDone: session.onboarding.parentB.completed,
      answeredTopics: [
        ...session.onboarding.parentA.answeredTopics,
        ...session.onboarding.parentB.answeredTopics,
      ],
    },
  };
}

function summarizeEvent(event: { kind: string; payload?: unknown }): string {
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!payload) return event.kind;

  if (payload.text && typeof payload.text === 'string') {
    return payload.text.slice(0, 80);
  }
  if (payload.summary && typeof payload.summary === 'string') {
    return payload.summary.slice(0, 80);
  }
  return event.kind;
}

// ── Process Message ──

/**
 * Process a parent's message through the full policy pipeline.
 * This is the main entry point for the conversation engine.
 */
export async function processMessage(
  session: ConversationSession,
  sender: 'parent_a' | 'parent_b',
  messageText: string,
): Promise<PolicyResult> {
  const eventsEmitted: string[] = [];
  const previousMode = session.mode;

  // 1. Record the parent message
  const msgEvent = emitEvent(session, 'ParentMessageReceived', sender, {
    text: messageText,
    phone: sender === 'parent_a' ? session.config.parentA.phone : session.config.parentB.phone,
  });
  eventsEmitted.push(msgEvent.id);

  // 2. Build context and interpret
  const context = buildLLMContext(session, sender, messageText);
  const interpretation = await interpretMessage(context);

  // 3. Record the interpretation as an event
  const intentEvent = emitEvent(session, 'ParentIntentParsed', sender, {
    intent: interpretation.intent,
    confidence: interpretation.confidence,
    disruptionType: interpretation.disruptionType,
    durationEstimate: interpretation.durationEstimate,
    urgency: interpretation.urgency,
    emotionalTone: interpretation.emotionalTone,
    requestedAction: interpretation.requestedAction,
    structuredObjection: interpretation.structuredObjection,
    ambiguityFlags: interpretation.ambiguityFlags,
  });
  eventsEmitted.push(intentEvent.id);

  // 4. Get next-step recommendation
  const recommendation = await recommendNextStep(interpretation, context);

  // 5. Execute the recommended action
  const actionEvents = executeAction(session, sender, interpretation, recommendation);
  eventsEmitted.push(...actionEvents);

  return {
    interpretation,
    recommendation,
    eventsEmitted,
    modeChanged: session.mode !== previousMode,
    previousMode: session.mode !== previousMode ? previousMode : undefined,
  };
}

/**
 * Synchronous version using heuristics only (no LLM calls).
 * Useful for testing and deterministic simulation.
 */
export function processMessageSync(
  session: ConversationSession,
  sender: 'parent_a' | 'parent_b',
  messageText: string,
): PolicyResult {
  const eventsEmitted: string[] = [];
  const previousMode = session.mode;

  // 1. Record the parent message
  const msgEvent = emitEvent(session, 'ParentMessageReceived', sender, {
    text: messageText,
    phone: sender === 'parent_a' ? session.config.parentA.phone : session.config.parentB.phone,
  });
  eventsEmitted.push(msgEvent.id);

  // 2. Build context and interpret (heuristic only)
  const context = buildLLMContext(session, sender, messageText);
  const interpretation = heuristicInterpret(context);

  // 3. Record the interpretation
  const intentEvent = emitEvent(session, 'ParentIntentParsed', sender, {
    intent: interpretation.intent,
    confidence: interpretation.confidence,
    disruptionType: interpretation.disruptionType,
    durationEstimate: interpretation.durationEstimate,
    urgency: interpretation.urgency,
    emotionalTone: interpretation.emotionalTone,
    requestedAction: interpretation.requestedAction,
    structuredObjection: interpretation.structuredObjection,
    ambiguityFlags: interpretation.ambiguityFlags,
  });
  eventsEmitted.push(intentEvent.id);

  // 4. Get recommendation (heuristic only)
  const recommendation = heuristicRecommend(interpretation, context);

  // 5. Execute
  const actionEvents = executeAction(session, sender, interpretation, recommendation);
  eventsEmitted.push(...actionEvents);

  return {
    interpretation,
    recommendation,
    eventsEmitted,
    modeChanged: session.mode !== previousMode,
    previousMode: session.mode !== previousMode ? previousMode : undefined,
  };
}

// ── Action Execution ──

function executeAction(
  session: ConversationSession,
  sender: 'parent_a' | 'parent_b',
  interpretation: LLMMessageInterpretation,
  recommendation: NextStepRecommendation,
): string[] {
  const emitted: string[] = [];

  switch (recommendation.nextStep) {
    case 'acknowledge': {
      const e = emitEvent(session, 'SystemAcknowledgment', 'system', {
        text: recommendation.acknowledgmentText || 'Got it.',
        targetParent: sender,
      });
      emitted.push(e.id);
      break;
    }

    case 'ask_clarification': {
      const activeCase = getActiveCase(session);
      const e = emitEvent(session, 'ClarificationRequested', 'system', {
        question: recommendation.clarificationQuestion || 'Could you tell me more?',
        targetParent: sender,
        field: recommendation.clarificationField || 'unknown',
      }, activeCase?.id);
      emitted.push(e.id);

      if (activeCase) {
        session.cases.transitionStatus(activeCase.id, 'awaiting_clarification', 'Clarification needed');
      }
      break;
    }

    case 'open_case': {
      const caseType = mapCaseType(recommendation.caseType);
      const summary = buildCaseSummary(interpretation, session);
      const mc = openCase(session, caseType, sender, summary, {
        disruptionType: interpretation.disruptionType,
        durationEstimate: interpretation.durationEstimate,
        urgency: interpretation.urgency,
      });
      emitted.push(...session.events.byCase(mc.id).map(e => e.id));

      // Send acknowledgment to reporter
      if (recommendation.acknowledgmentText) {
        const ackEvent = emitEvent(session, 'SystemAcknowledgment', 'system', {
          text: recommendation.acknowledgmentText,
          targetParent: sender,
        }, mc.id);
        emitted.push(ackEvent.id);
      }

      // Enter mediation mode
      if (session.mode !== 'mediation') {
        enterMediation(session);
      }

      // Notify other parent for coverage/disruption
      if (caseType === 'disruption' || caseType === 'coverage_request') {
        const otherParent = sender === 'parent_a' ? 'parent_b' : 'parent_a';
        const senderLabel = sender === 'parent_a'
          ? session.config.parentA.label
          : session.config.parentB.label;
        const coverageEvent = emitEvent(session, 'CoverageRequestSent', 'system', {
          targetParent: otherParent,
          summary: `${senderLabel} reported: ${summary}. Can you help with coverage?`,
        }, mc.id);
        emitted.push(coverageEvent.id);
        session.cases.setPendingResponse(mc.id, otherParent);
      }
      break;
    }

    case 'update_case': {
      const activeCase = getActiveCase(session);
      if (!activeCase) break;

      // Handle confirmation/rejection on active cases
      if (interpretation.intent === 'confirm_action') {
        session.cases.transitionStatus(activeCase.id, 'resolution_pending', 'Confirmed by parent');
        const e = emitEvent(session, 'SystemAcknowledgment', 'system', {
          text: 'Confirmed. Processing the update.',
          targetParent: sender,
        }, activeCase.id);
        emitted.push(e.id);
      } else if (interpretation.intent === 'reject_action') {
        session.cases.transitionStatus(activeCase.id, 'proposals_pending', 'Rejected by parent');
        const e = emitEvent(session, 'SystemAcknowledgment', 'system', {
          text: 'Understood. Let me suggest some alternatives.',
          targetParent: sender,
        }, activeCase.id);
        emitted.push(e.id);
      } else if (interpretation.intent === 'respond_to_proposal') {
        session.cases.transitionStatus(activeCase.id, 'resolution_pending', 'Proposal selected');
        const e = emitEvent(session, 'SystemAcknowledgment', 'system', {
          text: 'Selection received. Processing.',
          targetParent: sender,
        }, activeCase.id);
        emitted.push(e.id);
      } else if (interpretation.intent === 'clarification_answer') {
        // Move back to open from awaiting_clarification
        if (activeCase.status === 'awaiting_clarification') {
          session.cases.transitionStatus(activeCase.id, 'open', 'Clarification received');
        }
        const e = emitEvent(session, 'SystemAcknowledgment', 'system', {
          text: 'Thanks for clarifying.',
          targetParent: sender,
        }, activeCase.id);
        emitted.push(e.id);
      } else {
        // Generic case update
        const e = emitEvent(session, 'SystemAcknowledgment', 'system', {
          text: 'Noted.',
          targetParent: sender,
        }, activeCase.id);
        emitted.push(e.id);
      }
      break;
    }

    case 'generate_proposals': {
      const activeCase = getActiveCase(session);
      if (activeCase) {
        session.cases.transitionStatus(activeCase.id, 'proposals_pending', 'Generating proposals');
      }
      const e = emitEvent(session, 'SystemAcknowledgment', 'system', {
        text: 'Let me put together some options for you.',
        targetParent: sender,
      }, activeCase?.id);
      emitted.push(e.id);
      break;
    }

    case 'show_metrics': {
      const e = emitEvent(session, 'SystemAcknowledgment', 'system', {
        text: 'Here are the current schedule metrics.',
        targetParent: sender,
      });
      emitted.push(e.id);
      break;
    }

    case 'record_feedback_only': {
      const feedbackType = interpretation.emotionalTone === 'frustrated' || interpretation.emotionalTone === 'angry'
        ? 'negative' as const
        : 'neutral' as const;
      const e = emitEvent(session, 'FeedbackRecorded', sender, {
        feedbackType,
        text: recommendation.acknowledgmentText || 'Feedback noted.',
        from: sender,
      });
      emitted.push(e.id);

      if (recommendation.acknowledgmentText) {
        const ackEvent = emitEvent(session, 'SystemAcknowledgment', 'system', {
          text: recommendation.acknowledgmentText,
          targetParent: sender,
        });
        emitted.push(ackEvent.id);
      }
      break;
    }

    case 'advance_onboarding': {
      const onboardingState = sender === 'parent_a'
        ? session.onboarding.parentA
        : session.onboarding.parentB;

      // Mark as started
      onboardingState.started = true;

      // Record answered topics
      const topics = interpretation.onboardingTopics || [];
      for (const topic of topics) {
        onboardingState.answeredTopics.add(topic);
      }

      const e = emitEvent(session, 'OnboardingStepCompleted', sender, {
        step: `topics_${topics.length}`,
        topicsAnswered: topics,
        parent: sender,
      });
      emitted.push(e.id);
      break;
    }

    case 'complete_onboarding': {
      completeOnboarding(session, sender);
      // The emitted OnboardingComplete event is handled inside completeOnboarding
      break;
    }

    case 'no_action':
      break;

    default:
      // For unhandled steps, emit a generic acknowledgment
      if (recommendation.acknowledgmentText) {
        const e = emitEvent(session, 'SystemAcknowledgment', 'system', {
          text: recommendation.acknowledgmentText,
          targetParent: sender,
        });
        emitted.push(e.id);
      }
      break;
  }

  return emitted;
}

// ── Helpers ──

function mapCaseType(caseType?: string): MediationCase['type'] {
  switch (caseType) {
    case 'disruption': return 'disruption';
    case 'coverage_request': return 'coverage_request';
    case 'schedule_change_request': return 'schedule_change_request';
    case 'fairness_review': return 'fairness_review';
    case 'logistics_issue': return 'logistics_issue';
    case 'feedback_thread': return 'feedback_thread';
    default: return 'disruption';
  }
}

function buildCaseSummary(
  interpretation: LLMMessageInterpretation,
  session: ConversationSession,
): string {
  if (interpretation.disruptionType) {
    const labels: Record<string, string> = {
      child_sick: 'Child is sick',
      parent_sick: 'Parent is sick',
      work_emergency: 'Work emergency',
      transport_failure: 'Transport issue',
      school_closure: 'School closure',
      family_emergency: 'Family emergency',
      other: 'Schedule disruption',
    };
    return labels[interpretation.disruptionType] || 'Schedule disruption';
  }
  return 'New case opened';
}
