import { describe, it, expect } from 'vitest';
import { SimulationRunner } from '../core/SimulationRunner';

import { fixture as structuredFixture } from '../fixtures/builtins/structured_co_parents_14_day';
import { fixture as highConflictFixture } from '../fixtures/builtins/high_conflict_14_day';
import { fixture as logisticsFixture } from '../fixtures/builtins/logistics_heavy_14_day';
import { fixture as fairnessFixture } from '../fixtures/builtins/gradual_fairness_restitution_under_disruption';
import { fixture as cohesionFixture } from '../fixtures/builtins/sibling_cohesion_under_stress';

describe('Built-in Simulations', () => {
  const runner = new SimulationRunner();

  it('structured_co_parents_14_day passes', async () => {
    const result = await runner.runSimulation(structuredFixture);
    expect(result.simulationId).toBe('structured_co_parents_14_day');
    expect(result.stepResults.length).toBe(14);
    expect(result.metricSnapshots.length).toBe(14);
    expect(result.passed).toBe(true);
    expect(result.report.summary.failedAssertions).toBe(0);
  }, 60000);

  it('high_conflict_14_day passes', async () => {
    const result = await runner.runSimulation(highConflictFixture);
    expect(result.simulationId).toBe('high_conflict_14_day');
    expect(result.stepResults.length).toBe(14);
    expect(result.passed).toBe(true);
  }, 60000);

  it('logistics_heavy_14_day passes', async () => {
    const result = await runner.runSimulation(logisticsFixture);
    expect(result.simulationId).toBe('logistics_heavy_14_day');
    expect(result.stepResults.length).toBe(14);
    expect(result.passed).toBe(true);
  }, 60000);

  it('gradual_fairness_restitution_under_disruption passes', async () => {
    const result = await runner.runSimulation(fairnessFixture);
    expect(result.simulationId).toBe('gradual_fairness_restitution_under_disruption');
    expect(result.stepResults.length).toBe(14);
    expect(result.passed).toBe(true);
  }, 60000);

  it('sibling_cohesion_under_stress passes', async () => {
    const result = await runner.runSimulation(cohesionFixture);
    expect(result.simulationId).toBe('sibling_cohesion_under_stress');
    expect(result.stepResults.length).toBe(14);
    expect(result.passed).toBe(true);
  }, 60000);

  it('structured simulation is deterministic across 2 runs', async () => {
    const r1 = await runner.runSimulation(structuredFixture);
    const r2 = await runner.runSimulation(structuredFixture);
    expect(r1.metricSnapshots).toEqual(r2.metricSnapshots);
    expect(r1.stepResults.map(s => s.generatedEvents))
      .toEqual(r2.stepResults.map(s => s.generatedEvents));
  }, 60000);
});
