import { describe, it, expect } from 'vitest';
import { ScenarioCanonicalizer } from '../reporting/ScenarioCanonicalizer';
import { ScenarioExecutionResult } from '../types';

const canonicalizer = new ScenarioCanonicalizer();

function makeResult(overrides: Partial<ScenarioExecutionResult> = {}): ScenarioExecutionResult {
  return {
    scenarioId: 'test',
    passed: true,
    stepResults: [
      { stepId: 'step-1', stepType: 'SOLVE_BASELINE', status: 'SUCCESS', outputs: { candidateCount: 3 } },
    ],
    assertionResults: [
      { expectationType: 'ACTIVE_SCHEDULE', passed: true, message: 'OK' },
    ],
    report: {
      scenarioId: 'test',
      generatedAt: '2026-03-09T00:00:00Z',
      summary: { passed: true, stepCount: 1, assertionCount: 1, passedAssertions: 1, failedAssertions: 0 },
      artifacts: [],
    },
    ...overrides,
  };
}

describe('ScenarioCanonicalizer', () => {
  it('canonical output is stable across calls', () => {
    const result = makeResult();
    const c1 = canonicalizer.canonicalize(result);
    const c2 = canonicalizer.canonicalize(result);
    expect(JSON.stringify(c1)).toBe(JSON.stringify(c2));
  });

  it('strips volatile timestamps from report summary', () => {
    const canonical = canonicalizer.canonicalize(makeResult());
    // generatedAt should not appear in canonical summary
    expect((canonical as any).reportSummary.generatedAt).toBeUndefined();
  });

  it('sorts assertions deterministically', () => {
    const result = makeResult({
      assertionResults: [
        { expectationType: 'PROPOSAL_COUNT', passed: true, message: 'OK' },
        { expectationType: 'ACTIVE_SCHEDULE', passed: true, message: 'OK' },
      ],
    });
    const canonical = canonicalizer.canonicalize(result);
    const types = (canonical.assertions as any[]).map((a: any) => a.expectationType);
    expect(types).toEqual(['ACTIVE_SCHEDULE', 'PROPOSAL_COUNT']);
  });
});
