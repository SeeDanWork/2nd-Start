// ── Send Handler ─────────────────────────────────────────────
// Processes a user-typed message, generates system response.

import { Scenario } from '../../types';
import { addLog } from '../../store';
import {
  generateSyntheticSystemResponse,
  isOnboardingComplete,
} from '../../behavior-engine';
import { generateSchedule } from '../../schedule-generator';
import { classifyIntent, extractEntities } from '../../llm/client';
import { buildAnsweredTopics } from '../state';

export interface SendResult {
  response: string;
  messagesA: Scenario['messagesA'];
  messagesB: Scenario['messagesB'];
  schedule: Scenario['schedule'];
  logs: Scenario['logs'];
}

export async function handleSend(
  scenario: Scenario,
  phone: string,
  body: string,
): Promise<SendResult> {
  addLog(scenario.id, 'api_call', phone, { action: 'send', body });

  // LLM enrichment (non-blocking)
  const [intent, entities] = await Promise.all([
    classifyIntent(body, { scenario: scenario.config.name }),
    extractEntities(body, { scenario: scenario.config.name }),
  ]);

  if (intent) {
    addLog(scenario.id, 'info', phone, {
      action: 'llm_classify',
      intent: intent.intent,
      confidence: intent.confidence,
    });
  }
  if (entities) {
    addLog(scenario.id, 'info', phone, { action: 'llm_entities', entities });
  }

  // Generate system response locally
  const isParentA = phone === scenario.config.parentA.phone;
  const messages = isParentA ? scenario.messagesA : scenario.messagesB;

  messages.push({
    id: crypto.randomUUID(),
    from: 'user',
    text: body,
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

  // Generate schedule if onboarding just completed
  if (isOnboardingComplete(response) && scenario.schedule.length === 0) {
    scenario.schedule = generateSchedule(scenario.config);
    addLog(scenario.id, 'info', phone, {
      action: 'schedule_generated',
      days: scenario.schedule.length,
    });

    // Notify the other parent about schedule creation
    const otherMessages = isParentA ? scenario.messagesB : scenario.messagesA;
    const otherPhone = isParentA ? scenario.config.parentB.phone : scenario.config.parentA.phone;
    const otherLabel = isParentA ? scenario.config.parentA.label : scenario.config.parentB.label;
    const ts = new Date().toISOString();

    otherMessages.push({
      id: crypto.randomUUID(),
      from: 'system',
      text: "Your family schedule is now created! You can view your upcoming exchanges by typing 'schedule'. Type 'help' for available commands.",
      timestamp: ts,
      phone: otherPhone,
    });
    otherMessages.push({
      id: crypto.randomUUID(),
      from: 'system',
      text: `${otherLabel} has invited you to ADCP to co-manage your family's custody schedule. Everything is set up and ready to go.`,
      timestamp: ts,
      phone: otherPhone,
    });
  }

  addLog(scenario.id, 'info', phone, {
    action: 'message',
    body,
    response: response.slice(0, 200),
  });

  return {
    response,
    messagesA: scenario.messagesA,
    messagesB: scenario.messagesB,
    schedule: scenario.schedule,
    logs: scenario.logs,
  };
}
