// ── Connect Handler ──────────────────────────────────────────
// Generates welcome message when a parent first connects.
// Also initializes the conversation session.

import { Scenario } from '../../types';
import { addLog } from '../../store';
import { generateSyntheticSystemResponse } from '../../behavior-engine';
import { getOrCreateSession } from '../session-store';
import { emitEvent } from '../session';

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
  const sender = isParentA ? 'parent_a' as const : 'parent_b' as const;
  const messages = isParentA ? scenario.messagesA : scenario.messagesB;

  // Initialize session
  const session = getOrCreateSession(scenario.id, scenario.config);

  // Sync schedule if it exists
  if (scenario.schedule.length > 0 && session.schedule.length === 0) {
    session.schedule = scenario.schedule;
  }

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

  // Emit welcome event to session
  emitEvent(session, 'SystemAcknowledgment', 'system', {
    text: response,
    targetParent: sender,
  });

  // Mark parent as started in session
  if (isParentA) {
    session.onboarding.parentA.started = true;
  } else {
    session.onboarding.parentB.started = true;
    // If schedule already exists, parent B's onboarding is effectively done
    if (scenario.schedule.length > 0) {
      session.onboarding.parentB.completed = true;
      if (session.onboarding.parentA.completed) {
        session.mode = 'operational';
      }
    }
  }

  addLog(scenario.id, 'info', phone, {
    action: 'connected',
    response: response.slice(0, 200),
    sessionMode: session.mode,
  });

  return {
    response,
    messagesA: scenario.messagesA,
    messagesB: scenario.messagesB,
    schedule: scenario.schedule,
    logs: scenario.logs,
  };
}
