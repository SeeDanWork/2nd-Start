import { ScenarioExecutionResult } from '../types';
import { ScenarioCanonicalizer } from './ScenarioCanonicalizer';
import { ScenarioGoldenMismatchError } from '../errors';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Serializes canonical outputs to disk and compares against golden files.
 */
export class ScenarioGoldenSerializer {
  private readonly canonicalizer = new ScenarioCanonicalizer();

  serializeCanonical(result: ScenarioExecutionResult): string {
    const canonical = this.canonicalizer.canonicalize(result);
    return JSON.stringify(canonical, null, 2);
  }

  async compareToGolden(input: {
    canonical: string;
    goldenPath: string;
  }): Promise<{ matches: boolean; diff?: string }> {
    const { canonical, goldenPath } = input;

    let goldenContent: string;
    try {
      goldenContent = fs.readFileSync(goldenPath, 'utf-8');
    } catch {
      return {
        matches: false,
        diff: `Golden file not found: ${goldenPath}. Run with --update-golden to create.`,
      };
    }

    if (canonical === goldenContent) {
      return { matches: true };
    }

    // Produce diff-friendly output
    const canonicalLines = canonical.split('\n');
    const goldenLines = goldenContent.split('\n');
    const diffLines: string[] = [];

    const maxLines = Math.max(canonicalLines.length, goldenLines.length);
    for (let i = 0; i < maxLines; i++) {
      const cl = canonicalLines[i] ?? '';
      const gl = goldenLines[i] ?? '';
      if (cl !== gl) {
        diffLines.push(`Line ${i + 1}:`);
        diffLines.push(`  expected: ${gl}`);
        diffLines.push(`  actual:   ${cl}`);
      }
    }

    return {
      matches: false,
      diff: diffLines.join('\n'),
    };
  }

  writeGolden(goldenPath: string, canonical: string): void {
    const dir = path.dirname(goldenPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(goldenPath, canonical, 'utf-8');
  }
}
