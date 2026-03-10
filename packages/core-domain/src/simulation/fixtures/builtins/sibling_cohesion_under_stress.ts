import { SimulationFixture } from '../../types';

/**
 * Two children, repeated disruptions from high-conflict parent.
 * Tests that sibling divergence remains below configured bound.
 */
export const fixture: SimulationFixture = {
  simulationId: 'sibling_cohesion_under_stress',
  label: 'Sibling cohesion under stress — 14 days',
  description: 'Two children with repeated disruptions. Sibling divergence should remain bounded.',
  seedScenario: {
    scenarioId: 'sim-seed-sibling-cohesion',
    label: 'Seed: Sibling cohesion baseline',
    tags: ['simulation-seed'],
    seed: {
      family: { name: 'CohesionFamily' },
      parents: [
        { name: 'Alice', role: 'MOTHER' },
        { name: 'Bob', role: 'FATHER' },
      ],
      children: [
        { name: 'Charlie', birthDate: '2019-04-12' },
        { name: 'Dana', birthDate: '2021-08-30' },
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
    deterministicSeed: 'sibling-cohesion-stress',
    maxEventsPerStep: 6,
    enableBaselineSolveAtStart: true,
    enableRepairOnOverlay: true,
    enableProposalGeneration: false,
    autoAcceptStrategy: 'FIRST',
  },
  personas: [
    { parentName: 'Alice', personaType: 'HIGH_CONFLICT' },
    { parentName: 'Bob', personaType: 'STRUCTURED_CO_PARENT' },
  ],
  eventPolicies: [
    { policyType: 'DISRUPTION_GENERATION', enabled: true },
    { policyType: 'SWAP_REQUEST_GENERATION', enabled: true },
    { policyType: 'CALENDAR_EVENT_GENERATION', enabled: false },
    { policyType: 'FAIRNESS_ADJUSTMENT_GENERATION', enabled: false },
  ],
  expectations: [
    {
      type: 'METRIC_BOUND',
      metric: 'siblingDivergenceRate',
      operator: 'LTE',
      value: 0.8,
    },
    {
      type: 'CALMNESS',
      maxChurnRate: 1.0,
      maxAverageTransitions: 15,
    },
  ],
};
