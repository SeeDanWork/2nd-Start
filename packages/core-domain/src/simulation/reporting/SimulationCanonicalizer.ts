import { SimulationExecutionResult } from '../types';

/**
 * Strips volatile timestamps and normalizes outputs for stable comparison.
 */
export class SimulationCanonicalizer {
  canonicalize(result: SimulationExecutionResult): Record<string, unknown> {
    return {
      simulationId: result.simulationId,
      passed: result.passed,
      stepResults: result.stepResults.map(s => ({
        stepIndex: s.stepIndex,
        date: s.date,
        status: s.status,
        generatedEvents: s.generatedEvents,
        outputs: this.stripTimestamps(s.outputs),
      })),
      metricSnapshots: result.metricSnapshots,
      assertionResults: result.assertionResults.map(a => ({
        expectationType: a.expectationType,
        passed: a.passed,
        message: a.message,
      })),
      aggregates: result.report.aggregates,
    };
  }

  private stripTimestamps(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'createdAt' || key === 'updatedAt' || key === 'generatedAt') continue;
      result[key] = value;
    }
    return result;
  }
}
