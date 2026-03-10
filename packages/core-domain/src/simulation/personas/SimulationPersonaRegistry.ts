import { SimulationPersona } from './SimulationPersona';
import { SimulationPersonaType } from '../types';
import { StructuredCoParentPersona } from './StructuredCoParentPersona';
import { HighConflictPersona } from './HighConflictPersona';
import { LogisticsHeavyPersona } from './LogisticsHeavyPersona';
import { FlexibleCoParentPersona } from './FlexibleCoParentPersona';

const PERSONA_MAP: Record<SimulationPersonaType, () => SimulationPersona> = {
  STRUCTURED_CO_PARENT: () => new StructuredCoParentPersona(),
  HIGH_CONFLICT: () => new HighConflictPersona(),
  LOGISTICS_HEAVY: () => new LogisticsHeavyPersona(),
  FLEXIBLE_CO_PARENT: () => new FlexibleCoParentPersona(),
};

export class SimulationPersonaRegistry {
  getPersona(personaType: SimulationPersonaType): SimulationPersona {
    const factory = PERSONA_MAP[personaType];
    if (!factory) {
      throw new Error(`Unknown persona type: ${personaType}`);
    }
    return factory();
  }
}
