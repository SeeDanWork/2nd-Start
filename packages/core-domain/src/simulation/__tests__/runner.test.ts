import { describe, it, expect } from 'vitest';
import { SimulationRunner } from '../core/SimulationRunner';
import { SimulationFixture } from '../types';

describe('SimulationRunner', () => {
  const runner = new SimulationRunner();

  const minimalFixture: SimulationFixture = {
    simulationId: 'test-runner-minimal',
    label: 'Minimal runner test',
    seedScenario: {
      scenarioId: 'runner-seed',
      label: 'Runner seed scenario',
      tags: ['test'],
      seed: {
        family: { name: 'RunnerFamily' },
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
          windowEnd: '2026-03-15',
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
      endDate: '2026-03-11',
      stepGranularity: 'DAY',
      deterministicSeed: 'runner-test',
      maxEventsPerStep: 3,
      enableBaselineSolveAtStart: true,
      enableRepairOnOverlay: false,
      enableProposalGeneration: false,
      autoAcceptStrategy: 'NONE',
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
    expectations: [],
  };

  it('completes a minimal simulation run', async () => {
    const result = await runner.runSimulation(minimalFixture);
    expect(result.simulationId).toBe('test-runner-minimal');
    expect(result.stepResults.length).toBe(3); // 3 days: Mar 9, 10, 11
    expect(result.metricSnapshots.length).toBe(3);
    expect(result.report).toBeDefined();
    expect(result.report.summary.stepCount).toBe(3);
  }, 30000);

  it('produces deterministic results across runs', async () => {
    const result1 = await runner.runSimulation(minimalFixture);
    const result2 = await runner.runSimulation(minimalFixture);

    // Compare step results (excluding timestamps)
    expect(result1.stepResults.map(s => ({ stepIndex: s.stepIndex, date: s.date, status: s.status })))
      .toEqual(result2.stepResults.map(s => ({ stepIndex: s.stepIndex, date: s.date, status: s.status })));

    // Compare metric snapshots
    expect(result1.metricSnapshots).toEqual(result2.metricSnapshots);
  }, 30000);

  it('evaluates expectations in report', async () => {
    const fixtureWithExpectation: SimulationFixture = {
      ...minimalFixture,
      simulationId: 'test-runner-expectations',
      expectations: [
        { type: 'CALMNESS', maxChurnRate: 1.0, maxAverageTransitions: 20 },
      ],
    };
    const result = await runner.runSimulation(fixtureWithExpectation);
    expect(result.assertionResults.length).toBe(1);
    expect(result.assertionResults[0].expectationType).toBe('CALMNESS');
  }, 30000);
});
