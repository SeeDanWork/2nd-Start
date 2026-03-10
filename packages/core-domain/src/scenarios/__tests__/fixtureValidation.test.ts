import { describe, it, expect } from 'vitest';
import { ScenarioFixtureValidator } from '../fixtures/ScenarioFixtureValidator';
import { ScenarioFixtureValidationError } from '../errors';
import { ScenarioFixture } from '../types';

const validator = new ScenarioFixtureValidator();

function makeMinimalFixture(overrides: Partial<ScenarioFixture> = {}): ScenarioFixture {
  return {
    scenarioId: 'test-scenario',
    label: 'Test',
    tags: [],
    seed: {
      family: { name: 'Test' },
      parents: [{ name: 'Alice' }, { name: 'Bob' }],
      children: [{ name: 'Charlie', birthDate: '2020-01-01' }],
    },
    steps: [],
    expectations: [],
    ...overrides,
  };
}

describe('ScenarioFixtureValidator', () => {
  it('accepts a valid minimal fixture', () => {
    expect(() => validator.validateFixture(makeMinimalFixture())).not.toThrow();
  });

  it('rejects duplicate step ids', () => {
    expect(() => validator.validateFixture(makeMinimalFixture({
      steps: [
        { type: 'SOLVE_BASELINE', stepId: 'dup', windowStart: '2026-03-09', windowEnd: '2026-03-22' },
        { type: 'SOLVE_BASELINE', stepId: 'dup', windowStart: '2026-03-09', windowEnd: '2026-03-22' },
      ],
    }))).toThrow(ScenarioFixtureValidationError);
  });

  it('rejects unknown parent references in overlay step', () => {
    expect(() => validator.validateFixture(makeMinimalFixture({
      steps: [{
        type: 'APPLY_OVERLAY',
        stepId: 'overlay-1',
        overlays: [{
          childName: 'Charlie',
          date: '2026-03-10',
          assignedParentName: 'UnknownParent',
          disruptionType: 'ILLNESS',
        }],
      }],
    }))).toThrow(ScenarioFixtureValidationError);
  });

  it('rejects unknown child references in initial schedule', () => {
    expect(() => validator.validateFixture(makeMinimalFixture({
      seed: {
        family: { name: 'Test' },
        parents: [{ name: 'Alice' }],
        children: [{ name: 'Charlie', birthDate: '2020-01-01' }],
        initialSchedule: {
          windowStart: '2026-03-09',
          windowEnd: '2026-03-15',
          nights: [{ date: '2026-03-09', childName: 'Unknown', parentName: 'Alice' }],
        },
      },
    }))).toThrow(ScenarioFixtureValidationError);
  });

  it('rejects malformed expectations (duplicate expected assignments)', () => {
    expect(() => validator.validateFixture(makeMinimalFixture({
      expectations: [{
        type: 'ACTIVE_SCHEDULE',
        expectedAssignments: [
          { date: '2026-03-09', childName: 'Charlie', parentName: 'Alice' },
          { date: '2026-03-09', childName: 'Charlie', parentName: 'Bob' },
        ],
      }],
    }))).toThrow(ScenarioFixtureValidationError);
  });

  it('rejects DETERMINISM expectation with rerunCount < 1', () => {
    expect(() => validator.validateFixture(makeMinimalFixture({
      expectations: [{ type: 'DETERMINISM', rerunCount: 0 }],
    }))).toThrow(ScenarioFixtureValidationError);
  });
});
