import { describe, it, expect } from 'vitest';
import {
  computeScheduleMetrics,
  getOperationalMessage,
  generateDailySummary,
  generateWeeklyOverview,
  generateMonthlySummary,
  checkFairnessAlert,
  checkFrictionAhead,
} from '../lib/operational-messages';
import { ScenarioConfig, ScheduleDay } from '../lib/types';

const CONFIG: ScenarioConfig = {
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
};

function makeSchedule(days: number, pattern: 'balanced' | 'imbalanced' | 'high_transition' = 'balanced'): ScheduleDay[] {
  const schedule: ScheduleDay[] = [];
  const start = new Date('2026-03-09'); // Monday
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    let assignedTo: 'parent_a' | 'parent_b';
    if (pattern === 'balanced') {
      assignedTo = Math.floor(i / 7) % 2 === 0 ? 'parent_a' : 'parent_b';
    } else if (pattern === 'imbalanced') {
      assignedTo = i < days * 0.8 ? 'parent_a' : 'parent_b';
    } else {
      // high_transition: alternates every day
      assignedTo = i % 2 === 0 ? 'parent_a' : 'parent_b';
    }
    const isTransition = i > 0 && schedule[i - 1]?.assignedTo !== assignedTo;
    schedule.push({ date: d.toISOString().split('T')[0], assignedTo, isTransition });
  }
  return schedule;
}

describe('computeScheduleMetrics', () => {
  it('computes balanced schedule correctly', () => {
    const schedule = makeSchedule(56, 'balanced');
    const m = computeScheduleMetrics(schedule, 56);
    expect(m.fairnessBalance.parentA).toBe(28);
    expect(m.fairnessBalance.parentB).toBe(28);
    expect(m.stabilityScore).toBe('strong');
  });

  it('detects imbalanced schedule', () => {
    const schedule = makeSchedule(56, 'imbalanced');
    const m = computeScheduleMetrics(schedule, 56);
    expect(m.fairnessBalance.parentA).toBeGreaterThan(m.fairnessBalance.parentB);
    // Large drift should be weak
    expect(['moderate', 'weak']).toContain(m.stabilityScore);
  });

  it('detects high transition rate', () => {
    const schedule = makeSchedule(14, 'high_transition');
    const m = computeScheduleMetrics(schedule, 14);
    expect(m.transitionsThisWeek).toBeGreaterThan(3);
  });

  it('computes avg block length', () => {
    const schedule = makeSchedule(56, 'balanced');
    const m = computeScheduleMetrics(schedule, 56);
    expect(m.avgBlockLength).toBeGreaterThan(0);
  });

  it('handles empty schedule', () => {
    const m = computeScheduleMetrics([], 0);
    expect(m.fairnessBalance.parentA).toBe(0);
    expect(m.stabilityScore).toBe('strong');
  });

  it('tracks longest streak', () => {
    const schedule = makeSchedule(56, 'balanced');
    const m = computeScheduleMetrics(schedule, 56);
    expect(m.longestStreak.nights).toBe(7); // alternating weeks = 7 day blocks
    expect(['parent_a', 'parent_b']).toContain(m.longestStreak.parent);
  });
});

describe('getOperationalMessage', () => {
  const schedule = makeSchedule(56, 'balanced');

  it('returns SILENT for normal mid-week days', () => {
    // Day 3 (Thursday) — not transition, not week boundary
    const msg = getOperationalMessage(CONFIG, schedule, 3, 'parent_a');
    expect(msg.type).toBe('SILENT');
  });

  it('returns DAILY_SUMMARY for first day', () => {
    const msg = getOperationalMessage(CONFIG, schedule, 0, 'parent_a');
    expect(msg.type).toBe('DAILY_SUMMARY');
    expect(msg.text).toContain('Emma');
  });

  it('returns a message on transition days (DAILY_SUMMARY or WEEKLY_OVERVIEW)', () => {
    // Day 7 may be a transition AND a weekly boundary — weekly takes priority
    const msg = getOperationalMessage(CONFIG, schedule, 7, 'parent_a');
    expect(['DAILY_SUMMARY', 'WEEKLY_OVERVIEW']).toContain(msg.type);
    expect(msg.text.length).toBeGreaterThan(0);
  });

  it('returns MONTHLY_SUMMARY at day 28', () => {
    const msg = getOperationalMessage(CONFIG, schedule, 28, 'parent_a');
    expect(msg.type).toBe('MONTHLY_SUMMARY');
  });

  it('returns SILENT for empty schedule', () => {
    const msg = getOperationalMessage(CONFIG, [], 0, 'parent_a');
    expect(msg.type).toBe('SILENT');
  });
});

describe('generateDailySummary', () => {
  const schedule = makeSchedule(56, 'balanced');

  it('includes date, child names, and assigned parent', () => {
    const msg = generateDailySummary(CONFIG, schedule, 0, 'parent_a');
    expect(msg.text).toContain('Emma');
    expect(msg.text).toContain('Mom');
    expect(msg.text).toContain('Stability');
  });

  it('includes next exchange info', () => {
    const msg = generateDailySummary(CONFIG, schedule, 0, 'parent_a');
    expect(msg.text).toMatch(/Next exchange/);
  });
});

describe('generateWeeklyOverview', () => {
  const schedule = makeSchedule(56, 'balanced');

  it('includes weekly review header', () => {
    const msg = generateWeeklyOverview(CONFIG, schedule, 7);
    expect(msg.text).toContain('Weekly schedule review');
    expect(msg.type).toBe('WEEKLY_OVERVIEW');
  });

  it('includes fairness window data', () => {
    const msg = generateWeeklyOverview(CONFIG, schedule, 7);
    expect(msg.text).toContain('Mom');
    expect(msg.text).toContain('Dad');
    expect(msg.text).toContain('nights');
  });

  it('returns SILENT for empty range', () => {
    const msg = generateWeeklyOverview(CONFIG, [], 0);
    expect(msg.type).toBe('SILENT');
  });
});

describe('generateMonthlySummary', () => {
  const schedule = makeSchedule(56, 'balanced');

  it('includes monthly report header', () => {
    const msg = generateMonthlySummary(CONFIG, schedule, 28);
    expect(msg.text).toContain('Monthly schedule report');
    expect(msg.type).toBe('MONTHLY_SUMMARY');
  });
});

describe('checkFairnessAlert', () => {
  it('returns null for balanced schedule', () => {
    const schedule = makeSchedule(56, 'balanced');
    expect(checkFairnessAlert(CONFIG, schedule, 28)).toBeNull();
  });

  it('returns alert for imbalanced schedule', () => {
    const schedule = makeSchedule(56, 'imbalanced');
    const alert = checkFairnessAlert(CONFIG, schedule, 28);
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe('FAIRNESS_ALERT');
    expect(alert!.text).toContain('drift');
  });
});

describe('checkFrictionAhead', () => {
  it('returns null for low-transition schedule', () => {
    const schedule = makeSchedule(56, 'balanced');
    expect(checkFrictionAhead(CONFIG, schedule, 0)).toBeNull();
  });

  it('returns alert for high-transition schedule', () => {
    const schedule = makeSchedule(14, 'high_transition');
    const alert = checkFrictionAhead(CONFIG, schedule, 0);
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe('FRICTION_DETECTION');
    expect(alert!.text).toContain('exchanges');
  });
});
