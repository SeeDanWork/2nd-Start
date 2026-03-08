import { describe, it, expect } from 'vitest';
import {
  computeDisruptionId,
  isDuplicateDisruption,
  createDisruption,
  setDuration,
  attachProposals,
  selectProposal,
  declineAllProposals,
  markFollowupPending,
  resolveDisruption,
  classifyDisruptionType,
  DISRUPTION_LABELS,
  ActiveDisruption,
  ProposalBundle,
} from '../lib/disruption-engine';

// ── Helper: make a schedule slice for duration tests ──
function makeSchedule(days: number): import('../lib/types').ScheduleDay[] {
  const schedule: import('../lib/types').ScheduleDay[] = [];
  const start = new Date('2026-03-09');
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    schedule.push({
      date: d.toISOString().split('T')[0],
      assignedTo: i % 7 < 5 ? 'parent_a' : 'parent_b',
      isTransition: i > 0 && ((i % 7 === 5) || (i % 7 === 0)),
    });
  }
  return schedule;
}

describe('computeDisruptionId', () => {
  it('produces a 16-char hex string', () => {
    const id = computeDisruptionId('parent_a', 'child_sick', '2026-03-09');
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[a-f0-9]{16}$/);
  });

  it('is deterministic for same inputs', () => {
    const a = computeDisruptionId('parent_a', 'child_sick', '2026-03-09');
    const b = computeDisruptionId('parent_a', 'child_sick', '2026-03-09');
    expect(a).toBe(b);
  });

  it('differs for different parent', () => {
    const a = computeDisruptionId('parent_a', 'child_sick', '2026-03-09');
    const b = computeDisruptionId('parent_b', 'child_sick', '2026-03-09');
    expect(a).not.toBe(b);
  });

  it('differs for different event type', () => {
    const a = computeDisruptionId('parent_a', 'child_sick', '2026-03-09');
    const b = computeDisruptionId('parent_a', 'work_emergency', '2026-03-09');
    expect(a).not.toBe(b);
  });

  it('differs for different date', () => {
    const a = computeDisruptionId('parent_a', 'child_sick', '2026-03-09');
    const b = computeDisruptionId('parent_a', 'child_sick', '2026-03-10');
    expect(a).not.toBe(b);
  });
});

describe('isDuplicateDisruption', () => {
  it('returns false for empty list', () => {
    expect(isDuplicateDisruption([], 'parent_a', 'child_sick', '2026-03-09')).toBe(false);
  });

  it('returns true for active matching disruption', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    expect(isDuplicateDisruption([d], 'parent_a', 'child_sick', '2026-03-09')).toBe(true);
  });

  it('returns false for resolved disruption with same id', () => {
    const d = resolveDisruption(createDisruption('parent_a', 'child_sick', '2026-03-09'));
    expect(isDuplicateDisruption([d], 'parent_a', 'child_sick', '2026-03-09')).toBe(false);
  });

  it('returns false for different event type', () => {
    const d = createDisruption('parent_a', 'work_emergency', '2026-03-09');
    expect(isDuplicateDisruption([d], 'parent_a', 'child_sick', '2026-03-09')).toBe(false);
  });
});

describe('createDisruption', () => {
  it('creates with DISRUPTION_REPORTED state', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    expect(d.state).toBe('DISRUPTION_REPORTED');
    expect(d.reportingParent).toBe('parent_a');
    expect(d.otherParent).toBe('parent_b');
    expect(d.eventType).toBe('child_sick');
    expect(d.duration).toBeNull();
    expect(d.proposals).toBeNull();
    expect(d.selectedProposalId).toBeNull();
    expect(d.resolvedAt).toBeNull();
    expect(d.affectedDays).toEqual([]);
  });

  it('sets otherParent correctly for parent_b reporter', () => {
    const d = createDisruption('parent_b', 'work_emergency', '2026-03-09');
    expect(d.reportingParent).toBe('parent_b');
    expect(d.otherParent).toBe('parent_a');
  });
});

describe('State machine transitions', () => {
  const schedule = makeSchedule(56);

  it('setDuration transitions to COVERAGE_REQUESTED', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const withDuration = setDuration(d, 'today_only', schedule, 0);
    expect(withDuration.state).toBe('COVERAGE_REQUESTED');
    expect(withDuration.duration).toBe('today_only');
    expect(withDuration.affectedDays).toHaveLength(1);
  });

  it('today_only affects 1 day', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const r = setDuration(d, 'today_only', schedule, 0);
    expect(r.affectedDays).toHaveLength(1);
    expect(r.affectedDays[0]).toBe(schedule[0].date);
  });

  it('2_3_days affects 3 days', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const r = setDuration(d, '2_3_days', schedule, 0);
    expect(r.affectedDays).toHaveLength(3);
  });

  it('week affects 7 days', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const r = setDuration(d, 'week', schedule, 0);
    expect(r.affectedDays).toHaveLength(7);
  });

  it('unknown defaults to 3 affected days', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const r = setDuration(d, 'unknown', schedule, 0);
    expect(r.affectedDays).toHaveLength(3);
  });

  it('setDuration handles empty schedule gracefully', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const r = setDuration(d, 'today_only', [], 0);
    expect(r.state).toBe('DURATION_ASKED');
    expect(r.affectedDays).toEqual([]);
  });

  it('attachProposals transitions to PROPOSALS_GENERATED', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const bundle: ProposalBundle = { disruptionId: d.id, options: [], generatedAt: '' };
    const r = attachProposals(d, bundle);
    expect(r.state).toBe('PROPOSALS_GENERATED');
    expect(r.proposals).toBe(bundle);
  });

  it('selectProposal transitions to RESOLUTION_APPLIED', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const r = selectProposal(d, 'opt-1');
    expect(r.state).toBe('RESOLUTION_APPLIED');
    expect(r.selectedProposalId).toBe('opt-1');
  });

  it('declineAllProposals transitions to RESOLUTION_APPLIED with null selection', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const r = declineAllProposals(d);
    expect(r.state).toBe('RESOLUTION_APPLIED');
    expect(r.selectedProposalId).toBeNull();
  });

  it('markFollowupPending transitions to FOLLOWUP_PENDING', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const r = markFollowupPending(d);
    expect(r.state).toBe('FOLLOWUP_PENDING');
  });

  it('resolveDisruption transitions to RESOLVED with timestamp', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const r = resolveDisruption(d);
    expect(r.state).toBe('RESOLVED');
    expect(r.resolvedAt).toBeTruthy();
  });

  it('full lifecycle: REPORTED -> COVERAGE -> PROPOSALS -> RESOLUTION -> FOLLOWUP -> RESOLVED', () => {
    let d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    expect(d.state).toBe('DISRUPTION_REPORTED');

    d = setDuration(d, '2_3_days', schedule, 0);
    expect(d.state).toBe('COVERAGE_REQUESTED');

    const bundle: ProposalBundle = { disruptionId: d.id, options: [], generatedAt: '' };
    d = attachProposals(d, bundle);
    expect(d.state).toBe('PROPOSALS_GENERATED');

    d = selectProposal(d, 'opt-1');
    expect(d.state).toBe('RESOLUTION_APPLIED');

    d = markFollowupPending(d);
    expect(d.state).toBe('FOLLOWUP_PENDING');

    d = resolveDisruption(d);
    expect(d.state).toBe('RESOLVED');
    expect(d.resolvedAt).toBeTruthy();
  });

  it('immutability: transitions return new objects', () => {
    const d = createDisruption('parent_a', 'child_sick', '2026-03-09');
    const d2 = setDuration(d, 'today_only', schedule, 0);
    expect(d).not.toBe(d2);
    expect(d.state).toBe('DISRUPTION_REPORTED');
    expect(d2.state).toBe('COVERAGE_REQUESTED');
  });
});

describe('classifyDisruptionType', () => {
  it('detects child_sick', () => {
    expect(classifyDisruptionType('Child becomes sick at school')).toBe('child_sick');
    expect(classifyDisruptionType('kid sick with flu')).toBe('child_sick');
    // "threw up" matches child_sick via /threw up/
    expect(classifyDisruptionType('child threw up at school')).toBe('child_sick');
  });

  it('detects parent_sick', () => {
    expect(classifyDisruptionType('I am feeling sick')).toBe('parent_sick');
    expect(classifyDisruptionType('not feeling well today')).toBe('parent_sick');
    expect(classifyDisruptionType('I have a fever')).toBe('parent_sick');
  });

  it('detects work_emergency', () => {
    expect(classifyDisruptionType('Work emergency came up')).toBe('work_emergency');
    expect(classifyDisruptionType('I got called in for overtime')).toBe('work_emergency');
    expect(classifyDisruptionType('Business trip next week')).toBe('work_emergency');
  });

  it('detects transport_failure', () => {
    expect(classifyDisruptionType('My car broke down')).toBe('transport_failure');
    expect(classifyDisruptionType('Flat tire on the highway')).toBe('transport_failure');
  });

  it('detects school_closure', () => {
    expect(classifyDisruptionType('School closed due to snow')).toBe('school_closure');
    expect(classifyDisruptionType('No school today — snow day')).toBe('school_closure');
  });

  it('detects family_emergency', () => {
    expect(classifyDisruptionType('Family emergency at the hospital')).toBe('family_emergency');
    expect(classifyDisruptionType('There was an accident')).toBe('family_emergency');
  });

  it('detects schedule_conflict', () => {
    expect(classifyDisruptionType('Schedule conflict with a doctor')).toBe('schedule_conflict');
    expect(classifyDisruptionType('I double-booked myself')).toBe('schedule_conflict');
  });

  it('returns other for unrecognized text', () => {
    expect(classifyDisruptionType('The weather is nice')).toBe('other');
    expect(classifyDisruptionType('')).toBe('other');
  });
});

describe('DISRUPTION_LABELS', () => {
  it('has labels for all event types', () => {
    const types = ['parent_sick', 'child_sick', 'work_emergency', 'transport_failure',
      'school_closure', 'family_emergency', 'schedule_conflict', 'other'] as const;
    for (const t of types) {
      expect(DISRUPTION_LABELS[t]).toBeTruthy();
      expect(typeof DISRUPTION_LABELS[t]).toBe('string');
    }
  });
});
