import { describe, it, expect } from 'vitest';
import {
  snapshotMetrics,
  buildExplanation,
  formatLevel1,
  formatLevel2,
  formatLevel3,
  formatCalculationTrace,
  buildDisruptionExplanation,
  buildDaySummaryExplanation,
} from '../lib/explanation-engine';
import { ScenarioConfig, ScheduleDay } from '../lib/types';

const CONFIG: ScenarioConfig = {
  name: 'Test',
  description: 'Test',
  children: [{ age: 7, name: 'Emma' }, { age: 10, name: 'Jake' }],
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

describe('snapshotMetrics', () => {
  const schedule = makeSchedule(56);

  it('returns correct night counts', () => {
    const snap = snapshotMetrics(schedule, 0, 56);
    expect(snap.parentANights + snap.parentBNights).toBe(56);
    expect(snap.parentANights).toBe(28);
    expect(snap.parentBNights).toBe(28);
  });

  it('returns stability score', () => {
    const snap = snapshotMetrics(schedule, 0, 56);
    expect(['strong', 'moderate', 'weak']).toContain(snap.stabilityScore);
  });

  it('transitions per week is reasonable', () => {
    const snap = snapshotMetrics(schedule, 0, 56);
    expect(snap.transitionsPerWeek).toBeGreaterThanOrEqual(0);
    expect(snap.transitionsPerWeek).toBeLessThanOrEqual(7);
  });

  it('handles partial window', () => {
    const snap = snapshotMetrics(schedule, 50, 56);
    expect(snap.parentANights + snap.parentBNights).toBeLessThanOrEqual(56);
  });

  it('handles empty schedule slice', () => {
    const snap = snapshotMetrics([], 0, 56);
    expect(snap.parentANights).toBe(0);
    expect(snap.parentBNights).toBe(0);
    expect(snap.stabilityScore).toBe('strong');
  });
});

describe('buildExplanation', () => {
  const schedule = makeSchedule(112);

  it('returns all required fields', () => {
    const exp = buildExplanation(CONFIG, schedule, 56, 'Test change', 'Detailed test');
    expect(exp.change.summary).toBe('Test change');
    expect(exp.change.detail).toBe('Detailed test');
    expect(exp.factors.length).toBeGreaterThan(0);
    expect(exp.comparison.before).toBeTruthy();
    expect(exp.comparison.after).toBeTruthy();
    expect(exp.scores).toBeTruthy();
  });

  it('factors have valid status values', () => {
    const exp = buildExplanation(CONFIG, schedule, 56, 'Test', 'Detail');
    for (const f of exp.factors) {
      expect(['improved', 'unchanged', 'degraded']).toContain(f.status);
      expect(f.label).toBeTruthy();
    }
  });

  it('scores include all components', () => {
    const exp = buildExplanation(CONFIG, schedule, 56, 'Test', 'Detail');
    expect(typeof exp.scores.fairness_penalty).toBe('number');
    expect(typeof exp.scores.transition_penalty).toBe('number');
    expect(typeof exp.scores.routine_penalty).toBe('number');
    expect(typeof exp.scores.fragmentation_penalty).toBe('number');
    expect(typeof exp.scores.total_score).toBe('number');
  });
});

describe('formatLevel1', () => {
  const schedule = makeSchedule(112);

  it('returns a single line summary', () => {
    const exp = buildExplanation(CONFIG, schedule, 56, 'Schedule adjusted.', 'Detail');
    const l1 = formatLevel1(exp);
    expect(l1).toContain('Schedule adjusted.');
    expect(l1.split('\n')).toHaveLength(1);
  });
});

describe('formatLevel2', () => {
  const schedule = makeSchedule(112);

  it('includes factor status indicators', () => {
    const exp = buildExplanation(CONFIG, schedule, 56, 'Test', 'Detail');
    const l2 = formatLevel2(exp);
    expect(l2).toContain('Factors considered');
    expect(l2).toMatch(/\[[\+\=\-]\]/);
  });

  it('lists all factors', () => {
    const exp = buildExplanation(CONFIG, schedule, 56, 'Test', 'Detail');
    const l2 = formatLevel2(exp);
    expect(l2).toContain('Fairness');
    expect(l2).toContain('Transitions');
    expect(l2).toContain('Routine stability');
  });
});

describe('formatLevel3', () => {
  const schedule = makeSchedule(112);

  it('shows raw score components', () => {
    const exp = buildExplanation(CONFIG, schedule, 56, 'Test', 'Detail');
    const l3 = formatLevel3(exp);
    expect(l3).toContain('Score components');
    expect(l3).toContain('fairness_penalty');
    expect(l3).toContain('transition_penalty');
    expect(l3).toContain('routine_penalty');
    expect(l3).toContain('fragmentation_penalty');
    expect(l3).toContain('total_score');
  });
});

describe('formatCalculationTrace', () => {
  const schedule = makeSchedule(112);

  it('includes before/after comparison', () => {
    const exp = buildExplanation(CONFIG, schedule, 56, 'Test', 'Coverage applied');
    const trace = formatCalculationTrace(exp, CONFIG);
    expect(trace).toContain('Before:');
    expect(trace).toContain('After:');
    expect(trace).toContain('Mom');
    expect(trace).toContain('Dad');
    expect(trace).toContain('Evaluation:');
  });
});

describe('buildDisruptionExplanation', () => {
  const schedule = makeSchedule(56);

  it('includes disruption name and metrics', () => {
    const text = buildDisruptionExplanation(
      CONFIG, schedule, 0, 'Child Sick', 'Child is sick at school',
      { decision: 'accept', confidence: 0.8 },
      { decision: 'accept', confidence: 0.7 },
    );
    expect(text).toContain('Child Sick');
    expect(text).toContain('Mom');
    expect(text).toContain('Dad');
    expect(text).toContain('accept');
    expect(text).toContain('Both parents agree');
  });

  it('shows rejection result', () => {
    const text = buildDisruptionExplanation(
      CONFIG, schedule, 0, 'Test', 'desc',
      { decision: 'accept', confidence: 0.8 },
      { decision: 'reject', confidence: 0.6 },
    );
    expect(text).toContain('Disagreement');
    expect(text).toContain('base schedule');
  });

  it('shows counter-proposal result', () => {
    const text = buildDisruptionExplanation(
      CONFIG, schedule, 0, 'Test', 'desc',
      { decision: 'counter', confidence: 0.5 },
      { decision: 'accept', confidence: 0.7 },
    );
    expect(text).toContain('Counter-proposal');
  });

  it('works without decisions', () => {
    const text = buildDisruptionExplanation(
      CONFIG, schedule, 0, 'Test', 'desc', null, null,
    );
    expect(text).toContain('Test');
    expect(text).not.toContain('Parent responses');
  });
});

describe('buildDaySummaryExplanation', () => {
  const schedule = makeSchedule(56);

  it('returns day summary with child names and assignment', () => {
    const text = buildDaySummaryExplanation(CONFIG, schedule, 0);
    expect(text).toContain('Emma & Jake');
    expect(text).toContain('Mom');
    expect(text).toContain('No action required');
  });

  it('marks transition days', () => {
    const text = buildDaySummaryExplanation(CONFIG, schedule, 7);
    expect(text).toContain('Transition day');
  });

  it('returns empty for out-of-bounds day', () => {
    expect(buildDaySummaryExplanation(CONFIG, schedule, 999)).toBe('');
  });

  it('includes next exchange info', () => {
    const text = buildDaySummaryExplanation(CONFIG, schedule, 0);
    expect(text).toContain('Next exchange');
  });
});
