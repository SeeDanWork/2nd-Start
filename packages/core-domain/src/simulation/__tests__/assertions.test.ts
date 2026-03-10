import { describe, it, expect } from 'vitest';
import { SimulationAssertionEngine } from '../core/SimulationAssertionEngine';
import { SimulationAggregateMetrics, SimulationMetricSnapshot } from '../types';

const engine = new SimulationAssertionEngine();

const snapshot: SimulationMetricSnapshot = {
  date: '2026-03-10',
  scheduleChurnRate: 0.3,
  averageTransitionCount: 4,
  fairnessDeviationMagnitude: 2,
  siblingDivergenceRate: 0.1,
  disruptionRecoveryOpenCount: 0,
  pendingProposalCount: 1,
};

const aggregates: SimulationAggregateMetrics = {
  maxScheduleChurnRate: 0.5,
  averageScheduleChurnRate: 0.3,
  maxTransitionCount: 6,
  averageTransitionCount: 4,
  maxFairnessDeviationMagnitude: 3,
  finalFairnessDeviationMagnitude: 2,
  maxSiblingDivergenceRate: 0.2,
  averagePendingProposalCount: 0.5,
};

describe('SimulationAssertionEngine', () => {
  it('passes METRIC_BOUND LTE when within bound', () => {
    const results = engine.evaluate({
      expectations: [
        { type: 'METRIC_BOUND', metric: 'scheduleChurnRate', operator: 'LTE', value: 1.0 },
      ],
      metricSnapshots: [snapshot],
      aggregates,
    });
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(true);
  });

  it('fails METRIC_BOUND LTE when exceeds bound', () => {
    const results = engine.evaluate({
      expectations: [
        { type: 'METRIC_BOUND', metric: 'scheduleChurnRate', operator: 'LTE', value: 0.1 },
      ],
      metricSnapshots: [snapshot],
      aggregates,
    });
    expect(results[0].passed).toBe(false);
  });

  it('passes FAIRNESS_CONVERGENCE when deviation is low', () => {
    const results = engine.evaluate({
      expectations: [
        { type: 'FAIRNESS_CONVERGENCE', finalDeviationLTE: 5 },
      ],
      metricSnapshots: [snapshot],
      aggregates,
    });
    expect(results[0].passed).toBe(true);
  });

  it('fails FAIRNESS_CONVERGENCE when deviation exceeds threshold', () => {
    const results = engine.evaluate({
      expectations: [
        { type: 'FAIRNESS_CONVERGENCE', finalDeviationLTE: 1 },
      ],
      metricSnapshots: [snapshot],
      aggregates,
    });
    expect(results[0].passed).toBe(false);
  });

  it('passes CALMNESS when within bounds', () => {
    const results = engine.evaluate({
      expectations: [
        { type: 'CALMNESS', maxChurnRate: 1.0, maxAverageTransitions: 10 },
      ],
      metricSnapshots: [snapshot],
      aggregates,
    });
    expect(results[0].passed).toBe(true);
  });

  it('fails CALMNESS when churn exceeds threshold', () => {
    const results = engine.evaluate({
      expectations: [
        { type: 'CALMNESS', maxChurnRate: 0.1, maxAverageTransitions: 10 },
      ],
      metricSnapshots: [snapshot],
      aggregates,
    });
    expect(results[0].passed).toBe(false);
  });

  it('skips DETERMINISM expectations', () => {
    const results = engine.evaluate({
      expectations: [
        { type: 'DETERMINISM', rerunCount: 3 },
      ],
      metricSnapshots: [snapshot],
      aggregates,
    });
    expect(results).toHaveLength(0);
  });
});
