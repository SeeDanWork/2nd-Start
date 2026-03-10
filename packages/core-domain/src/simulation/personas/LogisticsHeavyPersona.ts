import { SimulationPersona } from './SimulationPersona';
import {
  SimulationGeneratedEvent,
  SimulationFamilyContext,
  SimulationPersonaAssignment,
} from '../types';
import { DeterministicEventSampler } from '../events/DeterministicEventSampler';

const sampler = new DeterministicEventSampler();

/**
 * More child activity and calendar events, travel / commitment events, solver pressure.
 */
export class LogisticsHeavyPersona implements SimulationPersona {
  personaType = 'LOGISTICS_HEAVY' as const;

  generateEvents(input: {
    date: string;
    deterministicSeed: string;
    familyContext: SimulationFamilyContext;
    personaAssignment: SimulationPersonaAssignment;
  }): SimulationGeneratedEvent[] {
    const events: SimulationGeneratedEvent[] = [];
    const { date, deterministicSeed, familyContext, personaAssignment } = input;
    const seed = `${deterministicSeed}:${personaAssignment.parentName}`;

    // Calendar import: ~20% daily
    if (sampler.sampleBoolean({ seed, key: `calendar:${date}`, threshold: 0.20 })) {
      const childNames = Object.keys(familyContext.childIdsByName);
      const child = sampler.sampleItem(childNames, seed, `cal-child:${date}`);
      const activities = ['soccer practice', 'piano lesson', 'swim class', 'tutoring session'];
      const activity = sampler.sampleItem(activities, seed, `cal-activity:${date}`);

      events.push({
        type: 'CALENDAR_IMPORT',
        date,
        events: [{
          source: 'google',
          title: `${child}'s ${activity}`,
          startTime: `${date}T16:00:00`,
          endTime: `${date}T17:30:00`,
          allDay: false,
          scopeType: 'CHILD',
          childName: child,
        }],
      });
    }

    // Travel disruption: ~8%
    if (sampler.sampleBoolean({ seed, key: `travel:${date}`, threshold: 0.08 })) {
      events.push({
        type: 'CALENDAR_IMPORT',
        date,
        events: [{
          source: 'google',
          title: `${personaAssignment.parentName}'s business trip`,
          startTime: date,
          endTime: date,
          allDay: true,
          scopeType: 'PARENT',
          parentName: personaAssignment.parentName,
        }],
      });
    }

    // Low disruption rate: ~5%
    if (sampler.sampleBoolean({ seed, key: `disruption:${date}`, threshold: 0.05 })) {
      const childNames = Object.keys(familyContext.childIdsByName);
      const child = sampler.sampleItem(childNames, seed, `disruption-child:${date}`);
      events.push({
        type: 'OVERLAY',
        date,
        childName: child,
        assignedParentName: personaAssignment.parentName,
        disruptionType: 'TRAVEL',
        reason: 'Travel commitment',
      });
    }

    return events;
  }
}
