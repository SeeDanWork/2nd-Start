import { SimulationFixture } from '../../types';

/**
 * Repeated overlays over time with seeded fairness drift.
 * Tests that fairness deviation eventually reduces below threshold without excessive churn.
 */
export const fixture: SimulationFixture = {
  simulationId: 'gradual_fairness_restitution_under_disruption',
  label: 'Gradual fairness restitution under disruption — 14 days',
  description: 'Repeated overlays with seeded fairness drift. Fairness deviation should reduce below threshold without excessive churn.',
  seedScenario: {
    scenarioId: 'sim-seed-fairness',
    label: 'Seed: Fairness convergence baseline',
    tags: ['simulation-seed'],
    seed: {
      family: { name: 'FairnessFamily' },
      parents: [
        { name: 'Alice', role: 'MOTHER' },
        { name: 'Bob', role: 'FATHER' },
      ],
      children: [
        { name: 'Charlie', birthDate: '2019-05-20' },
        { name: 'Dana', birthDate: '2021-11-10' },
      ],
      fairnessLedger: [
        { parentName: 'Alice', nightDeviation: 3, weekendDeviation: 1, holidayDeviation: 0 },
        { parentName: 'Bob', nightDeviation: -3, weekendDeviation: -1, holidayDeviation: 0 },
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
    deterministicSeed: 'fairness-convergence',
    maxEventsPerStep: 5,
    enableBaselineSolveAtStart: true,
    enableRepairOnOverlay: true,
    enableProposalGeneration: false,
    autoAcceptStrategy: 'FIRST',
  },
  personas: [
    { parentName: 'Alice', personaType: 'FLEXIBLE_CO_PARENT' },
    { parentName: 'Bob', personaType: 'FLEXIBLE_CO_PARENT' },
  ],
  eventPolicies: [
    { policyType: 'DISRUPTION_GENERATION', enabled: true },
    { policyType: 'SWAP_REQUEST_GENERATION', enabled: false },
    { policyType: 'CALENDAR_EVENT_GENERATION', enabled: false },
    { policyType: 'FAIRNESS_ADJUSTMENT_GENERATION', enabled: false },
  ],
  expectations: [
    {
      type: 'FAIRNESS_CONVERGENCE',
      finalDeviationLTE: 5,
    },
  ],
};
