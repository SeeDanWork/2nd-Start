import { SimulationPersona } from './SimulationPersona';
import {
  SimulationGeneratedEvent,
  SimulationFamilyContext,
  SimulationPersonaAssignment,
} from '../types';
import { DeterministicEventSampler } from '../events/DeterministicEventSampler';

const sampler = new DeterministicEventSampler();

/**
 * Moderate disruptions, consensual swaps, lower conflict.
 */
export class FlexibleCoParentPersona implements SimulationPersona {
  personaType = 'FLEXIBLE_CO_PARENT' as const;

  generateEvents(input: {
    date: string;
    deterministicSeed: string;
    familyContext: SimulationFamilyContext;
    personaAssignment: SimulationPersonaAssignment;
  }): SimulationGeneratedEvent[] {
    const events: SimulationGeneratedEvent[] = [];
    const { date, deterministicSeed, familyContext, personaAssignment } = input;
    const seed = `${deterministicSeed}:${personaAssignment.parentName}`;

    // Moderate disruption: ~8%
    if (sampler.sampleBoolean({ seed, key: `disruption:${date}`, threshold: 0.08 })) {
      const childNames = Object.keys(familyContext.childIdsByName);
      const child = sampler.sampleItem(childNames, seed, `disruption-child:${date}`);
      events.push({
        type: 'OVERLAY',
        date,
        childName: child,
        assignedParentName: personaAssignment.parentName,
        disruptionType: 'OTHER',
        reason: 'Schedule adjustment needed',
      });
    }

    return events;
  }
}
