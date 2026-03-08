// ── Connect Handler ──────────────────────────────────────────
// Generates welcome message when a parent first connects.

import { Scenario } from '../../types';
import { addLog } from '../../store';
import { generateSyntheticSystemResponse } from '../../behavior-engine';

export interface ConnectResult {
  response: string;
  messagesA: Scenario['messagesA'];
  messagesB: Scenario['messagesB'];
  schedule: Scenario['schedule'];
  logs: Scenario['logs'];
}

export function handleConnect(
  scenario: Scenario,
  phone: string,
): ConnectResult {
  addLog(scenario.id, 'api_call', phone, { action: 'connect', phone });

  const isParentA = phone === scenario.config.parentA.phone;
  const messages = isParentA ? scenario.messagesA : scenario.messagesB;

  const answeredTopics = new Set<string>();
  const response = isParentA
    ? generateSyntheticSystemResponse(scenario.config, answeredTopics)
    : scenario.schedule.length > 0
      ? `Hi! Your co-parent has already set up your family schedule. You can view your upcoming exchanges by typing 'schedule'. Type 'help' for available commands.`
      : generateSyntheticSystemResponse(scenario.config, answeredTopics);

  messages.push({
    id: crypto.randomUUID(),
    from: 'system',
    text: response,
    timestamp: new Date().toISOString(),
    phone,
  });

  addLog(scenario.id, 'info', phone, {
    action: 'connected',
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
