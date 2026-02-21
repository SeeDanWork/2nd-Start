#!/usr/bin/env node
import { Command } from 'commander';
import { scenarioRegistry, scenarioList } from './scenarios';
import { simulate, formatTranscript } from './runner';

const program = new Command();

program
  .name('simulator')
  .description('Chat Brain Scenario Simulator')
  .version('1.0.0');

program
  .command('list')
  .description('List all scenarios')
  .option('-c, --category <category>', 'Filter by category')
  .option('--implemented', 'Show only implemented scenarios')
  .option('--stubs', 'Show only stub scenarios')
  .action((opts) => {
    let scenarios = scenarioList;

    if (opts.category) {
      const cat = opts.category.toUpperCase();
      scenarios = scenarios.filter((s) => s.category.toUpperCase() === cat);
    }
    if (opts.implemented) {
      scenarios = scenarios.filter((s) => s.implemented);
    }
    if (opts.stubs) {
      scenarios = scenarios.filter((s) => !s.implemented);
    }

    console.log(`\nScenarios (${scenarios.length}):\n`);
    const maxNum = 3;
    const maxKey = Math.max(...scenarios.map((s) => s.key.length));
    const maxTitle = Math.max(...scenarios.map((s) => s.title.length));

    for (const s of scenarios) {
      const status = s.implemented ? '✓' : '○';
      const num = String(s.number).padStart(maxNum);
      const key = s.key.padEnd(maxKey);
      console.log(`  ${status} ${num}. ${key}  ${s.title}`);
    }
    console.log(`\n  ✓ = implemented (${scenarios.filter((s) => s.implemented).length})  ○ = stub (${scenarios.filter((s) => !s.implemented).length})\n`);
  });

program
  .command('run <number>')
  .description('Run a scenario by number')
  .option('-p, --params <json>', 'JSON params override', '{}')
  .option('--json', 'Output as JSON instead of formatted text')
  .action((number, opts) => {
    const num = parseInt(number, 10);
    const scenario = scenarioRegistry.get(num);
    if (!scenario) {
      console.error(`Scenario #${num} not found. Use 'list' to see available scenarios.`);
      process.exit(1);
    }

    let params: Record<string, unknown> = {};
    try {
      params = JSON.parse(opts.params);
    } catch {
      console.error('Invalid JSON for --params');
      process.exit(1);
    }

    const transcript = simulate(scenario, params);

    if (opts.json) {
      console.log(JSON.stringify(transcript, null, 2));
    } else {
      console.log(formatTranscript(transcript));
    }

    if (transcript.errors.length > 0) {
      process.exit(1);
    }
  });

program
  .command('run-all')
  .description('Run all scenarios and report results')
  .option('--json', 'Output as JSON')
  .option('--implemented-only', 'Only run implemented scenarios')
  .action((opts) => {
    let scenarios = scenarioList;
    if (opts.implementedOnly) {
      scenarios = scenarios.filter((s) => s.implemented);
    }

    const results = scenarios.map((s) => simulate(s));
    const passed = results.filter((r) => r.errors.length === 0);
    const failed = results.filter((r) => r.errors.length > 0);

    if (opts.json) {
      console.log(JSON.stringify({ total: results.length, passed: passed.length, failed: failed.length, results }, null, 2));
    } else {
      console.log(`\nResults: ${passed.length}/${results.length} passed\n`);
      for (const r of results) {
        const status = r.errors.length === 0 ? '✓' : '✗';
        const impl = r.scenario.implemented ? '' : ' (stub)';
        console.log(`  ${status} #${String(r.scenario.number).padStart(2)}. ${r.scenario.title}${impl}`);
        for (const err of r.errors) {
          console.log(`      Error: ${err}`);
        }
      }
      if (failed.length > 0) {
        console.log(`\n  ${failed.length} scenario(s) had errors.\n`);
      } else {
        console.log(`\n  All scenarios passed.\n`);
      }
    }

    if (failed.length > 0) process.exit(1);
  });

program.parse();
