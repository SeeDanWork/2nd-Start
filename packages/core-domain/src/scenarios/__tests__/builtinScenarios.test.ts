import { describe, it, expect } from 'vitest';
import { ScenarioRunner } from '../execution/ScenarioRunner';
import { ScenarioCanonicalizer } from '../reporting/ScenarioCanonicalizer';
import {
  baselineEvenSplit,
  siblingCohesion,
  schoolClosureRepair,
  weekendFairness,
  calendarSchool,
  policyMinBlock,
  staleProposal,
} from '../fixtures/builtins';

const runner = new ScenarioRunner();
const canonicalizer = new ScenarioCanonicalizer();

describe('Built-in Scenarios', () => {
  it('baseline_even_split_single_child runs and passes', async () => {
    const result = await runner.runScenario(baselineEvenSplit);
    expect(result.passed).toBe(true);
    expect(result.stepResults.every(s => s.status === 'SUCCESS')).toBe(true);
  });

  it('sibling_cohesion_two_children runs and passes', async () => {
    const result = await runner.runScenario(siblingCohesion);
    expect(result.passed).toBe(true);
  });

  it('school_closure_overlay_repair runs and passes', async () => {
    const result = await runner.runScenario(schoolClosureRepair);
    expect(result.passed).toBe(true);
    const overlayAssertion = result.assertionResults.find(
      a => a.expectationType === 'OVERLAY_RESOLUTION',
    );
    expect(overlayAssertion?.passed).toBe(true);
  });

  it('weekend_fairness_restitution runs and passes', async () => {
    const result = await runner.runScenario(weekendFairness);
    expect(result.passed).toBe(true);
  });

  it('calendar_school_event_hard_constraint runs and passes', async () => {
    const result = await runner.runScenario(calendarSchool);
    expect(result.passed).toBe(true);
  });

  it('policy_min_block_length_enforced runs and passes', async () => {
    const result = await runner.runScenario(policyMinBlock);
    expect(result.passed).toBe(true);
  });

  it('stale_proposal_rejected runs and passes', async () => {
    const result = await runner.runScenario(staleProposal);
    expect(result.passed).toBe(true);
  });

  it('repeated execution yields identical canonical output', async () => {
    const r1 = await runner.runScenario(weekendFairness);
    const r2 = await runner.runScenario(weekendFairness);

    const c1 = JSON.stringify(canonicalizer.canonicalize(r1));
    const c2 = JSON.stringify(canonicalizer.canonicalize(r2));
    expect(c1).toBe(c2);
  });
});
