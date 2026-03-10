import { describe, it, expect } from 'vitest';
import { ScenarioGoldenSerializer } from '../reporting/ScenarioGoldenSerializer';
import { ScenarioExecutionResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const serializer = new ScenarioGoldenSerializer();

function makeResult(): ScenarioExecutionResult {
  return {
    scenarioId: 'golden-test',
    passed: true,
    stepResults: [
      { stepId: 's1', stepType: 'SOLVE_BASELINE', status: 'SUCCESS', outputs: {} },
    ],
    assertionResults: [
      { expectationType: 'ACTIVE_SCHEDULE', passed: true, message: 'OK' },
    ],
    report: {
      scenarioId: 'golden-test',
      generatedAt: '2026-03-09T00:00:00Z',
      summary: { passed: true, stepCount: 1, assertionCount: 1, passedAssertions: 1, failedAssertions: 0 },
      artifacts: [],
    },
  };
}

describe('ScenarioGoldenSerializer', () => {
  it('serializeCanonical produces stable JSON', () => {
    const s1 = serializer.serializeCanonical(makeResult());
    const s2 = serializer.serializeCanonical(makeResult());
    expect(s1).toBe(s2);
  });

  it('compareToGolden returns match when identical', async () => {
    const canonical = serializer.serializeCanonical(makeResult());
    const tmpDir = os.tmpdir();
    const goldenPath = path.join(tmpDir, 'scenario-golden-test.json');

    // Write golden
    fs.writeFileSync(goldenPath, canonical, 'utf-8');

    const comparison = await serializer.compareToGolden({ canonical, goldenPath });
    expect(comparison.matches).toBe(true);

    // Cleanup
    fs.unlinkSync(goldenPath);
  });

  it('compareToGolden returns diff on mismatch', async () => {
    const canonical = serializer.serializeCanonical(makeResult());
    const tmpDir = os.tmpdir();
    const goldenPath = path.join(tmpDir, 'scenario-golden-mismatch.json');

    // Write different golden
    fs.writeFileSync(goldenPath, '{"different": true}', 'utf-8');

    const comparison = await serializer.compareToGolden({ canonical, goldenPath });
    expect(comparison.matches).toBe(false);
    expect(comparison.diff).toBeDefined();

    // Cleanup
    fs.unlinkSync(goldenPath);
  });

  it('compareToGolden returns diff when golden file missing', async () => {
    const canonical = serializer.serializeCanonical(makeResult());
    const comparison = await serializer.compareToGolden({
      canonical,
      goldenPath: '/nonexistent/path/golden.json',
    });
    expect(comparison.matches).toBe(false);
    expect(comparison.diff).toContain('not found');
  });
});
