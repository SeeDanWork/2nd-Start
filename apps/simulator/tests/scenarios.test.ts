import { describe, it, expect } from 'vitest';
import { scenarioRegistry, scenarioList } from '../src/scenarios';
import { simulate } from '../src/runner';
import { ChatMessageSchema } from '../src/types';

describe('Scenario Registry', () => {
  it('contains exactly 51 scenarios', () => {
    expect(scenarioList.length).toBe(51);
  });

  it('has unique scenario numbers 1-51', () => {
    const numbers = scenarioList.map((s) => s.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 51 }, (_, i) => i + 1));
  });

  it('has unique keys', () => {
    const keys = scenarioList.map((s) => s.key);
    expect(new Set(keys).size).toBe(51);
  });

  it('has 20 fully implemented scenarios', () => {
    const implemented = scenarioList.filter((s) => s.implemented);
    expect(implemented.length).toBe(20);
  });

  it('has 31 stub scenarios', () => {
    const stubs = scenarioList.filter((s) => !s.implemented);
    expect(stubs.length).toBe(31);
  });

  it('covers all 10 categories', () => {
    const categories = new Set(scenarioList.map((s) => s.category));
    expect(categories.size).toBe(10);
  });
});

describe('Schema Validation', () => {
  const implementedScenarios = scenarioList.filter((s) => s.implemented);

  it.each(implementedScenarios.map((s) => [s.number, s.key, s]))(
    'scenario #%i (%s) produces valid ChatMessages',
    (_num, _key, scenario) => {
      const transcript = simulate(scenario);
      expect(transcript.validatedMessages.length).toBeGreaterThan(0);
      for (const msg of transcript.validatedMessages) {
        const result = ChatMessageSchema.safeParse(msg);
        expect(result.success).toBe(true);
      }
    },
  );
});

describe('Determinism', () => {
  const implementedScenarios = scenarioList.filter((s) => s.implemented);

  it.each(implementedScenarios.map((s) => [s.number, s.key, s]))(
    'scenario #%i (%s) produces identical output on two runs',
    (_num, _key, scenario) => {
      const run1 = simulate(scenario);
      const run2 = simulate(scenario);
      // Compare serialized output for exact equality
      expect(JSON.stringify(run1.validatedMessages)).toBe(JSON.stringify(run2.validatedMessages));
      expect(JSON.stringify(run1.stateTransitions)).toBe(JSON.stringify(run2.stateTransitions));
    },
  );
});

describe('State Transitions', () => {
  const implementedScenarios = scenarioList.filter((s) => s.implemented);

  it.each(implementedScenarios.map((s) => [s.number, s.key, s]))(
    'scenario #%i (%s) all transitions execute without errors',
    (_num, _key, scenario) => {
      const transcript = simulate(scenario);
      expect(transcript.errors).toEqual([]);
      // Verify each action from messages has a corresponding transition
      for (const msg of transcript.validatedMessages) {
        if (msg.actions) {
          for (const action of msg.actions) {
            // Some actions may not have transitions (stubs or info-only)
            if (scenario.expectedStateTransitions?.[action.actionId]) {
              expect(transcript.stateTransitions).toHaveProperty(action.actionId);
            }
          }
        }
      }
    },
  );
});

describe('Timeout Policies', () => {
  const withTimeout = scenarioList.filter((s) => s.implemented && s.timeoutPolicy);

  it(`found ${withTimeout.length} scenarios with timeout policies`, () => {
    expect(withTimeout.length).toBeGreaterThan(0);
  });

  it.each(withTimeout.map((s) => [s.number, s.key, s]))(
    'scenario #%i (%s) timeout produces valid messages',
    (_num, _key, scenario) => {
      const transcript = simulate(scenario);
      expect(transcript.timeoutResult).toBeDefined();
      expect(transcript.timeoutResult!.outgoingMessages.length).toBeGreaterThan(0);
      for (const msg of transcript.timeoutResult!.outgoingMessages) {
        const result = ChatMessageSchema.safeParse(msg);
        expect(result.success).toBe(true);
      }
    },
  );
});

describe('Stub Scenarios', () => {
  const stubs = scenarioList.filter((s) => !s.implemented);

  it.each(stubs.map((s) => [s.number, s.key, s]))(
    'stub #%i (%s) runs without errors',
    (_num, _key, scenario) => {
      const transcript = simulate(scenario);
      expect(transcript.errors).toEqual([]);
      expect(transcript.validatedMessages.length).toBe(0);
    },
  );
});
