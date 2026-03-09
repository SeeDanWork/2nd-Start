// ── Auto-Respond Handler ─────────────────────────────────────
// Generates a persona-driven auto-response for a single parent.

import { Scenario } from '../../types';
import { addLog } from '../../store';
import { PARENT_PERSONAS } from '../../personas';
import {
  evaluateProposalWithArchetype,
  evaluateDisruption,
  generatePersonaMessage,
  getArchetype,
  generateSyntheticSystemResponse,
  DecisionResult,
} from '../../behavior-engine';
import { classifyIntent } from '../../llm/client';
import { buildAnsweredTopics } from '../state';

export interface AutoRespondResult {
  response: string;
  autoMessage: string;
  decision: { decision: string; confidence: number; reasoning: string } | null;
  messagesA: Scenario['messagesA'];
  messagesB: Scenario['messagesB'];
  logs: Scenario['logs'];
}

export async function handleAutoRespond(
  scenario: Scenario,
  phone: string,
): Promise<AutoRespondResult> {
  const isParentA = phone === scenario.config.parentA.phone;
  const personaId = isParentA ? scenario.config.personaA : scenario.config.personaB;
  const persona = PARENT_PERSONAS.find(p => p.id === personaId);

  if (!persona) {
    throw new Error('No persona assigned to this parent');
  }

  const archetype = (scenario.config.personaA && scenario.config.personaB)
    ? getArchetype(scenario.config.personaA, scenario.config.personaB)
    : null;

  const messages = isParentA ? scenario.messagesA : scenario.messagesB;
  const lastSystem = [...messages].reverse().find(m => m.from === 'system');
  const context = lastSystem?.text.toLowerCase() || '';

  let autoText: string;
  let decision: DecisionResult | null = null;

  const isProposal = context.includes('proposal') || context.includes('schedule') || context.includes('approve');
  const isDisruption = context.includes('sick') || context.includes('emergency') || context.includes('cancel');

  if (isProposal) {
    decision = evaluateProposalWithArchetype(persona, archetype, 5, false, false, messages.length);
    addLog(scenario.id, 'info', phone, {
      action: 'behavior_engine',
      archetype: archetype?.id || null,
      conflict_probability: archetype?.conflict_probability || null,
      decision: decision.decision,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
    });

    if (decision.decision === 'accept') {
      autoText = generatePersonaMessage(persona, 'proposal_response');
    } else if (decision.decision === 'counter') {
      autoText = decision.counter_text || generatePersonaMessage(persona, 'swap_request');
    } else if (decision.decision === 'ignore') {
      autoText = '(no response)';
    } else {
      autoText = generatePersonaMessage(persona, 'complaint');
    }
  } else if (isDisruption) {
    const event = { type: 'disruption', day: messages.length };
    decision = evaluateDisruption(persona, event, messages.length);
    addLog(scenario.id, 'info', phone, {
      action: 'behavior_engine',
      decision: decision.decision,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
    });
    autoText = generatePersonaMessage(persona, 'disruption_report', { eventType: 'disruption' });
  } else {
    autoText = generatePersonaMessage(persona, 'greeting');
  }

  // LLM enrichment
  const intent = await classifyIntent(autoText, { persona: persona.name });
  if (intent) {
    addLog(scenario.id, 'info', phone, {
      action: 'llm_classify',
      intent: intent.intent,
      confidence: intent.confidence,
    });
  }

  // Generate system response locally
  messages.push({
    id: crypto.randomUUID(),
    from: 'user',
    text: autoText,
    timestamp: new Date().toISOString(),
    phone,
  });

  const answeredTopics = buildAnsweredTopics(messages);
  const response = generateSyntheticSystemResponse(scenario.config, answeredTopics);

  messages.push({
    id: crypto.randomUUID(),
    from: 'system',
    text: response,
    timestamp: new Date().toISOString(),
    phone,
  });

  if (scenario.status === 'draft') scenario.status = 'simulating';

  return {
    response,
    autoMessage: autoText,
    decision: decision
      ? { decision: decision.decision, confidence: decision.confidence, reasoning: decision.reasoning }
      : null,
    messagesA: scenario.messagesA,
    messagesB: scenario.messagesB,
    logs: scenario.logs,
  };
}
