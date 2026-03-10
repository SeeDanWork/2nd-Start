import {
  SimulationStepResult,
  SimulationMetricSnapshot,
  SimulationAssertionResult,
  SimulationAggregateMetrics,
  SimulationReport,
} from '../types';

/**
 * Builds a structured simulation report from execution results.
 */
export class SimulationReportBuilder {
  buildReport(input: {
    simulationId: string;
    stepResults: SimulationStepResult[];
    metricSnapshots: SimulationMetricSnapshot[];
    assertionResults: SimulationAssertionResult[];
    aggregates: SimulationAggregateMetrics;
  }): SimulationReport {
    const { simulationId, stepResults, metricSnapshots, assertionResults, aggregates } = input;

    const passedAssertions = assertionResults.filter(a => a.passed).length;
    const failedAssertions = assertionResults.filter(a => !a.passed).length;

    return {
      simulationId,
      generatedAt: new Date().toISOString(),
      summary: {
        passed: failedAssertions === 0,
        stepCount: stepResults.length,
        metricSnapshotCount: metricSnapshots.length,
        assertionCount: assertionResults.length,
        passedAssertions,
        failedAssertions,
      },
      aggregates,
      artifacts: [
        {
          type: 'STEP_SUMMARY',
          data: {
            totalSteps: stepResults.length,
            successfulSteps: stepResults.filter(s => s.status === 'SUCCESS').length,
            failedSteps: stepResults.filter(s => s.status === 'FAILED').length,
            totalEventsGenerated: stepResults.reduce((sum, s) => sum + s.generatedEvents.length, 0),
          },
        },
        {
          type: 'METRIC_TIMELINE',
          data: {
            dates: metricSnapshots.map(s => s.date),
            churnRates: metricSnapshots.map(s => s.scheduleChurnRate),
            fairnessDeviations: metricSnapshots.map(s => s.fairnessDeviationMagnitude),
            transitionCounts: metricSnapshots.map(s => s.averageTransitionCount),
          },
        },
        {
          type: 'ASSERTION_RESULTS',
          data: {
            results: assertionResults.map(a => ({
              type: a.expectationType,
              passed: a.passed,
              message: a.message,
            })),
          },
        },
      ],
    };
  }
}
