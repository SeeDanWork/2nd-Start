// ── Conversation Orchestrator ────────────────────────────────
// Single entry point for all simulation actions. Routes to
// appropriate handler based on action type.
//
// Architecture:
//   HTTP Route → Orchestrator → Handler → Engine/LLM/State
//
// The orchestrator owns:
// - Action routing
// - Scenario lookup
// - Error normalization
// - Response shaping

import { getScenario, addLog } from '../store';
import {
  handleConnect,
  handleSend,
  handleAutoRespond,
  handleSimulatePair,
  handleRunSetup,
  handleStepDay,
  handleInjectDisruption,
  DuplicateDisruptionError,
} from './handlers';

export type ActionType =
  | 'connect'
  | 'send'
  | 'auto_respond'
  | 'simulate_pair'
  | 'run_setup'
  | 'step_day'
  | 'inject_disruption';

export interface OrchestratorRequest {
  scenarioId: string;
  phone: string;
  action: ActionType;
  body?: unknown;
}

export interface OrchestratorResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export async function orchestrate(req: OrchestratorRequest): Promise<OrchestratorResponse> {
  const { scenarioId, phone, action, body } = req;

  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return { status: 404, data: { error: 'Scenario not found' } };
  }

  try {
    switch (action) {
      case 'connect': {
        const result = handleConnect(scenario, phone);
        return { status: 200, data: result };
      }

      case 'send': {
        const result = await handleSend(scenario, phone, body as string);
        return { status: 200, data: result };
      }

      case 'auto_respond': {
        const result = await handleAutoRespond(scenario, phone);
        return { status: 200, data: result };
      }

      case 'simulate_pair': {
        const result = handleSimulatePair(scenario);
        return { status: 200, data: result };
      }

      case 'run_setup': {
        const result = await handleRunSetup(scenario);
        return { status: 200, data: result };
      }

      case 'step_day': {
        const result = handleStepDay(scenario, body);
        return { status: 200, data: result };
      }

      case 'inject_disruption': {
        const result = handleInjectDisruption(scenario, phone, body as string);
        return { status: 200, data: result };
      }

      default:
        return { status: 400, data: { error: 'Invalid action' } };
    }
  } catch (err: unknown) {
    if (err instanceof DuplicateDisruptionError) {
      return {
        status: 409,
        data: {
          error: err.message,
          messagesA: scenario.messagesA,
          messagesB: scenario.messagesB,
        },
      };
    }

    const message = err instanceof Error ? err.message : 'Unknown error';

    // Known validation errors → 400
    if (message.includes('must have') || message.includes('No persona')) {
      return { status: 400, data: { error: message } };
    }

    addLog(scenarioId, 'error', phone, { error: message });
    return { status: 500, data: { error: message } };
  }
}
