import { SimulationFixture, SimulationAssertionResult } from '../types';
import { SimulationRunner } from './SimulationRunner';

/**
 * Reruns a simulation N times and compares canonicalized outputs for determinism.
 */
export class SimulationDeterminismRunner {
  async assertDeterminism(input: {
    fixture: SimulationFixture;
    rerunCount: number;
  }): Promise<SimulationAssertionResult> {
    const { fixture, rerunCount } = input;
    const runner = new SimulationRunner();
    const runs: string[] = [];

    for (let i = 0; i < rerunCount + 1; i++) {
      const result = await runner.runSimulation(fixture);
      const canonical = this.canonicalize(result);
      runs.push(canonical);
    }

    const baseline = runs[0];
    const mismatches: number[] = [];

    for (let i = 1; i < runs.length; i++) {
      if (runs[i] !== baseline) {
        mismatches.push(i);
      }
    }

    const passed = mismatches.length === 0;

    return {
      expectationType: 'DETERMINISM',
      passed,
      message: passed
        ? `Determinism verified across ${rerunCount + 1} runs`
        : `FAILED: Non-deterministic results in runs: ${mismatches.join(', ')}`,
      details: { totalRuns: rerunCount + 1, mismatchedRuns: mismatches },
    };
  }

  private canonicalize(result: any): string {
    const stripped = {
      stepResults: result.stepResults.map((s: any) => ({
        stepIndex: s.stepIndex,
        date: s.date,
        status: s.status,
        generatedEvents: s.generatedEvents,
        outputs: s.outputs,
      })),
      metricSnapshots: result.metricSnapshots,
      assertionResults: result.assertionResults.map((a: any) => ({
        expectationType: a.expectationType,
        passed: a.passed,
      })),
    };
    return JSON.stringify(stripped);
  }
}
