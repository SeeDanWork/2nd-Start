// ── Conversation State ───────────────────────────────────────
// Tracks conversation phase and answered topics for each parent.
// Pure functions — no side effects, no LLM calls.

import { Scenario, Message } from '../types';
import { classifyAllTopics, classifySystemMessage } from '../behavior-engine';

export type ConversationPhase =
  | 'not_started'
  | 'onboarding'
  | 'onboarding_complete'
  | 'simulating'
  | 'disruption_active'
  | 'completed';

export interface ConversationState {
  phase: ConversationPhase;
  answeredTopics: Set<string>;
  isParentA: boolean;
  messages: Message[];
}

/** Determine conversation phase from scenario state. */
export function getConversationPhase(scenario: Scenario): ConversationPhase {
  if (scenario.status === 'completed') return 'completed';
  if (scenario.activeDisruptions.some(d => d.state !== 'RESOLVED')) return 'disruption_active';
  if (scenario.schedule.length > 0 && scenario.currentDay > 0) return 'simulating';
  if (scenario.schedule.length > 0) return 'onboarding_complete';
  if (scenario.messagesA.length > 0 || scenario.messagesB.length > 0) return 'onboarding';
  return 'not_started';
}

/** Build the set of topics already answered from message history. */
export function buildAnsweredTopics(messages: Message[]): Set<string> {
  const answered = new Set<string>();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.from === 'system') {
      const nextMsg = messages[i + 1];
      if (nextMsg && nextMsg.from === 'user') {
        const topics = classifyAllTopics(msg.text);
        for (const topic of topics) {
          if (topic !== 'unknown' && topic !== 'confirmed') {
            answered.add(topic);
          }
        }
      }
    }
  }
  return answered;
}

/** Get the last system message for a parent. */
export function getLastSystemMessage(messages: Message[]): string {
  const last = [...messages].reverse().find(m => m.from === 'system');
  return last?.text || '';
}

/** Check if the last system message indicates onboarding is complete. */
export function isOnboardingDone(messages: Message[]): boolean {
  const last = getLastSystemMessage(messages);
  return classifySystemMessage(last) === 'confirmed';
}

/** Resolve which parent's context we're working with. */
export function resolveParentContext(
  scenario: Scenario,
  phone: string,
): ConversationState {
  const isParentA = phone === scenario.config.parentA.phone;
  const messages = isParentA ? scenario.messagesA : scenario.messagesB;
  const answeredTopics = buildAnsweredTopics(messages);

  return {
    phase: getConversationPhase(scenario),
    answeredTopics,
    isParentA,
    messages,
  };
}
