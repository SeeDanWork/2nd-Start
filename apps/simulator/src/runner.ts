import { ScenarioDefinition, TriggerResult, AppState, ChatMessage, ChatMessageSchema } from './types';

export interface SimulationTranscript {
  scenario: {
    number: number;
    key: string;
    title: string;
    category: string;
    implemented: boolean;
  };
  params: Record<string, unknown>;
  seedState: AppState;
  triggerResult: TriggerResult;
  validatedMessages: ChatMessage[];
  stateTransitions: Record<string, AppState>;
  timeoutResult?: TriggerResult;
  errors: string[];
}

/**
 * Run a single scenario end-to-end:
 * 1. Build seed state from params
 * 2. Execute triggerEvent
 * 3. Validate each outgoing message against ChatMessageSchema
 * 4. Apply each expectedStateTransition
 * 5. Run timeoutPolicy.onTimeout if present
 */
export function simulate(
  scenario: ScenarioDefinition,
  paramsOverrides?: Record<string, unknown>,
): SimulationTranscript {
  const errors: string[] = [];

  // 1. Parse params with defaults
  const params = scenario.paramsSchema.parse(paramsOverrides ?? {});

  // 2. Build seed state
  const seedState = scenario.seedStateBuilder(params);

  // 3. Execute trigger (stubs return empty)
  let triggerResult: TriggerResult;
  if (!scenario.implemented) {
    triggerResult = { state: seedState, outgoingMessages: [] };
  } else {
    triggerResult = scenario.triggerEvent(seedState, params);
  }

  // 4. Validate messages
  const validatedMessages: ChatMessage[] = [];
  for (const msg of triggerResult.outgoingMessages) {
    const result = ChatMessageSchema.safeParse(msg);
    if (result.success) {
      validatedMessages.push(result.data);
    } else {
      errors.push(`Message validation failed: ${result.error.message}`);
      validatedMessages.push(msg as ChatMessage);
    }
  }

  // 5. Apply state transitions
  const stateTransitions: Record<string, AppState> = {};
  if (scenario.expectedStateTransitions) {
    for (const [actionId, transitionFn] of Object.entries(scenario.expectedStateTransitions)) {
      try {
        stateTransitions[actionId] = transitionFn(triggerResult.state, {});
      } catch (err) {
        errors.push(`State transition '${actionId}' threw: ${(err as Error).message}`);
      }
    }
  }

  // 6. Timeout policy
  let timeoutResult: TriggerResult | undefined;
  if (scenario.timeoutPolicy) {
    try {
      timeoutResult = scenario.timeoutPolicy.onTimeout(triggerResult.state);
    } catch (err) {
      errors.push(`Timeout policy threw: ${(err as Error).message}`);
    }
  }

  return {
    scenario: {
      number: scenario.number,
      key: scenario.key,
      title: scenario.title,
      category: scenario.category,
      implemented: scenario.implemented,
    },
    params,
    seedState,
    triggerResult,
    validatedMessages,
    stateTransitions,
    timeoutResult,
    errors,
  };
}

/**
 * Format a transcript as human-readable text
 */
export function formatTranscript(transcript: SimulationTranscript): string {
  const lines: string[] = [];
  const s = transcript.scenario;

  lines.push(`${'═'.repeat(60)}`);
  lines.push(`Scenario #${s.number}: ${s.title}`);
  lines.push(`Key: ${s.key} | Category: ${s.category} | Implemented: ${s.implemented}`);
  lines.push(`${'─'.repeat(60)}`);

  lines.push(`\nParams: ${JSON.stringify(transcript.params, null, 2)}`);

  lines.push(`\n── Messages (${transcript.validatedMessages.length}) ──`);
  for (const msg of transcript.validatedMessages) {
    lines.push(`  [${msg.messageId}] to=${JSON.stringify(msg.to)} urgency=${msg.urgency ?? 'normal'}`);
    lines.push(`  "${msg.text}"`);
    if (msg.sections) {
      for (const sec of msg.sections) {
        lines.push(`    ${sec.title ?? '(untitled)'}:`);
        for (const b of sec.bullets ?? []) {
          lines.push(`      • ${b}`);
        }
      }
    }
    if (msg.actions) {
      lines.push(`    Actions: ${msg.actions.map((a) => `[${a.actionId}] ${a.label}`).join(' | ')}`);
    }
    lines.push('');
  }

  const transitionKeys = Object.keys(transcript.stateTransitions);
  if (transitionKeys.length > 0) {
    lines.push(`── State Transitions (${transitionKeys.length}) ──`);
    for (const key of transitionKeys) {
      lines.push(`  ${key}: OK`);
    }
  }

  if (transcript.timeoutResult) {
    lines.push(`\n── Timeout Policy ──`);
    lines.push(`  Messages: ${transcript.timeoutResult.outgoingMessages.length}`);
    for (const msg of transcript.timeoutResult.outgoingMessages) {
      lines.push(`  [${msg.messageId}] "${msg.text}"`);
    }
  }

  if (transcript.errors.length > 0) {
    lines.push(`\n── ERRORS (${transcript.errors.length}) ──`);
    for (const err of transcript.errors) {
      lines.push(`  ✗ ${err}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
