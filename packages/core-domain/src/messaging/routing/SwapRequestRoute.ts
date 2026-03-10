import { InterpretedIntent, WorkflowRouteResult, IntentType } from '../types';
import { IntentRoute } from './IntentRouter';

export class SwapRequestRoute implements IntentRoute {
  readonly routeType = 'SWAP_REQUEST';

  canHandle(intent: InterpretedIntent): boolean {
    return intent.type === IntentType.SWAP_REQUEST;
  }

  route(intent: InterpretedIntent): WorkflowRouteResult {
    return {
      routeType: this.routeType,
      accepted: true,
      reason: 'Routed to swap request workflow (stub)',
      data: { intentType: intent.type, payload: intent.payload },
    };
  }
}
