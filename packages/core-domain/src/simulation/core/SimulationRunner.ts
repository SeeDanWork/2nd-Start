import {
  SimulationFixture,
  SimulationExecutionContext,
  SimulationExecutionResult,
  SimulationStepResult,
  SimulationMetricSnapshot,
  SimulationAssertionResult,
} from '../types';
import { SimulationExecutionError } from '../errors';
import { SimulationClock } from './SimulationClock';
import { SimulationStepExecutor } from './SimulationStepExecutor';
import { SimulationEventGenerator } from '../events/SimulationEventGenerator';
import { SimulationMetricCollector } from '../metrics/SimulationMetricCollector';
import { SimulationAggregateMetricBuilder } from '../metrics/SimulationAggregateMetricBuilder';
import { SimulationAssertionEngine } from './SimulationAssertionEngine';
import { SimulationReportBuilder } from '../reporting/SimulationReportBuilder';

// Reuse Phase 11 infrastructure for seed scenario execution
import { ScenarioSeeder } from '../../scenarios/core/ScenarioSeeder';
import { ScenarioFixtureValidator } from '../../scenarios/fixtures/ScenarioFixtureValidator';
import { ScenarioStepExecutor } from '../../scenarios/execution/ScenarioStepExecutor';

const clock = new SimulationClock();
const simStepExecutor = new SimulationStepExecutor();
const eventGenerator = new SimulationEventGenerator();
const metricCollector = new SimulationMetricCollector();
const aggregateBuilder = new SimulationAggregateMetricBuilder();
const assertionEngine = new SimulationAssertionEngine();
const reportBuilder = new SimulationReportBuilder();
const scenarioValidator = new ScenarioFixtureValidator();
const scenarioSeeder = new ScenarioSeeder();
const scenarioStepExecutor = new ScenarioStepExecutor();

/**
 * Orchestrates full simulation execution:
 * 1. Seed + execute scenario steps to establish baseline (capturing final context)
 * 2. Build daily step sequence
 * 3. Generate + execute events per step
 * 4. Collect metrics per step
 * 5. Evaluate expectations
 * 6. Build report
 */
export class SimulationRunner {
  async runSimulation(fixture: SimulationFixture): Promise<SimulationExecutionResult> {
    const { config, seedScenario } = fixture;

    // 1. Validate and seed the scenario, then run its steps to get final context
    scenarioValidator.validateFixture(seedScenario);
    const scenarioContext = scenarioSeeder.seedScenario(seedScenario);

    // Execute each seed scenario step to build up the baseline state
    for (const step of seedScenario.steps) {
      const result = await scenarioStepExecutor.executeStep({
        context: scenarioContext,
        fixture: seedScenario,
        step,
      });
      if (result.status === 'FAILED') {
        throw new SimulationExecutionError(
          `Seed scenario step '${step.stepId}' failed: ${result.error?.message}`,
        );
      }
    }

    // Build simulation context from the final scenario state
    const context: SimulationExecutionContext = {
      familyId: scenarioContext.familyId,
      parentIdsByName: scenarioContext.parentIdsByName,
      childIdsByName: scenarioContext.childIdsByName,
      activeScheduleVersionId: scenarioContext.activeScheduleVersionId,
      activeScheduleNights: scenarioContext.activeScheduleNights,
      activeScheduleExchanges: scenarioContext.activeScheduleExchanges,
      activeWindowStart: scenarioContext.activeWindowStart,
      activeWindowEnd: scenarioContext.activeWindowEnd,
      appliedOverlays: [],
      proposals: [],
      fairnessLedger: scenarioContext.fairnessLedger,
      calendarEvents: scenarioContext.calendarEvents ?? [],
      resolvedOverlayCount: 0,
      scheduleVersionNumber: scenarioContext.scheduleVersionNumber,
      previousScheduleNights: undefined,
      totalChurnedNights: 0,
      totalStepsWithSchedule: 0,
    };

    // Verify baseline exists if required
    if (config.enableBaselineSolveAtStart && context.activeScheduleNights.length === 0) {
      throw new SimulationExecutionError(
        'enableBaselineSolveAtStart is true but seed scenario did not produce a schedule',
      );
    }

    // 2. Build daily steps
    const steps = clock.buildSteps({
      startDate: config.startDate,
      endDate: config.endDate,
      granularity: config.stepGranularity,
    });
    const stepResults: SimulationStepResult[] = [];
    const metricSnapshots: SimulationMetricSnapshot[] = [];

    // 3. Execute each step
    for (const step of steps) {
      // Generate events for this day
      const generatedEvents = eventGenerator.generateStepEvents({
        step,
        fixture,
        context: {
          familyId: context.familyId,
          parentIdsByName: context.parentIdsByName,
          childIdsByName: context.childIdsByName,
          activeScheduleVersionId: context.activeScheduleVersionId,
        },
      });

      // Execute events
      const result = await simStepExecutor.executeStep({
        step,
        generatedEvents,
        fixture,
        context,
      });

      stepResults.push(result);

      // Track schedule presence
      if (context.activeScheduleNights.length > 0) {
        context.totalStepsWithSchedule++;
      }

      // 4. Collect metrics
      const snapshot = metricCollector.collectSnapshot({ date: step.date, context });
      metricSnapshots.push(snapshot);

      // Clear previous schedule after metric collection
      context.previousScheduleNights = undefined;
    }

    // 5. Build aggregates
    const aggregates = aggregateBuilder.buildAggregates(metricSnapshots);

    // 6. Evaluate expectations
    const assertionResults: SimulationAssertionResult[] = assertionEngine.evaluate({
      expectations: fixture.expectations ?? [],
      metricSnapshots,
      aggregates,
    });

    // 7. Build report
    const report = reportBuilder.buildReport({
      simulationId: fixture.simulationId,
      stepResults,
      metricSnapshots,
      assertionResults,
      aggregates,
    });

    const passed = assertionResults.length === 0 || assertionResults.every(a => a.passed);

    return {
      simulationId: fixture.simulationId,
      passed,
      stepResults,
      metricSnapshots,
      assertionResults,
      report,
    };
  }
}
