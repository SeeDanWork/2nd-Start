import {
  SimulationGeneratedEvent,
  SimulationFamilyContext,
  SimulationFixture,
  SimulationStep,
  SimulationEventPolicy,
} from '../types';
import { SimulationPersonaRegistry } from '../personas/SimulationPersonaRegistry';
import { SimulationEventPolicyEngine } from './SimulationEventPolicyEngine';

const registry = new SimulationPersonaRegistry();
const policyEngine = new SimulationEventPolicyEngine();

/**
 * Aggregates events from all persona assignments, filtered by event policies.
 */
export class SimulationEventGenerator {
  generateStepEvents(input: {
    step: SimulationStep;
    fixture: SimulationFixture;
    context: SimulationFamilyContext;
  }): SimulationGeneratedEvent[] {
    const { step, fixture, context } = input;
    const { deterministicSeed, maxEventsPerStep } = fixture.config;
    const allEvents: SimulationGeneratedEvent[] = [];

    for (const assignment of fixture.personas) {
      const persona = registry.getPersona(assignment.personaType);
      const raw = persona.generateEvents({
        date: step.date,
        deterministicSeed,
        familyContext: context,
        personaAssignment: assignment,
      });

      // Filter through policy engine
      for (const event of raw) {
        const policyType = this.eventToPolicyType(event);
        if (!policyType) {
          allEvents.push(event);
          continue;
        }

        const seed = `${deterministicSeed}:${assignment.parentName}`;
        if (policyEngine.allowEvent({
          policyType,
          date: step.date,
          seed,
          policies: fixture.eventPolicies,
        })) {
          allEvents.push(event);
        }
      }
    }

    // Cap total events per step
    const cap = maxEventsPerStep ?? 10;
    return allEvents.slice(0, cap);
  }

  private eventToPolicyType(event: SimulationGeneratedEvent): SimulationEventPolicy['policyType'] | null {
    switch (event.type) {
      case 'OVERLAY': return 'DISRUPTION_GENERATION';
      case 'SWAP_INTENT': return 'SWAP_REQUEST_GENERATION';
      case 'CALENDAR_IMPORT': return 'CALENDAR_EVENT_GENERATION';
      case 'FAIRNESS_ADJUSTMENT': return 'FAIRNESS_ADJUSTMENT_GENERATION';
      default: return null;
    }
  }
}
