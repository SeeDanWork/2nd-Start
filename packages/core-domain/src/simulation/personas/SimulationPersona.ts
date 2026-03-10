import {
  SimulationPersonaType,
  SimulationGeneratedEvent,
  SimulationFamilyContext,
  SimulationPersonaAssignment,
} from '../types';

/**
 * Interface for deterministic simulation personas.
 * Each persona generates events based on its behavioral profile.
 */
export interface SimulationPersona {
  personaType: SimulationPersonaType;
  generateEvents(input: {
    date: string;
    deterministicSeed: string;
    familyContext: SimulationFamilyContext;
    personaAssignment: SimulationPersonaAssignment;
  }): SimulationGeneratedEvent[];
}
