import { InterpretedIntent, WorkflowRouteResult, IntentType } from '../types';
import { IntentRoutingError, UnsupportedIntentTypeError } from '../errors';
import { AvailabilityChangeRoute } from './AvailabilityChangeRoute';
import { SwapRequestRoute } from './SwapRequestRoute';
import { DisruptionReportRoute } from './DisruptionReportRoute';
import { ProposalRequestRoute } from './ProposalRequestRoute';
import { PolicyConfirmationRoute } from './PolicyConfirmationRoute';

export interface IntentRoute {
  readonly routeType: string;
  canHandle(intent: InterpretedIntent): boolean;
  route(intent: InterpretedIntent): WorkflowRouteResult;
}

/**
 * Routes validated interpreted intents to workflow stubs.
 */
export class IntentRouter {
  private readonly routes: IntentRoute[];

  constructor(routes?: IntentRoute[]) {
    this.routes = routes ?? [
      new AvailabilityChangeRoute(),
      new SwapRequestRoute(),
      new DisruptionReportRoute(),
      new ProposalRequestRoute(),
      new PolicyConfirmationRoute(),
    ];
  }

  route(intent: InterpretedIntent): WorkflowRouteResult {
    for (const r of this.routes) {
      if (r.canHandle(intent)) {
        return r.route(intent);
      }
    }

    throw new UnsupportedIntentTypeError(intent.type);
  }
}
