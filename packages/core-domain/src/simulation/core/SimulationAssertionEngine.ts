import {
  SimulationExpectation,
  SimulationMetricSnapshot,
  SimulationAggregateMetrics,
  SimulationAssertionResult,
  SimulationMetricBoundExpectation,
  SimulationFairnessConvergenceExpectation,
  SimulationCalmnessExpectation,
} from '../types';

/**
 * Evaluates simulation expectations against collected metrics.
 * DETERMINISM expectations are handled separately by SimulationDeterminismRunner.
 */
export class SimulationAssertionEngine {
  evaluate(input: {
    expectations: SimulationExpectation[];
    metricSnapshots: SimulationMetricSnapshot[];
    aggregates: SimulationAggregateMetrics;
  }): SimulationAssertionResult[] {
    const results: SimulationAssertionResult[] = [];
    const { expectations, metricSnapshots, aggregates } = input;

    for (const expectation of expectations) {
      if (expectation.type === 'DETERMINISM') {
        // Handled by DeterminismRunner, skip
        continue;
      }

      switch (expectation.type) {
        case 'METRIC_BOUND':
          results.push(this.evaluateMetricBound(expectation, metricSnapshots, aggregates));
          break;
        case 'FAIRNESS_CONVERGENCE':
          results.push(this.evaluateFairnessConvergence(expectation, aggregates));
          break;
        case 'CALMNESS':
          results.push(this.evaluateCalmness(expectation, aggregates));
          break;
      }
    }

    return results;
  }

  private evaluateMetricBound(
    expectation: SimulationMetricBoundExpectation,
    snapshots: SimulationMetricSnapshot[],
    aggregates: SimulationAggregateMetrics,
  ): SimulationAssertionResult {
    const metricKey = expectation.metric;
    const aggregateKey = `max${metricKey.charAt(0).toUpperCase()}${metricKey.slice(1)}` as keyof SimulationAggregateMetrics;
    const actualValue = (aggregates as any)[aggregateKey] ?? this.getLastSnapshotValue(snapshots, metricKey);

    let passed: boolean;
    if (expectation.operator === 'LTE') {
      passed = actualValue <= expectation.value;
    } else {
      passed = actualValue >= expectation.value;
    }

    return {
      expectationType: 'METRIC_BOUND',
      passed,
      message: passed
        ? `${metricKey} ${expectation.operator} ${expectation.value}: actual=${actualValue}`
        : `FAILED: ${metricKey} expected ${expectation.operator} ${expectation.value} but was ${actualValue}`,
      details: { metric: metricKey, operator: expectation.operator, expected: expectation.value, actual: actualValue },
    };
  }

  private evaluateFairnessConvergence(
    expectation: SimulationFairnessConvergenceExpectation,
    aggregates: SimulationAggregateMetrics,
  ): SimulationAssertionResult {
    const actual = aggregates.finalFairnessDeviationMagnitude;
    const passed = actual <= expectation.finalDeviationLTE;

    return {
      expectationType: 'FAIRNESS_CONVERGENCE',
      passed,
      message: passed
        ? `Fairness converged: final deviation ${actual} <= ${expectation.finalDeviationLTE}`
        : `FAILED: Fairness did not converge: final deviation ${actual} > ${expectation.finalDeviationLTE}`,
      details: { finalDeviation: actual, threshold: expectation.finalDeviationLTE },
    };
  }

  private evaluateCalmness(
    expectation: SimulationCalmnessExpectation,
    aggregates: SimulationAggregateMetrics,
  ): SimulationAssertionResult {
    const churnOk = aggregates.maxScheduleChurnRate <= expectation.maxChurnRate;
    const transitionOk = aggregates.averageTransitionCount <= expectation.maxAverageTransitions;
    const passed = churnOk && transitionOk;

    return {
      expectationType: 'CALMNESS',
      passed,
      message: passed
        ? `Calmness check passed: churn=${aggregates.maxScheduleChurnRate}, transitions=${aggregates.averageTransitionCount}`
        : `FAILED: Calmness violated: churn=${aggregates.maxScheduleChurnRate} (max ${expectation.maxChurnRate}), transitions=${aggregates.averageTransitionCount} (max ${expectation.maxAverageTransitions})`,
      details: {
        maxChurnRate: aggregates.maxScheduleChurnRate,
        maxChurnThreshold: expectation.maxChurnRate,
        avgTransitions: aggregates.averageTransitionCount,
        maxTransitionsThreshold: expectation.maxAverageTransitions,
      },
    };
  }

  private getLastSnapshotValue(snapshots: SimulationMetricSnapshot[], key: string): number {
    if (snapshots.length === 0) return 0;
    return (snapshots[snapshots.length - 1] as any)[key] ?? 0;
  }
}
