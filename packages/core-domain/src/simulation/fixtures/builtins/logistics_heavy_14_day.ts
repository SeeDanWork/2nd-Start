import { SimulationFixture } from '../../types';

/**
 * Logistics-heavy parent with calendar events and travel disruptions.
 * Tests calendar ingestion and schedule pressure over 14 days.
 */
export const fixture: SimulationFixture = {
  simulationId: 'logistics_heavy_14_day',
  label: 'Logistics heavy — 14-day calendar stress',
  description: 'One logistics-heavy parent generates frequent calendar events and travel disruptions.',
  seedScenario: {
    scenarioId: 'sim-seed-logistics',
    label: 'Seed: Logistics baseline',
    tags: ['simulation-seed'],
    seed: {
      family: { name: 'LogisticsFamily' },
      parents: [
        { name: 'Alice', role: 'MOTHER' },
        { name: 'Bob', role: 'FATHER' },
      ],
      children: [
        { name: 'Charlie', birthDate: '2018-09-01' },
        { name: 'Dana', birthDate: '2021-01-15' },
      ],
    },
    steps: [
      {
        type: 'SOLVE_BASELINE',
        stepId: 'seed-solve',
        windowStart: '2026-03-09',
        windowEnd: '2026-03-22',
        candidateCount: 2,
      },
      {
        type: 'ACCEPT_PROPOSAL',
        stepId: 'seed-accept',
        selection: { strategy: 'FIRST' },
        acceptedAt: '2026-03-08T12:00:00Z',
        acceptedByParentName: 'Alice',
      },
    ],
    expectations: [],
  },
  config: {
    startDate: '2026-03-09',
    endDate: '2026-03-22',
    stepGranularity: 'DAY',
    deterministicSeed: 'logistics-14day',
    maxEventsPerStep: 8,
    enableBaselineSolveAtStart: true,
    enableRepairOnOverlay: true,
    enableProposalGeneration: false,
    autoAcceptStrategy: 'FIRST',
  },
  personas: [
    { parentName: 'Alice', personaType: 'LOGISTICS_HEAVY' },
    { parentName: 'Bob', personaType: 'FLEXIBLE_CO_PARENT' },
  ],
  eventPolicies: [
    { policyType: 'DISRUPTION_GENERATION', enabled: true },
    { policyType: 'SWAP_REQUEST_GENERATION', enabled: false },
    { policyType: 'CALENDAR_EVENT_GENERATION', enabled: true },
    { policyType: 'FAIRNESS_ADJUSTMENT_GENERATION', enabled: false },
  ],
  expectations: [
    {
      type: 'CALMNESS',
      maxChurnRate: 1.0,
      maxAverageTransitions: 15,
    },
  ],
};
