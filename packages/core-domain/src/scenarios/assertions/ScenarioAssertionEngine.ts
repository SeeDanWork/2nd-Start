import {
  ScenarioAssertionResult,
  ScenarioExecutionContext,
  ScenarioFixture,
} from '../types';
import { ScenarioExpectationEvaluator } from './ScenarioExpectationEvaluator';

/**
 * Evaluates all fixture expectations after scenario execution.
 */
export class ScenarioAssertionEngine {
  private readonly evaluator = new ScenarioExpectationEvaluator();

  async evaluate(input: {
    fixture: ScenarioFixture;
    context: ScenarioExecutionContext;
  }): Promise<ScenarioAssertionResult[]> {
    const results: ScenarioAssertionResult[] = [];

    // Evaluate expectations in deterministic order (by type, then index)
    for (const expectation of input.fixture.expectations) {
      if (expectation.type === 'DETERMINISM') {
        // Skip — handled separately by DeterminismAssertionRunner
        continue;
      }
      results.push(
        this.evaluator.evaluate(expectation, input.context, input.fixture),
      );
    }

    return results;
  }
}
