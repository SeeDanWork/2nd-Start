import { describe, it, expect } from 'vitest';
import { ScenarioStepExecutor } from '../execution/ScenarioStepExecutor';
import { ScenarioSeeder } from '../core/ScenarioSeeder';
import { ScenarioFixture, ScenarioExecutionContext } from '../types';

const executor = new ScenarioStepExecutor();
const seeder = new ScenarioSeeder();

function makeBaseFixture(): ScenarioFixture {
  return {
    scenarioId: 'executor-test',
    label: 'Executor test',
    tags: [],
    seed: {
      family: { name: 'TestFamily' },
      parents: [
        { name: 'Alice', role: 'MOTHER' },
        { name: 'Bob', role: 'FATHER' },
      ],
      children: [
        { name: 'Charlie', birthDate: '2020-06-15' },
      ],
    },
    steps: [],
    expectations: [],
  };
}

function makeSeededFixture(): { fixture: ScenarioFixture; context: ScenarioExecutionContext } {
  const fixture = makeBaseFixture();
  const context = seeder.seedScenario(fixture);
  return { fixture, context };
}

describe('ScenarioStepExecutor', () => {
  it('baseline solve step executes successfully', async () => {
    const { fixture, context } = makeSeededFixture();

    const result = await executor.executeStep({
      context,
      fixture,
      step: {
        type: 'SOLVE_BASELINE',
        stepId: 'solve-1',
        windowStart: '2026-03-09',
        windowEnd: '2026-03-22',
        candidateCount: 2,
      },
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.outputs.candidateCount).toBeGreaterThan(0);
    expect(context.activeScheduleNights.length).toBeGreaterThan(0);
    expect(context.proposals.length).toBeGreaterThan(0);
  });

  it('overlay + accept step executes successfully', async () => {
    const { fixture, context } = makeSeededFixture();

    // First solve baseline
    await executor.executeStep({
      context,
      fixture,
      step: {
        type: 'SOLVE_BASELINE',
        stepId: 'solve-1',
        windowStart: '2026-03-09',
        windowEnd: '2026-03-22',
      },
    });

    // Apply overlay
    const overlayResult = await executor.executeStep({
      context,
      fixture,
      step: {
        type: 'APPLY_OVERLAY',
        stepId: 'overlay-1',
        overlays: [{
          childName: 'Charlie',
          date: '2026-03-10',
          assignedParentName: 'Bob',
          disruptionType: 'ILLNESS',
        }],
      },
    });

    expect(overlayResult.status).toBe('SUCCESS');
    expect(context.appliedOverlays).toHaveLength(1);
  });

  it('calendar ingest step works', async () => {
    const { fixture, context } = makeSeededFixture();

    const result = await executor.executeStep({
      context,
      fixture,
      step: {
        type: 'INGEST_CALENDAR',
        stepId: 'cal-1',
        events: [{
          source: 'google',
          title: "Charlie's school day",
          startTime: '2026-03-10',
          endTime: '2026-03-10',
          allDay: true,
        }],
      },
    });

    expect(result.status).toBe('SUCCESS');
    expect(context.calendarEvents.length).toBeGreaterThan(0);
    expect(context.calendarEvents[0].kind).toBe('SCHOOL');
  });

  it('explanation build step works', async () => {
    const { fixture, context } = makeSeededFixture();

    // Ingest calendar first
    await executor.executeStep({
      context,
      fixture,
      step: {
        type: 'INGEST_CALENDAR',
        stepId: 'cal-1',
        events: [{
          source: 'google',
          title: "Charlie's school event",
          startTime: '2026-03-10',
          endTime: '2026-03-10',
          allDay: true,
        }],
      },
    });

    const result = await executor.executeStep({
      context,
      fixture,
      step: {
        type: 'BUILD_EXPLANATION',
        stepId: 'explain-1',
        targetType: 'CALENDAR_EVENT_CLASSIFICATION',
        targetSelector: { strategy: 'LATEST' },
      },
    });

    expect(result.status).toBe('SUCCESS');
    expect(context.explanationBundles.length).toBeGreaterThan(0);
    expect(context.explanationBundles[0].codes).toContain('CALENDAR_HARD_SCHOOL_EVENT');
  });

  it('invalid step reference fails explicitly', async () => {
    const { fixture, context } = makeSeededFixture();

    const result = await executor.executeStep({
      context,
      fixture,
      step: {
        type: 'ACCEPT_PROPOSAL',
        stepId: 'accept-no-proposals',
        selection: { strategy: 'FIRST' },
        acceptedAt: '2026-03-08T12:00:00Z',
        acceptedByParentName: 'Alice',
      },
    });

    expect(result.status).toBe('FAILED');
    expect(result.error?.message).toContain('No pending proposal');
  });

  it('fairness adjustment step updates ledger', async () => {
    const { fixture, context } = makeSeededFixture();

    const result = await executor.executeStep({
      context,
      fixture,
      step: {
        type: 'APPEND_FAIRNESS_ADJUSTMENT',
        stepId: 'adjust-1',
        effectiveDate: '2026-03-09',
        deltas: [
          { parentName: 'Alice', nightDelta: 2, weekendDelta: 1, holidayDelta: 0 },
          { parentName: 'Bob', nightDelta: -2, weekendDelta: -1, holidayDelta: 0 },
        ],
      },
    });

    expect(result.status).toBe('SUCCESS');
    expect(context.fairnessLedger[context.parentIdsByName['Alice']].nightDeviation).toBe(2);
  });
});
