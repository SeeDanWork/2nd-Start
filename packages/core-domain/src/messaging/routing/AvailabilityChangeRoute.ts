import { InterpretedIntent, WorkflowRouteResult, IntentType } from '../types';
import { IntentRoute } from './IntentRouter';

export class AvailabilityChangeRoute implements IntentRoute {
  readonly routeType = 'AVAILABILITY_CHANGE';

  canHandle(intent: InterpretedIntent): boolean {
    return intent.type === IntentType.AVAILABILITY_CHANGE;
  }

  route(intent: InterpretedIntent): WorkflowRouteResult {
    return {
      routeType: this.routeType,
      accepted: true,
      reason: 'Routed to availability change workflow (stub)',
      data: { intentType: intent.type, payload: intent.payload },
    };
  }
}
