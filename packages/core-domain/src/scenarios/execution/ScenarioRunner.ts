import {
  ScenarioFixture,
  ScenarioExecutionResult,
  ScenarioStepResult,
  ScenarioAssertionResult,
} from '../types';
import { ScenarioFixtureValidator } from '../fixtures/ScenarioFixtureValidator';
import { ScenarioSeeder } from '../core/ScenarioSeeder';
import { ScenarioStepExecutor } from './ScenarioStepExecutor';
import { ScenarioAssertionEngine } from '../assertions/ScenarioAssertionEngine';
import { ScenarioReportBuilder } from '../reporting/ScenarioReportBuilder';

/**
 * Orchestrates a full scenario run: validate → seed → execute steps → assert → report.
 */
export class ScenarioRunner {
  private readonly validator = new ScenarioFixtureValidator();
  private readonly seeder = new ScenarioSeeder();
  private readonly stepExecutor = new ScenarioStepExecutor();
  private readonly assertionEngine = new ScenarioAssertionEngine();
  private readonly reportBuilder = new ScenarioReportBuilder();

  async runScenario(fixture: ScenarioFixture): Promise<ScenarioExecutionResult> {
    // 1. Validate fixture
    this.validator.validateFixture(fixture);

    // 2. Seed state
    const context = this.seeder.seedScenario(fixture);

    // 3. Execute steps in order
    const stepResults: ScenarioStepResult[] = [];
    for (const step of fixture.steps) {
      const result = await this.stepExecutor.executeStep({
        context,
        fixture,
        step,
      });
      stepResults.push(result);

      // Stop on failure to prevent cascading errors
      if (result.status === 'FAILED') {
        break;
      }
    }

    // 4. Evaluate expectations
    const assertionResults: ScenarioAssertionResult[] = await this.assertionEngine.evaluate({
      fixture,
      context,
    });

    // 5. Build report
    const generatedAt = new Date().toISOString();
    const report = this.reportBuilder.buildReport({
      scenarioId: fixture.scenarioId,
      stepResults,
      assertionResults,
      generatedAt,
    });

    return {
      scenarioId: fixture.scenarioId,
      passed: report.summary.passed,
      stepResults,
      assertionResults,
      report,
    };
  }
}
