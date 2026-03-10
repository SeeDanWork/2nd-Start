import { SimulationPersona } from './SimulationPersona';
import {
  SimulationGeneratedEvent,
  SimulationFamilyContext,
  SimulationPersonaAssignment,
} from '../types';
import { DeterministicEventSampler } from '../events/DeterministicEventSampler';

const sampler = new DeterministicEventSampler();

/**
 * More swap requests, proposal churn, rejection pressure, schedule stress.
 */
export class HighConflictPersona implements SimulationPersona {
  personaType = 'HIGH_CONFLICT' as const;

  generateEvents(input: {
    date: string;
    deterministicSeed: string;
    familyContext: SimulationFamilyContext;
    personaAssignment: SimulationPersonaAssignment;
  }): SimulationGeneratedEvent[] {
    const events: SimulationGeneratedEvent[] = [];
    const { date, deterministicSeed, familyContext, personaAssignment } = input;
    const seed = `${deterministicSeed}:${personaAssignment.parentName}`;

    // Higher disruption rate: ~15%
    if (sampler.sampleBoolean({ seed, key: `disruption:${date}`, threshold: 0.15 })) {
      const childNames = Object.keys(familyContext.childIdsByName);
      const child = sampler.sampleItem(childNames, seed, `disruption-child:${date}`);
      const types = ['ILLNESS', 'TRAVEL', 'OTHER'];
      const disruptionType = sampler.sampleItem(types, seed, `disruption-type:${date}`);
      events.push({
        type: 'OVERLAY',
        date,
        childName: child,
        assignedParentName: personaAssignment.parentName,
        disruptionType,
        reason: 'Schedule conflict',
      });
    }

    // Swap request: ~10%
    if (sampler.sampleBoolean({ seed, key: `swap:${date}`, threshold: 0.10 })) {
      events.push({
        type: 'SWAP_INTENT',
        date,
        senderParentName: personaAssignment.parentName,
        reason: 'Wants to swap schedule',
      });
    }

    return events;
  }
}
