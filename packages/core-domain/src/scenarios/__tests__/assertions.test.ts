import { describe, it, expect } from 'vitest';
import { ScenarioExpectationEvaluator } from '../assertions/ScenarioExpectationEvaluator';
import { ScenarioExecutionContext, ScenarioFixture } from '../types';

const evaluator = new ScenarioExpectationEvaluator();

function makeContext(overrides: Partial<ScenarioExecutionContext> = {}): ScenarioExecutionContext {
  return {
    familyId: 'family:Test',
    parentIdsByName: { Alice: 'parent:Alice', Bob: 'parent:Bob' },
    childIdsByName: { Charlie: 'child:Charlie' },
    activeScheduleNights: [
      { date: '2026-03-09', childId: 'child:Charlie', parentId: 'parent:Alice' },
      { date: '2026-03-10', childId: 'child:Charlie', parentId: 'parent:Bob' },
    ],
    activeScheduleExchanges: [],
    appliedOverlays: [],
    proposals: [],
    fairnessLedger: {
      'parent:Alice': { nightDeviation: 0, weekendDeviation: 0, holidayDeviation: 0 },
      'parent:Bob': { nightDeviation: 0, weekendDeviation: 0, holidayDeviation: 0 },
    },
    calendarEvents: [],
    explanationBundles: [],
    resolvedOverlayCount: 0,
    scheduleVersionNumber: 1,
    ...overrides,
  };
}

const minFixture: ScenarioFixture = {
  scenarioId: 'test', label: 'test', tags: [],
  seed: {
    family: { name: 'Test' },
    parents: [{ name: 'Alice' }, { name: 'Bob' }],
    children: [{ name: 'Charlie', birthDate: '2020-01-01' }],
  },
  steps: [],
  expectations: [],
};

describe('ScenarioExpectationEvaluator', () => {
  it('active schedule expectation evaluates correctly', () => {
    const result = evaluator.evaluate({
      type: 'ACTIVE_SCHEDULE',
      versionNumber: 1,
      expectedAssignments: [
        { date: '2026-03-09', childName: 'Charlie', parentName: 'Alice' },
      ],
    }, makeContext(), minFixture);

    expect(result.passed).toBe(true);
  });

  it('active schedule fails on wrong assignment', () => {
    const result = evaluator.evaluate({
      type: 'ACTIVE_SCHEDULE',
      expectedAssignments: [
        { date: '2026-03-09', childName: 'Charlie', parentName: 'Bob' },
      ],
    }, makeContext(), minFixture);

    expect(result.passed).toBe(false);
    expect(result.message).toContain('expected Bob');
  });

  it('proposal count expectation evaluates correctly', () => {
    const ctx = makeContext({
      proposals: [
        { proposalId: 'p1', status: 'ACCEPTED', origin: 'BASELINE_SOLVER' },
        { proposalId: 'p2', status: 'INVALIDATED', origin: 'BASELINE_SOLVER' },
        { proposalId: 'p3', status: 'INVALIDATED', origin: 'BASELINE_SOLVER' },
      ],
    });

    const result = evaluator.evaluate({
      type: 'PROPOSAL_COUNT',
      pending: 0,
      accepted: 1,
      invalidated: 2,
    }, ctx, minFixture);

    expect(result.passed).toBe(true);
  });

  it('fairness ledger expectation evaluates correctly', () => {
    const ctx = makeContext({
      fairnessLedger: {
        'parent:Alice': { nightDeviation: 2, weekendDeviation: 1, holidayDeviation: 0 },
        'parent:Bob': { nightDeviation: -2, weekendDeviation: -1, holidayDeviation: 0 },
      },
    });

    const result = evaluator.evaluate({
      type: 'FAIRNESS_LEDGER',
      byParent: [
        { parentName: 'Alice', nightDeviation: 2, weekendDeviation: 1, holidayDeviation: 0 },
        { parentName: 'Bob', nightDeviation: -2, weekendDeviation: -1, holidayDeviation: 0 },
      ],
    }, ctx, minFixture);

    expect(result.passed).toBe(true);
  });

  it('explanation expectation checks required codes', () => {
    const ctx = makeContext({
      explanationBundles: [
        {
          targetType: 'CALENDAR_EVENT_CLASSIFICATION',
          targetId: 'cal:1',
          recordCount: 2,
          codes: ['CALENDAR_HARD_SCHOOL_EVENT', 'CALENDAR_CONSTRAINT_SUMMARY'],
        },
      ],
    });

    const result = evaluator.evaluate({
      type: 'EXPLANATION',
      targetType: 'CALENDAR_EVENT_CLASSIFICATION',
      requiredCodes: ['CALENDAR_HARD_SCHOOL_EVENT'],
    }, ctx, minFixture);

    expect(result.passed).toBe(true);
  });

  it('explanation expectation fails on missing code', () => {
    const ctx = makeContext({
      explanationBundles: [
        {
          targetType: 'SCHEDULE_VERSION',
          targetId: 'sv:1',
          recordCount: 1,
          codes: ['CHANGE_BASELINE_PRESERVATION'],
        },
      ],
    });

    const result = evaluator.evaluate({
      type: 'EXPLANATION',
      targetType: 'SCHEDULE_VERSION',
      requiredCodes: ['FAIRNESS_GRADUAL_RESTITUTION'],
    }, ctx, minFixture);

    expect(result.passed).toBe(false);
    expect(result.message).toContain('missing required code');
  });

  it('calendar classification expectation matches', () => {
    const ctx = makeContext({
      calendarEvents: [
        { title: "Charlie's school day", kind: 'SCHOOL', constraintLevel: 'HARD', date: '2026-03-10' },
      ],
    });

    const result = evaluator.evaluate({
      type: 'CALENDAR_CLASSIFICATION',
      expected: [{ title: 'school day', constraintLevel: 'HARD', kind: 'SCHOOL' }],
    }, ctx, minFixture);

    expect(result.passed).toBe(true);
  });
});
