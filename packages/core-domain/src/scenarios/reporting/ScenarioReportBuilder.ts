import {
  ScenarioReport,
  ScenarioStepResult,
  ScenarioAssertionResult,
} from '../types';

/**
 * Builds a deterministic ScenarioReport from step and assertion results.
 */
export class ScenarioReportBuilder {
  buildReport(input: {
    scenarioId: string;
    stepResults: ScenarioStepResult[];
    assertionResults: ScenarioAssertionResult[];
    generatedAt: string;
  }): ScenarioReport {
    const { scenarioId, stepResults, assertionResults, generatedAt } = input;

    const passedAssertions = assertionResults.filter(a => a.passed).length;
    const failedAssertions = assertionResults.filter(a => !a.passed).length;
    const allStepsSucceeded = stepResults.every(s => s.status === 'SUCCESS');

    return {
      scenarioId,
      generatedAt,
      summary: {
        passed: allStepsSucceeded && failedAssertions === 0,
        stepCount: stepResults.length,
        assertionCount: assertionResults.length,
        passedAssertions,
        failedAssertions,
      },
      artifacts: [
        {
          type: 'SEEDED_STATE_SUMMARY',
          data: {
            stepCount: stepResults.length,
            successfulSteps: stepResults.filter(s => s.status === 'SUCCESS').length,
            failedSteps: stepResults.filter(s => s.status === 'FAILED').length,
          },
        },
        {
          type: 'STEP_OUTPUT_SUMMARY',
          data: Object.fromEntries(
            stepResults.map(s => [s.stepId, { type: s.stepType, status: s.status }]),
          ),
        },
        {
          type: 'ASSERTION_SUMMARY',
          data: {
            total: assertionResults.length,
            passed: passedAssertions,
            failed: failedAssertions,
            details: assertionResults.map(a => ({
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
