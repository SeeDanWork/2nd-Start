import { describe, it, expect } from 'vitest';
import { StructuredCoParentPersona } from '../personas/StructuredCoParentPersona';
import { HighConflictPersona } from '../personas/HighConflictPersona';
import { LogisticsHeavyPersona } from '../personas/LogisticsHeavyPersona';
import { FlexibleCoParentPersona } from '../personas/FlexibleCoParentPersona';
import { SimulationPersonaRegistry } from '../personas/SimulationPersonaRegistry';
import { SimulationFamilyContext, SimulationPersonaAssignment } from '../types';

const familyContext: SimulationFamilyContext = {
  familyId: 'family:Test',
  parentIdsByName: { Alice: 'parent:Alice', Bob: 'parent:Bob' },
  childIdsByName: { Charlie: 'child:Charlie' },
};

const aliceAssignment: SimulationPersonaAssignment = {
  parentName: 'Alice',
  personaType: 'STRUCTURED_CO_PARENT',
};

describe('Personas', () => {
  it('StructuredCoParentPersona generates deterministic events', () => {
    const persona = new StructuredCoParentPersona();
    const events1 = persona.generateEvents({
      date: '2026-03-10',
      deterministicSeed: 'seed1',
      familyContext,
      personaAssignment: aliceAssignment,
    });
    const events2 = persona.generateEvents({
      date: '2026-03-10',
      deterministicSeed: 'seed1',
      familyContext,
      personaAssignment: aliceAssignment,
    });
    expect(events1).toEqual(events2);
  });

  it('HighConflictPersona can generate overlay and swap events', () => {
    const persona = new HighConflictPersona();
    // Run many dates to find at least one event
    let hasOverlay = false;
    let hasSwap = false;
    for (let d = 1; d <= 100; d++) {
      const events = persona.generateEvents({
        date: `2026-03-${String(d).padStart(2, '0')}`,
        deterministicSeed: 'high-conflict-test',
        familyContext,
        personaAssignment: { ...aliceAssignment, personaType: 'HIGH_CONFLICT' },
      });
      for (const e of events) {
        if (e.type === 'OVERLAY') hasOverlay = true;
        if (e.type === 'SWAP_INTENT') hasSwap = true;
      }
    }
    expect(hasOverlay).toBe(true);
    expect(hasSwap).toBe(true);
  });

  it('LogisticsHeavyPersona can generate calendar events', () => {
    const persona = new LogisticsHeavyPersona();
    let hasCalendar = false;
    for (let d = 1; d <= 100; d++) {
      const events = persona.generateEvents({
        date: `2026-03-${String(d).padStart(2, '0')}`,
        deterministicSeed: 'logistics-test',
        familyContext,
        personaAssignment: { ...aliceAssignment, personaType: 'LOGISTICS_HEAVY' },
      });
      for (const e of events) {
        if (e.type === 'CALENDAR_IMPORT') hasCalendar = true;
      }
    }
    expect(hasCalendar).toBe(true);
  });

  it('FlexibleCoParentPersona generates overlay events at moderate rate', () => {
    const persona = new FlexibleCoParentPersona();
    let eventCount = 0;
    for (let d = 1; d <= 200; d++) {
      const events = persona.generateEvents({
        date: `2026-${String(Math.floor(d / 30) + 1).padStart(2, '0')}-${String((d % 28) + 1).padStart(2, '0')}`,
        deterministicSeed: 'flex-test',
        familyContext,
        personaAssignment: { ...aliceAssignment, personaType: 'FLEXIBLE_CO_PARENT' },
      });
      eventCount += events.length;
    }
    // 8% rate across 200 days should produce some events
    expect(eventCount).toBeGreaterThan(0);
    // But not too many (not 100%)
    expect(eventCount).toBeLessThan(100);
  });

  it('SimulationPersonaRegistry resolves all persona types', () => {
    const registry = new SimulationPersonaRegistry();
    expect(registry.getPersona('STRUCTURED_CO_PARENT')).toBeInstanceOf(StructuredCoParentPersona);
    expect(registry.getPersona('HIGH_CONFLICT')).toBeInstanceOf(HighConflictPersona);
    expect(registry.getPersona('LOGISTICS_HEAVY')).toBeInstanceOf(LogisticsHeavyPersona);
    expect(registry.getPersona('FLEXIBLE_CO_PARENT')).toBeInstanceOf(FlexibleCoParentPersona);
  });

  it('SimulationPersonaRegistry throws for unknown type', () => {
    const registry = new SimulationPersonaRegistry();
    expect(() => registry.getPersona('UNKNOWN' as any)).toThrow('Unknown persona type');
  });
});
