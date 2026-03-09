// ── Next Step Recommender ────────────────────────────────────
// Given an LLM interpretation, recommends what the system should
// do next. The policy engine makes the final decision.
//
// Two paths:
//   1. LLM available → richer contextual recommendation
//   2. LLM unavailable → deterministic rule-based recommendation

import {
  LLMMessageInterpretation,
  NextStepRecommendation,
  NextStep,
  LLMContext,
  ClarificationNeed,
} from './schema';

const LLM_ROUTER = process.env.LLM_ROUTER_URL || 'http://localhost:3100';

/**
 * Recommend the next conversational step.
 * Tries LLM first, falls back to deterministic rules.
 */
export async function recommendNextStep(
  interpretation: LLMMessageInterpretation,
  context: LLMContext,
): Promise<NextStepRecommendation> {
  const llmResult = await callLLMRecommender(interpretation, context);
  if (llmResult) return llmResult;

  return heuristicRecommend(interpretation, context);
}

// ── LLM Call ──

async function callLLMRecommender(
  interpretation: LLMMessageInterpretation,
  context: LLMContext,
): Promise<NextStepRecommendation | null> {
  try {
    const res = await fetch(`${LLM_ROUTER}/llm/recommend-next-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interpretation, context }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.nextStep) return null;
    return {
      nextStep: data.nextStep,
      rationale: data.rationale || '',
      clarificationQuestion: data.clarificationQuestion,
      clarificationField: data.clarificationField,
      suggestedChoices: data.suggestedChoices,
      acknowledgmentText: data.acknowledgmentText,
      caseType: data.caseType,
      confidence: data.confidence || 0.5,
    };
  } catch {
    return null;
  }
}

// ── Deterministic Recommendation ──

export function heuristicRecommend(
  interpretation: LLMMessageInterpretation,
  context: LLMContext,
): NextStepRecommendation {
  const { intent } = interpretation;
  const hasActiveCase = !!context.activeCase;

  switch (intent) {
    // ── Onboarding ──
    case 'onboarding_answer': {
      const topics = interpretation.onboardingTopics || [];
      if (topics.includes('confirm')) {
        return {
          nextStep: 'complete_onboarding',
          rationale: 'Parent confirmed onboarding summary.',
          confidence: 0.9,
        };
      }
      return {
        nextStep: 'advance_onboarding',
        rationale: `Onboarding topics detected: ${topics.join(', ') || 'none'}`,
        confidence: topics.length > 0 ? 0.8 : 0.5,
      };
    }

    // ── Disruption report ──
    case 'report_disruption': {
      const needsClarification = checkDisruptionClarification(interpretation);
      if (needsClarification) {
        return {
          nextStep: 'ask_clarification',
          rationale: `Disruption reported but ${needsClarification.field} is unclear.`,
          clarificationQuestion: needsClarification.question,
          clarificationField: needsClarification.field,
          confidence: 0.7,
        };
      }
      return {
        nextStep: 'open_case',
        rationale: `Disruption reported: ${interpretation.disruptionType || 'unknown type'}.`,
        caseType: 'disruption',
        acknowledgmentText: buildDisruptionAck(interpretation),
        confidence: 0.8,
      };
    }

    // ── Coverage request ──
    case 'request_coverage':
      return {
        nextStep: hasActiveCase ? 'update_case' : 'open_case',
        rationale: 'Parent requested coverage from co-parent.',
        caseType: 'coverage_request',
        confidence: 0.75,
      };

    // ── Respond to request ──
    case 'respond_to_request':
      return {
        nextStep: 'update_case',
        rationale: 'Parent responded to an active request.',
        confidence: 0.7,
      };

    // ── Respond to proposal ──
    case 'respond_to_proposal':
      return {
        nextStep: 'update_case',
        rationale: 'Parent selected or responded to a proposal.',
        confidence: 0.8,
      };

    // ── Confirm ──
    case 'confirm_action':
      if (hasActiveCase) {
        return {
          nextStep: 'update_case',
          rationale: 'Parent confirmed an action on an active case.',
          confidence: 0.85,
        };
      }
      return {
        nextStep: 'acknowledge',
        rationale: 'Confirmation with no active case.',
        acknowledgmentText: 'Got it.',
        confidence: 0.6,
      };

    // ── Reject ──
    case 'reject_action':
      if (hasActiveCase) {
        return {
          nextStep: 'update_case',
          rationale: 'Parent rejected an action on an active case.',
          confidence: 0.85,
        };
      }
      return {
        nextStep: 'acknowledge',
        rationale: 'Rejection with no active case.',
        acknowledgmentText: 'Understood.',
        confidence: 0.5,
      };

    // ── Counter-proposal ──
    case 'counter_proposal':
      return {
        nextStep: 'generate_proposals',
        rationale: 'Parent proposed an alternative.',
        confidence: 0.7,
      };

    // ── Complaint / objection ──
    case 'complaint': {
      if (interpretation.structuredObjection === 'fairness') {
        return {
          nextStep: 'show_metrics',
          rationale: 'Fairness complaint — show current balance.',
          confidence: 0.75,
        };
      }
      return {
        nextStep: hasActiveCase ? 'update_case' : 'record_feedback_only',
        rationale: `Complaint recorded: ${interpretation.structuredObjection || 'general'}.`,
        confidence: 0.6,
      };
    }

    // ── Feedback ──
    case 'provide_feedback':
      return {
        nextStep: 'record_feedback_only',
        rationale: 'Parent provided feedback.',
        acknowledgmentText: interpretation.emotionalTone === 'frustrated'
          ? 'I understand this is frustrating. Your feedback is noted.'
          : 'Thanks for the feedback.',
        confidence: 0.6,
      };

    // ── Schedule question ──
    case 'ask_schedule_question':
      return {
        nextStep: 'show_metrics',
        rationale: 'Parent asked about schedule.',
        confidence: 0.7,
      };

    // ── Clarification answer ──
    case 'clarification_answer':
      return {
        nextStep: 'update_case',
        rationale: 'Parent answered a clarification question.',
        confidence: 0.7,
      };

    // ── Unknown ──
    default:
      if (hasActiveCase) {
        return {
          nextStep: 'update_case',
          rationale: 'Unknown intent but active case exists — treat as case response.',
          confidence: 0.4,
        };
      }
      return {
        nextStep: 'acknowledge',
        rationale: 'Could not determine intent.',
        acknowledgmentText: "I'm not sure what you'd like to do. You can report a disruption, ask about your schedule, or type 'help' for options.",
        confidence: 0.3,
      };
  }
}

// ── Clarification Checks ──

function checkDisruptionClarification(
  interpretation: LLMMessageInterpretation,
): ClarificationNeed | null {
  // If we have ambiguity flags, clarify the most important one
  if (interpretation.ambiguityFlags.length > 0) {
    return {
      field: interpretation.ambiguityFlags[0],
      question: `Could you clarify: ${interpretation.ambiguityFlags[0]}?`,
      required: true,
    };
  }

  // If disruption type is unknown, try to clarify
  if (!interpretation.disruptionType || interpretation.disruptionType === 'other') {
    if (interpretation.confidence < 0.6) {
      return {
        field: 'disruption_type',
        question: "I want to help. Can you tell me more about what's happening? For example: child is sick, work emergency, transport issue.",
        required: false,
        defaultInference: 'other',
      };
    }
  }

  return null;
}

// ── Acknowledgment Builders ──

function buildDisruptionAck(interpretation: LLMMessageInterpretation): string {
  const typeLabels: Record<string, string> = {
    child_sick: 'child illness',
    parent_sick: 'illness',
    work_emergency: 'work emergency',
    transport_failure: 'transport issue',
    school_closure: 'school closure',
    family_emergency: 'family emergency',
    other: 'schedule disruption',
  };

  const label = typeLabels[interpretation.disruptionType || 'other'] || 'disruption';

  const parts: string[] = [`Got it — recording ${label}.`];

  if (interpretation.durationEstimate) {
    const durLabels: Record<string, string> = {
      today_only: 'today only',
      '2_3_days': '2-3 days',
      week: 'about a week',
      unknown: 'duration unclear',
    };
    parts.push(`Expected duration: ${durLabels[interpretation.durationEstimate]}.`);
  }

  if (interpretation.urgency === 'high') {
    parts.push('Treating as urgent.');
  }

  return parts.join(' ');
}
