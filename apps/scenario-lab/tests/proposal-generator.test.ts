import { describe, it, expect } from 'vitest';
import { generateProposalBundle, formatProposalBundle, formatProposalOption } from '../lib/proposal-generator';
import { createDisruption, setDuration, ActiveDisruption } from '../lib/disruption-engine';
import { ScenarioConfig, ScheduleDay } from '../lib/types';

const CONFIG: ScenarioConfig = {
  name: 'Test',
  description: 'Test scenario',
  children: [{ age: 7, name: 'Emma' }],
  parentA: { label: 'Mom', phone: '+1111' },
  parentB: { label: 'Dad', phone: '+2222' },
  template: 'alternating_weeks',
  targetSplit: 50,
  lockedNights: [],
  distanceMiles: 10,
  tags: [],
};

function makeSchedule(days: number): ScheduleDay[] {
  const schedule: ScheduleDay[] = [];
  const start = new Date('2026-03-09');
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const weekNum = Math.floor(i / 7);
    const assignedTo = weekNum % 2 === 0 ? 'parent_a' : 'parent_b';
    schedule.push({
      date: d.toISOString().split('T')[0],
      assignedTo: assignedTo as 'parent_a' | 'parent_b',
      isTransition: i > 0 && i % 7 === 0,
    });
  }
  return schedule;
}

function makeDisruption(schedule: ScheduleDay[], duration: 'today_only' | '2_3_days' | 'week' = 'today_only'): ActiveDisruption {
  let d = createDisruption('parent_a', 'child_sick', schedule[0].date);
  d = setDuration(d, duration, schedule, 0);
  return d;
}

describe('generateProposalBundle', () => {
  const schedule = makeSchedule(56);

  it('returns a bundle with disruptionId', () => {
    const disruption = makeDisruption(schedule);
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    expect(bundle.disruptionId).toBe(disruption.id);
    expect(bundle.generatedAt).toBeTruthy();
  });

  it('returns empty options when no affected days', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    // Don't set duration, so affectedDays = []
    const bundle = generateProposalBundle(CONFIG, schedule, d, 0);
    expect(bundle.options).toHaveLength(0);
  });

  it('generates 2 options for today_only disruption (full + partial)', () => {
    const disruption = makeDisruption(schedule, 'today_only');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    expect(bundle.options.length).toBeGreaterThanOrEqual(2);

    const full = bundle.options.find(o => o.label === 'Full coverage transfer');
    expect(full).toBeTruthy();
    expect(full!.coverageDays).toHaveLength(1);

    const partial = bundle.options.find(o => o.label === 'Partial day coverage');
    expect(partial).toBeTruthy();
    expect(partial!.fairnessImpact.parentADelta).toBe(0);
    expect(partial!.fairnessImpact.parentBDelta).toBe(0);
  });

  it('generates 2 options for 3-day disruption (full + shortened; no partial for >2 days)', () => {
    const disruption = makeDisruption(schedule, '2_3_days');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    // Partial only generated when affected.length <= 2; 3-day = full + shortened
    expect(bundle.options.length).toBe(2);
    expect(bundle.options.some(o => o.label === 'Full coverage transfer')).toBe(true);
    expect(bundle.options.some(o => o.label.includes('reevaluate'))).toBe(true);
  });

  it('full coverage has correct fairness impact', () => {
    const disruption = makeDisruption(schedule, 'today_only');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    const full = bundle.options.find(o => o.label === 'Full coverage transfer')!;
    // Reporter is parent_a, losing 1 day: parentADelta = -1, parentBDelta = +1
    expect(full.fairnessImpact.parentADelta).toBe(-1);
    expect(full.fairnessImpact.parentBDelta).toBe(1);
  });

  it('partial coverage has zero fairness impact', () => {
    const disruption = makeDisruption(schedule, 'today_only');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    const partial = bundle.options.find(o => o.label === 'Partial day coverage')!;
    expect(partial.fairnessImpact.parentADelta).toBe(0);
    expect(partial.fairnessImpact.parentBDelta).toBe(0);
    expect(partial.transitionImpact).toBe(0);
  });

  it('shortened coverage covers half the affected days', () => {
    const disruption = makeDisruption(schedule, '2_3_days');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    const shortened = bundle.options.find(o => o.label.includes('reevaluate'));
    expect(shortened).toBeTruthy();
    // ceil(3/2) = 2
    expect(shortened!.coverageDays).toHaveLength(2);
  });

  it('compensation days are in the 7-21 day window', () => {
    const disruption = makeDisruption(schedule, 'today_only');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    const full = bundle.options.find(o => o.label === 'Full coverage transfer')!;
    for (const comp of full.compensationDays) {
      const compDate = new Date(comp.date);
      const startDate = new Date(schedule[0].date);
      const dayDiff = Math.round((compDate.getTime() - startDate.getTime()) / (86400000));
      expect(dayDiff).toBeGreaterThanOrEqual(7);
      expect(dayDiff).toBeLessThan(21);
    }
  });

  it('all options have unique IDs', () => {
    const disruption = makeDisruption(schedule, 'week');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    const ids = bundle.options.map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('formatProposalBundle', () => {
  const schedule = makeSchedule(56);

  it('formats empty bundle', () => {
    const bundle = { disruptionId: 'x', options: [], generatedAt: '' };
    const text = formatProposalBundle(bundle, CONFIG);
    expect(text).toContain('No schedule adjustment');
  });

  it('formats bundle with options', () => {
    const disruption = makeDisruption(schedule, 'today_only');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    const text = formatProposalBundle(bundle, CONFIG);
    expect(text).toContain('Option 1');
    expect(text).toContain('Full coverage transfer');
    expect(text).toContain('Routine impact');
  });

  it('includes fairness information', () => {
    const disruption = makeDisruption(schedule, '2_3_days');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    const text = formatProposalBundle(bundle, CONFIG);
    // Should contain parent labels
    expect(text).toMatch(/Mom|Dad/);
  });
});

describe('formatProposalOption', () => {
  const schedule = makeSchedule(56);

  it('includes label and description', () => {
    const disruption = makeDisruption(schedule, 'today_only');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    const text = formatProposalOption(bundle.options[0], CONFIG);
    expect(text).toContain(bundle.options[0].label);
    expect(text).toContain('Impact');
  });

  it('shows no fairness impact for partial coverage', () => {
    const disruption = makeDisruption(schedule, 'today_only');
    const bundle = generateProposalBundle(CONFIG, schedule, disruption, 0);
    const partial = bundle.options.find(o => o.label === 'Partial day coverage')!;
    const text = formatProposalOption(partial, CONFIG);
    expect(text).toContain('No fairness impact');
  });
});
