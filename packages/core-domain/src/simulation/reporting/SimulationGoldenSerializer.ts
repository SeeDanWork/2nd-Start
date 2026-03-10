import * as fs from 'fs';
import * as path from 'path';
import { SimulationExecutionResult } from '../types';
import { SimulationCanonicalizer } from './SimulationCanonicalizer';
import { SimulationGoldenMismatchError } from '../errors';

const canonicalizer = new SimulationCanonicalizer();

/**
 * Serializes simulation results to golden files and compares against stored baselines.
 */
export class SimulationGoldenSerializer {
  serialize(result: SimulationExecutionResult): string {
    const canonical = canonicalizer.canonicalize(result);
    return JSON.stringify(canonical, null, 2);
  }

  writeGolden(result: SimulationExecutionResult, goldenDir: string): string {
    const filePath = path.join(goldenDir, `${result.simulationId}.golden.json`);
    const content = this.serialize(result);
    fs.mkdirSync(goldenDir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  readGolden(simulationId: string, goldenDir: string): string | null {
    const filePath = path.join(goldenDir, `${simulationId}.golden.json`);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  }

  compareToGolden(result: SimulationExecutionResult, goldenDir: string): {
    matches: boolean;
    diff?: string[];
  } {
    const golden = this.readGolden(result.simulationId, goldenDir);
    if (!golden) {
      throw new SimulationGoldenMismatchError(
        `No golden file found for simulation: ${result.simulationId}`,
      );
    }

    const current = this.serialize(result);
    if (current === golden) return { matches: true };

    // Line-by-line diff
    const goldenLines = golden.split('\n');
    const currentLines = current.split('\n');
    const diffs: string[] = [];

    const maxLines = Math.max(goldenLines.length, currentLines.length);
    for (let i = 0; i < maxLines; i++) {
      const g = goldenLines[i] ?? '<missing>';
      const c = currentLines[i] ?? '<missing>';
      if (g !== c) {
        diffs.push(`Line ${i + 1}: expected "${g}" got "${c}"`);
      }
    }

    return { matches: false, diff: diffs };
  }
}
