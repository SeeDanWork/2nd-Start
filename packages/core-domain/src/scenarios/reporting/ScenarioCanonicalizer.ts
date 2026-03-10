import { ScenarioExecutionResult } from '../types';

/**
 * Converts execution results into a stable comparable representation.
 * All outputs are sorted deterministically, volatile data is normalized.
 */
export class ScenarioCanonicalizer {
  canonicalize(result: ScenarioExecutionResult): Record<string, unknown> {
    return {
      scenarioId: result.scenarioId,
      passed: result.passed,
      steps: result.stepResults.map(s => ({
        stepId: s.stepId,
        stepType: s.stepType,
        status: s.status,
        // Canonicalize outputs: sort arrays, normalize volatile fields
        outputs: this.canonicalizeOutputs(s.outputs),
        error: s.error ? { code: s.error.code, message: s.error.message } : undefined,
      })),
      assertions: result.assertionResults
        .map(a => ({
          expectationType: a.expectationType,
          passed: a.passed,
          message: a.message,
        }))
        .sort((a, b) =>
          a.expectationType.localeCompare(b.expectationType) ||
          a.message.localeCompare(b.message),
        ),
      reportSummary: {
        stepCount: result.report.summary.stepCount,
        assertionCount: result.report.summary.assertionCount,
        passedAssertions: result.report.summary.passedAssertions,
        failedAssertions: result.report.summary.failedAssertions,
      },
    };
  }

  private canonicalizeOutputs(outputs: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(outputs).sort(([a], [b]) => a.localeCompare(b))) {
      if (Array.isArray(value)) {
        // Sort string arrays for stability
        if (value.length > 0 && typeof value[0] === 'string') {
          result[key] = [...value].sort();
        } else {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
