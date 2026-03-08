// ── Connect Handler ──────────────────────────────────────────
// Generates welcome message when a parent first connects.

import { Scenario } from '../../types';
import { addLog } from '../../store';
import { generateSyntheticSystemResponse } from '../../behavior-engine';

export interface ConnectResult {
  response: string;
  messagesA: Scenario['messagesA'];
  messagesB: Scenario['messagesB'];
  logs: Scenario['logs'];
}

export function handleConnect(
  scenario: Scenario,
  phone: string,
): ConnectResult {
  addLog(scenario.id, 'api_call', phone, { action: 'connect', phone });

  const answeredTopics = new Set<string>();
  const response = generateSyntheticSystemResponse(scenario.config, answeredTopics);

  addLog(scenario.id, 'info', phone, {
    action: 'connected',
    response: response.slice(0, 200),
  });

  return {
    response,
    messagesA: scenario.messagesA,
    messagesB: scenario.messagesB,
    logs: scenario.logs,
  };
}
