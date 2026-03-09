// ── LLM Message Interpreter ──────────────────────────────────
// Interprets a parent's natural language message into a structured
// LLMMessageInterpretation object.
//
// Two paths:
//   1. LLM available → rich semantic interpretation
//   2. LLM unavailable → deterministic heuristic fallback
//
// The policy engine consumes the output regardless of source.

import {
  LLMMessageInterpretation,
  LLMContext,
  MessageIntent,
  EmotionalTone,
  StructuredObjectionType,
} from './schema';

const LLM_ROUTER = process.env.LLM_ROUTER_URL || 'http://localhost:3100';

// ── LLM Interpretation ──

/**
 * Interpret a parent's message. Tries LLM first, falls back to heuristics.
 */
export async function interpretMessage(
  context: LLMContext,
): Promise<LLMMessageInterpretation> {
  // Try LLM first
  const llmResult = await callLLMInterpreter(context);
  if (llmResult) return llmResult;

  // Fall back to deterministic heuristics
  return heuristicInterpret(context);
}

// ── LLM Call ──

async function callLLMInterpreter(
  context: LLMContext,
): Promise<LLMMessageInterpretation | null> {
  try {
    const res = await fetch(`${LLM_ROUTER}/llm/interpret-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Validate the response has required fields
    if (!data.intent || typeof data.confidence !== 'number') return null;

    return {
      intent: data.intent,
      referencedCaseId: data.referencedCaseId,
      disruptionType: data.disruptionType,
      durationEstimate: data.durationEstimate,
      urgency: data.urgency,
      targetParent: data.targetParent,
      emotionalTone: data.emotionalTone,
      requestedAction: data.requestedAction,
      structuredObjection: data.structuredObjection,
      onboardingTopics: data.onboardingTopics,
      extractedEntities: data.extractedEntities,
      ambiguityFlags: data.ambiguityFlags || [],
      confidence: data.confidence,
    };
  } catch {
    return null;
  }
}

// ── Deterministic Heuristic Fallback ──

/**
 * Interpret a message without LLM using keyword/pattern matching.
 * This preserves full functionality when LLM is unavailable.
 */
export function heuristicInterpret(
  context: LLMContext,
): LLMMessageInterpretation {
  const text = context.messageText.toLowerCase().trim();
  const mode = context.mode;

  // Default interpretation
  const result: LLMMessageInterpretation = {
    intent: 'general_unknown',
    ambiguityFlags: [],
    confidence: 0.5,
  };

  // ── Onboarding mode ──
  if (mode === 'onboarding') {
    result.intent = 'onboarding_answer';
    result.onboardingTopics = detectOnboardingTopics(text, context);
    result.confidence = result.onboardingTopics.length > 0 ? 0.8 : 0.4;
    return result;
  }

  // ── Confirm/reject patterns ──
  if (/^(yes|yeah|yep|ok|okay|sure|looks? good|that's right|correct|confirm|accept|approve)/i.test(text)) {
    result.intent = context.activeCase ? 'confirm_action' : 'confirm_action';
    result.confidence = 0.85;
    return result;
  }
  if (/^(no|nope|decline|reject|refuse|not acceptable|disagree)/i.test(text)) {
    result.intent = 'reject_action';
    result.confidence = 0.85;
    return result;
  }

  // ── Disruption reporting ──
  if (detectDisruption(text)) {
    result.intent = 'report_disruption';
    result.disruptionType = classifyDisruptionFromText(text);
    result.urgency = detectUrgency(text);
    result.durationEstimate = detectDuration(text);
    result.confidence = 0.75;
    return result;
  }

  // ── Coverage request ──
  if (/cover|take (over|them|the kids)|pick ?up|help (me )?(out|with)|can you/i.test(text)) {
    result.intent = 'request_coverage';
    result.urgency = detectUrgency(text);
    result.confidence = 0.7;
    return result;
  }

  // ── Proposal response ──
  if (context.activeCase?.status === 'awaiting_selection') {
    if (/option ?\d|select|choose|pick|first|second|third/i.test(text)) {
      result.intent = 'respond_to_proposal';
      result.confidence = 0.8;
      return result;
    }
    if (/counter|alternative|instead|how about|what if/i.test(text)) {
      result.intent = 'counter_proposal';
      result.confidence = 0.7;
      return result;
    }
  }

  // ── Fairness complaint / objection ──
  if (/fair|unfair|equal|balance|more time|less time|always|never get/i.test(text)) {
    result.intent = 'complaint';
    result.structuredObjection = classifyObjection(text);
    result.emotionalTone = detectTone(text);
    result.confidence = 0.7;
    return result;
  }

  // ── Feedback ──
  if (/thanks?|great|good|love|hate|frustrat|annoy|happy|unhappy/i.test(text)) {
    result.intent = 'provide_feedback';
    result.emotionalTone = detectTone(text);
    result.confidence = 0.6;
    return result;
  }

  // ── Schedule question ──
  if (/schedule|when|what day|who has|whose turn|next exchange|calendar/i.test(text)) {
    result.intent = 'ask_schedule_question';
    result.requestedAction = 'show_schedule';
    result.confidence = 0.7;
    return result;
  }

  // ── Respond to request (if there's an active case waiting) ──
  if (context.activeCase?.pendingResponseFrom === context.sender) {
    result.intent = 'respond_to_request';
    result.referencedCaseId = context.activeCase.id;
    result.confidence = 0.6;
    return result;
  }

  // ── Clarification answer ──
  if (mode === 'mediation' && context.activeCase?.status === 'awaiting_clarification') {
    result.intent = 'clarification_answer';
    result.referencedCaseId = context.activeCase.id;
    result.confidence = 0.6;
    return result;
  }

  return result;
}

// ── Detection Helpers ──

function detectDisruption(text: string): boolean {
  return /sick|ill|emergency|can'?t (make|do|handle|pick)|injured|hospital|fever|threw up|vomit|accident|broken|urgent|cancel/i.test(text);
}

function classifyDisruptionFromText(text: string): string {
  if (/child.*sick|kid.*sick|son.*sick|daughter.*sick|child.*ill|kid.*ill|fever|threw up|vomit/i.test(text)) return 'child_sick';
  if (/i'?m sick|i'?m ill|i feel|my health|i can'?t.*sick/i.test(text)) return 'parent_sick';
  if (/work|meeting|boss|office|overtime|shift|called in/i.test(text)) return 'work_emergency';
  if (/car|transport|flat tire|broke down|traffic|stuck/i.test(text)) return 'transport_failure';
  if (/school.*closed|school.*cancel|snow day|no school/i.test(text)) return 'school_closure';
  if (/family.*emergency|hospital|accident|death|funeral/i.test(text)) return 'family_emergency';
  return 'other';
}

function detectUrgency(text: string): 'low' | 'medium' | 'high' {
  if (/emergency|urgent|immediately|right now|asap|hospital|accident/i.test(text)) return 'high';
  if (/today|tonight|soon|this afternoon|this morning/i.test(text)) return 'medium';
  return 'low';
}

function detectDuration(text: string): 'today_only' | '2_3_days' | 'week' | 'unknown' | undefined {
  if (/today only|just today|only today|this afternoon|tonight/i.test(text)) return 'today_only';
  if (/couple.?days|few days|2.?3 days|next few/i.test(text)) return '2_3_days';
  if (/week|all week|rest of.*week|several days/i.test(text)) return 'week';
  if (/not sure|don'?t know|unclear|hard to say/i.test(text)) return 'unknown';
  return undefined;
}

function detectTone(text: string): EmotionalTone {
  if (/angry|furious|pissed|unacceptable|ridiculous|outrag/i.test(text)) return 'angry';
  if (/frustrat|annoyed|upset|disappointed|tired of|sick of/i.test(text)) return 'frustrated';
  if (/worried|stressed|anxious|overwhelm|panick/i.test(text)) return 'stressed';
  return 'neutral';
}

function classifyObjection(text: string): StructuredObjectionType {
  if (/fair|unfair|equal|balance|more time|less time/i.test(text)) return 'fairness';
  if (/transition|switch|back and forth|too many/i.test(text)) return 'too_many_transitions';
  if (/routine|disrupt|stability|consistent|bedtime|school night/i.test(text)) return 'routine_disruption';
  if (/inconvenien|difficult|hard|logistic|far|drive/i.test(text)) return 'inconvenience';
  return 'other';
}

function detectOnboardingTopics(text: string, context: LLMContext): string[] {
  const topics: string[] = [];

  // Children info
  if (/\d+ (child|kid)|child|son|daughter|baby|toddler|teen/i.test(text) && /\d/.test(text)) {
    topics.push('children_count');
    if (/age|year|month|old/i.test(text) || /\d+/.test(text)) {
      topics.push('children_ages');
    }
  }

  // Arrangement
  if (/alternating|week on.*week off|2-2-3|3-4-4-3|5-2|every other|custody.*arrange|split/i.test(text)) {
    topics.push('arrangement');
  }

  // Split
  if (/50.?50|60.?40|70.?30|equal|half|percent/i.test(text)) {
    topics.push('split');
  }

  // Distance
  if (/mile|km|minute|hour|drive|far|close|near|across town|next door/i.test(text)) {
    topics.push('distance');
  }

  // Phone
  if (/\+?\d{10,}|\(\d{3}\)|\d{3}[-.]\d{3}[-.]\d{4}/i.test(text)) {
    topics.push('phone');
  }

  // Locked nights
  if (/always|never|school night|weekday|must be|stay with/i.test(text)) {
    topics.push('locked_days');
  }

  // Exchange
  if (/drop.?off|pick.?up|handoff|exchange|transition|school/i.test(text)) {
    topics.push('exchange');
  }

  // Frustrations
  if (/frustrat|problem|issue|hard|difficult|late|cancel|unfair|annoying/i.test(text)) {
    topics.push('frustrations');
  }

  // Confirm
  if (/yes|looks? good|correct|right|confirm|approve/i.test(text)) {
    topics.push('confirm');
  }

  return topics;
}
