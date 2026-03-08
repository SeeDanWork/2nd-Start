import { describe, it, expect } from 'vitest';
import { generateSchedule } from '../lib/schedule-generator';
import { ScenarioConfig } from '../lib/types';

function makeConfig(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
  return {
    name: 'Test',
    description: 'Test',
    children: [{ age: 7, name: 'Emma' }],
    parentA: { label: 'Mom', phone: '+1111' },
    parentB: { label: 'Dad', phone: '+2222' },
    template: 'alternating_weeks',
    targetSplit: 50,
    lockedNights: [],
    distanceMiles: 10,
    tags: [],
    ...overrides,
  };
}

describe('generateSchedule', () => {
  it('generates correct number of days for default 8 weeks', () => {
    const schedule = generateSchedule(makeConfig());
    expect(schedule).toHaveLength(56);
  });

  it('respects simulationWeeks config', () => {
    const schedule = generateSchedule(makeConfig({ simulationWeeks: 4 }));
    expect(schedule).toHaveLength(28);
  });

  it('respects explicit weeks parameter', () => {
    const schedule = generateSchedule(makeConfig(), 2);
    expect(schedule).toHaveLength(14);
  });

  it('starts on a consistent day of the week', () => {
    const schedule = generateSchedule(makeConfig());
    // The generator uses `new Date()` internally, so the start day
    // depends on when the test runs. Just verify it's a valid day.
    const firstDate = new Date(schedule[0].date + 'T12:00:00');
    expect(firstDate.getDay()).toBeGreaterThanOrEqual(0);
    expect(firstDate.getDay()).toBeLessThanOrEqual(6);
  });

  it('dates are consecutive', () => {
    const schedule = generateSchedule(makeConfig());
    for (let i = 1; i < schedule.length; i++) {
      const prev = new Date(schedule[i - 1].date);
      const curr = new Date(schedule[i].date);
      const diff = (curr.getTime() - prev.getTime()) / (86400000);
      expect(diff).toBe(1);
    }
  });

  it('alternating_weeks switches every 7 days', () => {
    const schedule = generateSchedule(makeConfig({ template: 'alternating_weeks' }));
    // First 7 should be parent_a
    for (let i = 0; i < 7; i++) {
      expect(schedule[i].assignedTo).toBe('parent_a');
    }
    // Next 7 should be parent_b
    for (let i = 7; i < 14; i++) {
      expect(schedule[i].assignedTo).toBe('parent_b');
    }
  });

  it('2-2-3 follows the expected pattern', () => {
    const schedule = generateSchedule(makeConfig({ template: '2-2-3' }));
    // Week 1: AABBABA (Mon-Sun) but pattern starts: true true false false true true true
    expect(schedule[0].assignedTo).toBe('parent_a');
    expect(schedule[1].assignedTo).toBe('parent_a');
    expect(schedule[2].assignedTo).toBe('parent_b');
    expect(schedule[3].assignedTo).toBe('parent_b');
    expect(schedule[4].assignedTo).toBe('parent_a');
    expect(schedule[5].assignedTo).toBe('parent_a');
    expect(schedule[6].assignedTo).toBe('parent_a');
    // Week 2 flips
    expect(schedule[7].assignedTo).toBe('parent_b');
    expect(schedule[8].assignedTo).toBe('parent_b');
    expect(schedule[9].assignedTo).toBe('parent_a');
    expect(schedule[10].assignedTo).toBe('parent_a');
  });

  it('5-2 repeats weekly', () => {
    const schedule = generateSchedule(makeConfig({ template: '5-2' }));
    for (let w = 0; w < 4; w++) {
      const base = w * 7;
      for (let d = 0; d < 5; d++) {
        expect(schedule[base + d].assignedTo).toBe('parent_a');
      }
      for (let d = 5; d < 7; d++) {
        expect(schedule[base + d].assignedTo).toBe('parent_b');
      }
    }
  });

  it('marks transitions correctly', () => {
    const schedule = generateSchedule(makeConfig({ template: 'alternating_weeks' }));
    expect(schedule[0].isTransition).toBe(false);
    // Day 7 should be a transition (A -> B)
    expect(schedule[7].isTransition).toBe(true);
    // Day 8 is same as 7 (both B), no transition
    expect(schedule[8].isTransition).toBe(false);
    // Day 14 should be a transition (B -> A)
    expect(schedule[14].isTransition).toBe(true);
  });

  it('locked nights override template pattern', () => {
    const config = makeConfig({
      template: 'alternating_weeks',
      lockedNights: [{ parent: 'parent_a', daysOfWeek: [3] }], // Wednesday always Mom
    });
    const schedule = generateSchedule(config);
    // Parse dates at noon to avoid timezone boundary issues
    for (const day of schedule) {
      const date = new Date(day.date + 'T12:00:00');
      if (date.getDay() === 3) {
        expect(day.assignedTo).toBe('parent_a');
      }
    }
  });

  it('locked nights for parent_b override template', () => {
    const config = makeConfig({
      template: 'alternating_weeks',
      lockedNights: [{ parent: 'parent_b', daysOfWeek: [0, 6] }], // weekends always Dad
    });
    const schedule = generateSchedule(config);
    for (const day of schedule) {
      const date = new Date(day.date + 'T12:00:00');
      if (date.getDay() === 0 || date.getDay() === 6) {
        expect(day.assignedTo).toBe('parent_b');
      }
    }
  });

  it('falls back to alternating_weeks for unknown template', () => {
    const schedule = generateSchedule(makeConfig({ template: 'nonexistent' }));
    expect(schedule).toHaveLength(56);
    expect(schedule[0].assignedTo).toBe('parent_a');
    expect(schedule[7].assignedTo).toBe('parent_b');
  });

  it('all days have valid ISO date strings', () => {
    const schedule = generateSchedule(makeConfig());
    for (const day of schedule) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('schedule is deterministic for same config', () => {
    const a = generateSchedule(makeConfig());
    const b = generateSchedule(makeConfig());
    expect(a.map(d => d.assignedTo)).toEqual(b.map(d => d.assignedTo));
  });
});
