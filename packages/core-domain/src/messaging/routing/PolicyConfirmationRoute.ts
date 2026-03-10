import { InterpretedIntent, WorkflowRouteResult, IntentType } from '../types';
import { IntentRoute } from './IntentRouter';

export class PolicyConfirmationRoute implements IntentRoute {
  readonly routeType = 'POLICY_CONFIRMATION';

  canHandle(intent: InterpretedIntent): boolean {
    return intent.type === IntentType.POLICY_CONFIRMATION;
  }

  route(intent: InterpretedIntent): WorkflowRouteResult {
    return {
      routeType: this.routeType,
      accepted: true,
      reason: 'Routed to policy confirmation workflow (stub)',
      data: { intentType: intent.type, payload: intent.payload },
    };
  }
}
