import { describe, it, expect } from 'vitest';
import { SimulationEventGenerator } from '../events/SimulationEventGenerator';
import { SimulationFamilyContext, SimulationFixture, SimulationStep } from '../types';

const generator = new SimulationEventGenerator();

const familyContext: SimulationFamilyContext = {
  familyId: 'family:Test',
  parentIdsByName: { Alice: 'parent:Alice', Bob: 'parent:Bob' },
  childIdsByName: { Charlie: 'child:Charlie' },
};

function makeFixture(overrides?: Partial<SimulationFixture>): SimulationFixture {
  return {
    simulationId: 'test',
    label: 'test',
    seedScenario: { scenarioId: 'seed', label: 'seed', tags: [], seed: { family: { name: 'F' }, parents: [], children: [] }, steps: [], expectations: [] },
    config: {
      startDate: '2026-03-09',
      endDate: '2026-03-15',
      stepGranularity: 'DAY',
      deterministicSeed: 'test-seed',
      enableBaselineSolveAtStart: false,
      enableRepairOnOverlay: false,
      enableProposalGeneration: false,
      ...overrides?.config,
    },
    personas: overrides?.personas ?? [
      { parentName: 'Alice', personaType: 'HIGH_CONFLICT' },
      { parentName: 'Bob', personaType: 'STRUCTURED_CO_PARENT' },
    ],
    eventPolicies: overrides?.eventPolicies ?? [
      { policyType: 'DISRUPTION_GENERATION', enabled: true },
      { policyType: 'SWAP_REQUEST_GENERATION', enabled: true },
      { policyType: 'CALENDAR_EVENT_GENERATION', enabled: true },
      { policyType: 'FAIRNESS_ADJUSTMENT_GENERATION', enabled: true },
    ],
    ...overrides,
  } as SimulationFixture;
}

const step: SimulationStep = { stepIndex: 0, date: '2026-03-10' };

describe('SimulationEventGenerator', () => {
  it('generates deterministic events for same inputs', () => {
    const fixture = makeFixture();
    const events1 = generator.generateStepEvents({ step, fixture, context: familyContext });
    const events2 = generator.generateStepEvents({ step, fixture, context: familyContext });
    expect(events1).toEqual(events2);
  });

  it('respects maxEventsPerStep cap', () => {
    const fixture = makeFixture({
      config: {
        startDate: '2026-03-09', endDate: '2026-03-15', stepGranularity: 'DAY',
        deterministicSeed: 'flood', maxEventsPerStep: 2,
        enableBaselineSolveAtStart: false, enableRepairOnOverlay: false, enableProposalGeneration: false,
      },
      personas: [
        { parentName: 'Alice', personaType: 'HIGH_CONFLICT' },
        { parentName: 'Bob', personaType: 'LOGISTICS_HEAVY' },
      ],
    });
    const events = generator.generateStepEvents({ step, fixture, context: familyContext });
    expect(events.length).toBeLessThanOrEqual(2);
  });

  it('returns no events when all policies disabled', () => {
    const fixture = makeFixture({
      eventPolicies: [
        { policyType: 'DISRUPTION_GENERATION', enabled: false },
        { policyType: 'SWAP_REQUEST_GENERATION', enabled: false },
        { policyType: 'CALENDAR_EVENT_GENERATION', enabled: false },
        { policyType: 'FAIRNESS_ADJUSTMENT_GENERATION', enabled: false },
      ],
    });
    let totalEvents = 0;
    for (let d = 1; d <= 30; d++) {
      const s: SimulationStep = { stepIndex: d, date: `2026-03-${String(d).padStart(2, '0')}` };
      totalEvents += generator.generateStepEvents({ step: s, fixture, context: familyContext }).length;
    }
    expect(totalEvents).toBe(0);
  });

  it('generates events over multiple days', () => {
    const fixture = makeFixture();
    let totalEvents = 0;
    for (let d = 1; d <= 100; d++) {
      const s: SimulationStep = { stepIndex: d, date: `2026-03-${String(d).padStart(2, '0')}` };
      totalEvents += generator.generateStepEvents({ step: s, fixture, context: familyContext }).length;
    }
    expect(totalEvents).toBeGreaterThan(0);
  });
});
