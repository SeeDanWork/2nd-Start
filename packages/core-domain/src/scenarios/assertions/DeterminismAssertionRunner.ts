import {
  ScenarioAssertionResult,
  ScenarioFixture,
  ScenarioExecutionResult,
} from '../types';
import { ScenarioCanonicalizer } from '../reporting/ScenarioCanonicalizer';

export interface DeterminismRunnerDeps {
  /** Callback that runs a scenario and returns the result */
  runScenario: (fixture: ScenarioFixture) => Promise<ScenarioExecutionResult>;
}

/**
 * Reruns a scenario N times and compares canonicalized outputs
 * to verify determinism.
 */
export class DeterminismAssertionRunner {
  private readonly canonicalizer = new ScenarioCanonicalizer();

  constructor(private readonly deps: DeterminismRunnerDeps) {}

  async assertDeterminism(input: {
    fixture: ScenarioFixture;
    rerunCount: number;
  }): Promise<ScenarioAssertionResult> {
    const { fixture, rerunCount } = input;
    const canonicalOutputs: string[] = [];

    for (let i = 0; i < rerunCount; i++) {
      const result = await this.deps.runScenario(fixture);
      const canonical = JSON.stringify(this.canonicalizer.canonicalize(result));
      canonicalOutputs.push(canonical);
    }

    // Compare all outputs to the first
    const reference = canonicalOutputs[0];
    const divergences: number[] = [];

    for (let i = 1; i < canonicalOutputs.length; i++) {
      if (canonicalOutputs[i] !== reference) {
        divergences.push(i + 1); // 1-indexed run number
      }
    }

    if (divergences.length === 0) {
      return {
        expectationType: 'DETERMINISM',
        passed: true,
        message: `All ${rerunCount} reruns produced identical canonical output`,
      };
    }

    return {
      expectationType: 'DETERMINISM',
      passed: false,
      message: `Determinism check failed: runs ${divergences.join(', ')} diverged from run 1`,
      details: { divergentRuns: divergences, totalRuns: rerunCount },
    };
  }
}
