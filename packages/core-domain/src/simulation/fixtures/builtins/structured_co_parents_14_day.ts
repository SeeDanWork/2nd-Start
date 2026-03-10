import { SimulationFixture } from '../../types';

/**
 * Two structured co-parents over 14 days — low disruption, stable schedule.
 * Expects low churn and fairness convergence.
 */
export const fixture: SimulationFixture = {
  simulationId: 'structured_co_parents_14_day',
  label: 'Structured co-parents — 14-day stability run',
  description: 'Two low-conflict parents with a single child. Minimal disruptions expected.',
  seedScenario: {
    scenarioId: 'sim-seed-structured',
    label: 'Seed: Structured baseline',
    tags: ['simulation-seed'],
    seed: {
      family: { name: 'StructuredFamily' },
      parents: [
        { name: 'Alice', role: 'MOTHER' },
        { name: 'Bob', role: 'FATHER' },
      ],
      children: [
        { name: 'Charlie', birthDate: '2020-06-15' },
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
    deterministicSeed: 'structured-14day',
    maxEventsPerStep: 5,
    enableBaselineSolveAtStart: true,
    enableRepairOnOverlay: true,
    enableProposalGeneration: false,
    autoAcceptStrategy: 'FIRST',
  },
  personas: [
    { parentName: 'Alice', personaType: 'STRUCTURED_CO_PARENT' },
    { parentName: 'Bob', personaType: 'STRUCTURED_CO_PARENT' },
  ],
  eventPolicies: [
    { policyType: 'DISRUPTION_GENERATION', enabled: true },
    { policyType: 'SWAP_REQUEST_GENERATION', enabled: false },
    { policyType: 'CALENDAR_EVENT_GENERATION', enabled: false },
    { policyType: 'FAIRNESS_ADJUSTMENT_GENERATION', enabled: false },
  ],
  expectations: [
    {
      type: 'CALMNESS',
      maxChurnRate: 0.5,
      maxAverageTransitions: 10,
    },
  ],
};
