import { InterpretedIntent, WorkflowRouteResult, IntentType } from '../types';
import { IntentRoute } from './IntentRouter';

export class ProposalRequestRoute implements IntentRoute {
  readonly routeType = 'PROPOSAL_REQUEST';

  canHandle(intent: InterpretedIntent): boolean {
    return intent.type === IntentType.PROPOSAL_REQUEST;
  }

  route(intent: InterpretedIntent): WorkflowRouteResult {
    return {
      routeType: this.routeType,
      accepted: true,
      reason: 'Routed to proposal request workflow (stub)',
      data: { intentType: intent.type, payload: intent.payload },
    };
  }
}
