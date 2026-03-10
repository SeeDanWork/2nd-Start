import { describe, it, expect } from 'vitest';
import { ScenarioSeeder } from '../core/ScenarioSeeder';
import { ScenarioFixture } from '../types';

const seeder = new ScenarioSeeder();

function makeFixture(overrides: Partial<ScenarioFixture['seed']> = {}): ScenarioFixture {
  return {
    scenarioId: 'seed-test',
    label: 'Seed test',
    tags: [],
    seed: {
      family: { name: 'TestFamily' },
      parents: [
        { name: 'Alice', role: 'MOTHER' },
        { name: 'Bob', role: 'FATHER' },
      ],
      children: [
        { name: 'Charlie', birthDate: '2020-01-01' },
        { name: 'Dana', birthDate: '2022-06-15' },
      ],
      ...overrides,
    },
    steps: [],
    expectations: [],
  };
}

describe('ScenarioSeeder', () => {
  it('seeds family, parents, children deterministically', () => {
    const ctx = seeder.seedScenario(makeFixture());

    expect(ctx.familyId).toBe('family:TestFamily');
    expect(Object.keys(ctx.parentIdsByName)).toEqual(['Alice', 'Bob']);
    expect(Object.keys(ctx.childIdsByName)).toEqual(['Charlie', 'Dana']);
    expect(ctx.parentIdsByName['Alice']).toBe('parent:Alice');
    expect(ctx.childIdsByName['Charlie']).toBe('child:Charlie');
  });

  it('seeds initial schedule correctly', () => {
    const ctx = seeder.seedScenario(makeFixture({
      initialSchedule: {
        windowStart: '2026-03-09',
        windowEnd: '2026-03-11',
        nights: [
          { date: '2026-03-09', childName: 'Charlie', parentName: 'Alice' },
          { date: '2026-03-10', childName: 'Charlie', parentName: 'Bob' },
        ],
      },
    }));

    expect(ctx.activeScheduleNights).toHaveLength(2);
    expect(ctx.activeScheduleVersionId).toBeDefined();
    expect(ctx.scheduleVersionNumber).toBe(1);
    expect(ctx.activeWindowStart).toBe('2026-03-09');
  });

  it('seeds fairness ledger correctly', () => {
    const ctx = seeder.seedScenario(makeFixture({
      fairnessLedger: [
        { parentName: 'Alice', nightDeviation: 2, weekendDeviation: 1, holidayDeviation: 0 },
        { parentName: 'Bob', nightDeviation: -2, weekendDeviation: -1, holidayDeviation: 0 },
      ],
    }));

    const aliceId = ctx.parentIdsByName['Alice'];
    expect(ctx.fairnessLedger[aliceId].nightDeviation).toBe(2);
    expect(ctx.fairnessLedger[aliceId].weekendDeviation).toBe(1);
  });

  it('seeds calendar events correctly', () => {
    const ctx = seeder.seedScenario(makeFixture({
      calendarEvents: [
        {
          source: 'google',
          title: 'School day',
          startTime: '2026-03-10',
          endTime: '2026-03-10',
          scopeType: 'CHILD',
          childName: 'Charlie',
          kind: 'SCHOOL',
          constraintLevel: 'HARD',
        },
      ],
    }));

    expect(ctx.calendarEvents).toHaveLength(1);
    expect(ctx.calendarEvents[0].kind).toBe('SCHOOL');
  });

  it('initializes zero fairness when no ledger provided', () => {
    const ctx = seeder.seedScenario(makeFixture());
    const aliceId = ctx.parentIdsByName['Alice'];
    expect(ctx.fairnessLedger[aliceId]).toEqual({
      nightDeviation: 0,
      weekendDeviation: 0,
      holidayDeviation: 0,
    });
  });
});
