#!/usr/bin/env node
/**
 * Generate golden fixture JSON files for all 51 scenarios.
 * Output: tests/golden/<number>-<key>.json
 *
 * Usage: npx tsx tests/generate-golden.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { scenarioList } from '../src/scenarios';
import { simulate } from '../src/runner';

const goldenDir = path.join(__dirname, 'golden');

// Ensure golden directory exists
if (!fs.existsSync(goldenDir)) {
  fs.mkdirSync(goldenDir, { recursive: true });
}

console.log(`Generating golden fixtures for ${scenarioList.length} scenarios...\n`);

let successCount = 0;
let errorCount = 0;

for (const scenario of scenarioList) {
  const num = String(scenario.number).padStart(2, '0');
  const filename = `${num}-${scenario.key}.json`;
  const filepath = path.join(goldenDir, filename);

  try {
    const transcript = simulate(scenario);
    const golden = {
      _generated: '2026-02-21T00:00:00.000Z',
      _generator: 'generate-golden.ts',
      scenario: transcript.scenario,
      params: transcript.params,
      messages: transcript.validatedMessages,
      stateTransitions: Object.keys(transcript.stateTransitions),
      timeoutMessages: transcript.timeoutResult?.outgoingMessages ?? null,
      errors: transcript.errors,
    };

    fs.writeFileSync(filepath, JSON.stringify(golden, null, 2) + '\n');
    const status = scenario.implemented ? '✓' : '○';
    console.log(`  ${status} ${filename}`);
    successCount++;
  } catch (err) {
    console.error(`  ✗ ${filename}: ${(err as Error).message}`);
    errorCount++;
  }
}

console.log(`\nDone: ${successCount} generated, ${errorCount} errors.`);

if (errorCount > 0) {
  process.exit(1);
}
