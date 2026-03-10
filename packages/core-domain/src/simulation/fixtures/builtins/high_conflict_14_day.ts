import { SimulationFixture } from '../../types';

/**
 * One high-conflict parent vs one structured parent over 14 days.
 * Expects higher churn but system should remain stable.
 */
export const fixture: SimulationFixture = {
  simulationId: 'high_conflict_14_day',
  label: 'High conflict vs structured — 14-day stress test',
  description: 'High conflict parent generating swap requests and disruptions. System should handle gracefully.',
  seedScenario: {
    scenarioId: 'sim-seed-high-conflict',
    label: 'Seed: High conflict baseline',
    tags: ['simulation-seed'],
    seed: {
      family: { name: 'ConflictFamily' },
      parents: [
        { name: 'Alice', role: 'MOTHER' },
        { name: 'Bob', role: 'FATHER' },
      ],
      children: [
        { name: 'Charlie', birthDate: '2019-03-10' },
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
    deterministicSeed: 'high-conflict-14day',
    maxEventsPerStep: 5,
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
      type: 'CALMNESS',
      maxChurnRate: 1.0,
      maxAverageTransitions: 15,
    },
  ],
};
