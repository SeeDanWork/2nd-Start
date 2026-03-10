import { InterpretedIntent, WorkflowRouteResult, IntentType } from '../types';
import { IntentRoute } from './IntentRouter';

export class DisruptionReportRoute implements IntentRoute {
  readonly routeType = 'DISRUPTION_REPORT';

  canHandle(intent: InterpretedIntent): boolean {
    return intent.type === IntentType.DISRUPTION_REPORT;
  }

  route(intent: InterpretedIntent): WorkflowRouteResult {
    return {
      routeType: this.routeType,
      accepted: true,
      reason: 'Routed to disruption report workflow (stub)',
      data: { intentType: intent.type, payload: intent.payload },
    };
  }
}
