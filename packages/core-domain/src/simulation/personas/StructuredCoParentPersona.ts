import { SimulationPersona } from './SimulationPersona';
import {
  SimulationGeneratedEvent,
  SimulationFamilyContext,
  SimulationPersonaAssignment,
} from '../types';
import { DeterministicEventSampler } from '../events/DeterministicEventSampler';

const sampler = new DeterministicEventSampler();

/**
 * Low event frequency, low disruption rate, stable schedule behavior.
 */
export class StructuredCoParentPersona implements SimulationPersona {
  personaType = 'STRUCTURED_CO_PARENT' as const;

  generateEvents(input: {
    date: string;
    deterministicSeed: string;
    familyContext: SimulationFamilyContext;
    personaAssignment: SimulationPersonaAssignment;
  }): SimulationGeneratedEvent[] {
    const events: SimulationGeneratedEvent[] = [];
    const { date, deterministicSeed, familyContext, personaAssignment } = input;
    const seed = `${deterministicSeed}:${personaAssignment.parentName}`;

    // Low disruption rate: ~5%
    if (sampler.sampleBoolean({ seed, key: `disruption:${date}`, threshold: 0.05 })) {
      const childNames = Object.keys(familyContext.childIdsByName);
      const child = sampler.sampleItem(childNames, seed, `disruption-child:${date}`);
      events.push({
        type: 'OVERLAY',
        date,
        childName: child,
        assignedParentName: personaAssignment.parentName,
        disruptionType: 'ILLNESS',
        reason: 'Minor illness',
      });
    }

    return events;
  }
}
