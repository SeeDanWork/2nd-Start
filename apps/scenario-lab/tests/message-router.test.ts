import { describe, it, expect } from 'vitest';
import {
  disruptionReportConfirmation,
  durationQuestion,
  coverageRequest,
  proposalBundleMessage,
  proposalSelectedMessage,
  declineConfirmation,
  manageSelfConfirmation,
  followupCheck,
  getQuickActions,
} from '../lib/message-router';
import { createDisruption, setDuration, attachProposals, ActiveDisruption, ProposalBundle } from '../lib/disruption-engine';
import { ScenarioConfig, ScheduleDay } from '../lib/types';

const CONFIG: ScenarioConfig = {
  name: 'Test',
  description: 'Test scenario',
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
    schedule.push({
      date: d.toISOString().split('T')[0],
      assignedTo: Math.floor(i / 7) % 2 === 0 ? 'parent_a' : 'parent_b',
      isTransition: i > 0 && i % 7 === 0,
    });
  }
  return schedule;
}

describe('disruptionReportConfirmation', () => {
  it('sends to reporting parent', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const schedule = makeSchedule(56);
    const msg = disruptionReportConfirmation(d, CONFIG, schedule, 0);
    expect(msg.recipient).toBe('parent_a');
    expect(msg.type).toBe('DISRUPTION_REPORT_CONFIRMATION');
  });

  it('includes event label and options', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const schedule = makeSchedule(56);
    const msg = disruptionReportConfirmation(d, CONFIG, schedule, 0);
    expect(msg.text).toContain('Child illness');
    expect(msg.text).toContain('Request coverage');
    expect(msg.text).toContain('Manage myself');
  });

  it('includes child names', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const schedule = makeSchedule(56);
    const msg = disruptionReportConfirmation(d, CONFIG, schedule, 0);
    expect(msg.text).toContain('Emma & Jake');
  });
});

describe('durationQuestion', () => {
  it('sends to reporting parent with 4 options', () => {
    const d = createDisruption('parent_b', 'work_emergency', '2026-03-09');
    const msg = durationQuestion(d);
    expect(msg.recipient).toBe('parent_b');
    expect(msg.type).toBe('DURATION_QUESTION');
    expect(msg.text).toContain('Today only');
    expect(msg.text).toContain('2-3 days');
    expect(msg.text).toContain('About a week');
    expect(msg.text).toContain('Not sure');
  });
});

describe('coverageRequest', () => {
  it('sends to OTHER parent', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const schedule = makeSchedule(56);
    const withDuration = setDuration(d, 'today_only', schedule, 0);
    const msg = coverageRequest(withDuration, CONFIG);
    expect(msg.recipient).toBe('parent_b');
    expect(msg.type).toBe('COVERAGE_REQUEST');
  });

  it('includes reporter label and event', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const schedule = makeSchedule(56);
    const withDuration = setDuration(d, 'today_only', schedule, 0);
    const msg = coverageRequest(withDuration, CONFIG);
    expect(msg.text).toContain('Mom');
    expect(msg.text).toContain('child illness');
  });

  it('includes duration text', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const schedule = makeSchedule(56);
    const today = setDuration(d, 'today_only', schedule, 0);
    expect(coverageRequest(today, CONFIG).text).toContain('today');

    const multi = setDuration(d, '2_3_days', schedule, 0);
    expect(coverageRequest(multi, CONFIG).text).toContain('2-3 days');

    const week = setDuration(d, 'week', schedule, 0);
    expect(coverageRequest(week, CONFIG).text).toContain('this week');
  });
});

describe('proposalBundleMessage', () => {
  it('sends to other parent with options', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const schedule = makeSchedule(56);
    const withDuration = setDuration(d, 'today_only', schedule, 0);
    const bundle: ProposalBundle = {
      disruptionId: d.id,
      options: [
        { id: 'opt-1', label: 'Full coverage', description: 'test', coverageDays: [], compensationDays: [], fairnessImpact: { parentADelta: -1, parentBDelta: 1 }, transitionImpact: 2, routineImpact: 'minor' },
        { id: 'opt-2', label: 'Partial', description: 'test', coverageDays: [], compensationDays: [], fairnessImpact: { parentADelta: 0, parentBDelta: 0 }, transitionImpact: 0, routineImpact: 'minor' },
      ],
      generatedAt: '',
    };
    const withProposals = attachProposals(withDuration, bundle);
    const msg = proposalBundleMessage(withProposals, bundle, CONFIG);
    expect(msg.recipient).toBe('parent_b');
    expect(msg.type).toBe('PROPOSAL_BUNDLE');
    expect(msg.text).toContain('1. Full coverage');
    expect(msg.text).toContain('2. Partial');
    expect(msg.text).toContain('3. Decline all');
  });
});

describe('proposalSelectedMessage', () => {
  it('sends different messages to each parent', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const schedule = makeSchedule(56);
    const msgs = proposalSelectedMessage(d, 'Full coverage', CONFIG, schedule, 0);
    expect(msgs.reporter.recipient).toBe('parent_a');
    expect(msgs.other.recipient).toBe('parent_b');
    expect(msgs.reporter.text).toContain('Dad accepted');
    expect(msgs.other.text).toContain('Coverage confirmed');
  });

  it('includes schedule metrics', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const schedule = makeSchedule(56);
    const msgs = proposalSelectedMessage(d, 'Full coverage', CONFIG, schedule, 0);
    expect(msgs.reporter.text).toContain('nights');
    expect(msgs.reporter.text).toContain('Stability');
  });
});

describe('declineConfirmation', () => {
  it('sends different messages to each parent', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const msgs = declineConfirmation(d, CONFIG);
    expect(msgs.reporter.recipient).toBe('parent_a');
    expect(msgs.other.recipient).toBe('parent_b');
    expect(msgs.reporter.text).toContain('Dad declined');
    expect(msgs.other.text).toContain('Coverage declined');
    expect(msgs.reporter.text).toContain('Base schedule remains');
  });
});

describe('manageSelfConfirmation', () => {
  it('sends only to reporting parent', () => {
    const d = createDisruption('parent_b', 'work_emergency', '2026-03-09');
    const msg = manageSelfConfirmation(d, CONFIG);
    expect(msg.recipient).toBe('parent_b');
    expect(msg.text).toContain('No coverage request');
    expect(msg.text).toContain('Schedule unchanged');
  });
});

describe('followupCheck', () => {
  it('sends to reporting parent with resume options', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const msg = followupCheck(d, CONFIG);
    expect(msg.recipient).toBe('parent_a');
    expect(msg.type).toBe('FOLLOWUP_CHECK');
    expect(msg.text).toContain('resume normal schedule');
    expect(msg.text).toContain('extend coverage');
  });
});

describe('getQuickActions', () => {
  it('returns empty array when no disruption', () => {
    expect(getQuickActions(null, 'parent_a')).toEqual([]);
  });

  it('returns reporter options for DISRUPTION_REPORTED', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const actions = getQuickActions(d, 'parent_a');
    expect(actions).toContain('Request coverage');
    expect(actions).toContain('Manage myself');
  });

  it('returns empty for non-reporter in DISRUPTION_REPORTED', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    expect(getQuickActions(d, 'parent_b')).toEqual([]);
  });

  it('returns duration options for DURATION_ASKED', () => {
    const d: ActiveDisruption = { ...createDisruption('parent_a', 'child_sick', '2026-03-09'), state: 'DURATION_ASKED' };
    const actions = getQuickActions(d, 'parent_a');
    expect(actions).toContain('Today only');
    expect(actions).toContain('2-3 days');
  });

  it('returns option labels for PROPOSALS_GENERATED for other parent', () => {
    const d: ActiveDisruption = {
      ...createDisruption('parent_a', 'child_sick', '2026-03-09'),
      state: 'PROPOSALS_GENERATED',
      proposals: {
        disruptionId: 'x',
        options: [
          { id: 'a', label: 'Full', description: '', coverageDays: [], compensationDays: [], fairnessImpact: { parentADelta: 0, parentBDelta: 0 }, transitionImpact: 0, routineImpact: 'none' },
          { id: 'b', label: 'Partial', description: '', coverageDays: [], compensationDays: [], fairnessImpact: { parentADelta: 0, parentBDelta: 0 }, transitionImpact: 0, routineImpact: 'none' },
        ],
        generatedAt: '',
      },
    };
    const actions = getQuickActions(d, 'parent_b');
    expect(actions).toContain('Option 1');
    expect(actions).toContain('Option 2');
    expect(actions).toContain('Decline');
  });

  it('returns followup options for FOLLOWUP_PENDING (reporter only)', () => {
    const d: ActiveDisruption = { ...createDisruption('parent_a', 'child_sick', '2026-03-09'), state: 'FOLLOWUP_PENDING' };
    expect(getQuickActions(d, 'parent_a')).toContain('Yes, resume');
    expect(getQuickActions(d, 'parent_b')).toEqual([]);
  });
});
