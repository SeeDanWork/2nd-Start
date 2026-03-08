import { describe, it, expect } from 'vitest';
import {
  createSession,
  emitEvent,
  openCase,
  getActiveCase,
  getExpectedResponder,
  isParentOnboarded,
  completeOnboarding,
  enterMediation,
  exitMediation,
  getSessionContext,
} from '../lib/conversation/session';
import { ScenarioConfig } from '../lib/types';

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

describe('createSession', () => {
  it('creates a session with correct defaults', () => {
    const s = createSession('scenario-1', CONFIG);
    expect(s.id).toBeTruthy();
    expect(s.id.length).toBe(16);
    expect(s.scenarioId).toBe('scenario-1');
    expect(s.mode).toBe('onboarding');
    expect(s.events.length).toBe(0);
    expect(s.pendingResponseFrom).toBeNull();
    expect(s.onboarding.parentA.completed).toBe(false);
    expect(s.onboarding.parentB.completed).toBe(false);
    expect(s.schedule).toEqual([]);
    expect(s.currentDay).toBe(0);
  });
});

describe('emitEvent', () => {
  it('appends event to stream', () => {
    const s = createSession('scenario-1', CONFIG);
    const event = emitEvent(s, 'ParentMessageReceived', 'parent_a', { text: 'hi', phone: '+1111' });

    expect(s.events.length).toBe(1);
    expect(event.kind).toBe('ParentMessageReceived');
    expect(event.sessionId).toBe(s.id);
  });

  it('links event to case when caseId provided', () => {
    const s = createSession('scenario-1', CONFIG);
    const c = s.cases.openCase(s.id, 'disruption', 'parent_a', 'Sick');
    emitEvent(s, 'CoverageRequestCreated', 'parent_a', {
      reporter: 'parent_a', eventType: 'child_sick', duration: 'today_only', description: 'Child is sick',
    }, c.id);

    expect(c.relatedEventIds).toHaveLength(1);
  });
});

describe('openCase', () => {
  it('creates case and emits CaseOpened event', () => {
    const s = createSession('scenario-1', CONFIG);
    const c = openCase(s, 'disruption', 'parent_a', 'Child sick');

    expect(c.type).toBe('disruption');
    expect(c.initiator).toBe('parent_a');
    expect(s.events.length).toBe(1);
    expect(s.events.all()[0].kind).toBe('CaseOpened');
    // CaseOpened event should be linked to the case
    expect(c.relatedEventIds).toHaveLength(1);
  });
});

describe('getActiveCase', () => {
  it('returns null when no cases', () => {
    const s = createSession('scenario-1', CONFIG);
    expect(getActiveCase(s)).toBeNull();
  });

  it('returns active case', () => {
    const s = createSession('scenario-1', CONFIG);
    const c = openCase(s, 'disruption', 'parent_a', 'Sick');
    expect(getActiveCase(s)).toBe(c);
  });

  it('excludes resolved cases', () => {
    const s = createSession('scenario-1', CONFIG);
    const c = openCase(s, 'disruption', 'parent_a', 'Sick');
    s.cases.transitionStatus(c.id, 'resolved', 'Done');
    expect(getActiveCase(s)).toBeNull();
  });
});

describe('getExpectedResponder', () => {
  it('returns parent_a during onboarding', () => {
    const s = createSession('scenario-1', CONFIG);
    expect(getExpectedResponder(s)).toBe('parent_a');
  });

  it('returns parent_b when parent_a is done', () => {
    const s = createSession('scenario-1', CONFIG);
    s.onboarding.parentA.completed = true;
    expect(getExpectedResponder(s)).toBe('parent_b');
  });

  it('returns system when both done', () => {
    const s = createSession('scenario-1', CONFIG);
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;
    expect(getExpectedResponder(s)).toBe('system');
  });

  it('returns case pendingResponseFrom when case active', () => {
    const s = createSession('scenario-1', CONFIG);
    s.mode = 'operational';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;
    const c = openCase(s, 'disruption', 'parent_a', 'Sick');
    s.cases.setPendingResponse(c.id, 'parent_b');
    expect(getExpectedResponder(s)).toBe('parent_b');
  });
});

describe('isParentOnboarded', () => {
  it('returns false initially', () => {
    const s = createSession('scenario-1', CONFIG);
    expect(isParentOnboarded(s, 'parent_a')).toBe(false);
    expect(isParentOnboarded(s, 'parent_b')).toBe(false);
  });
});

describe('completeOnboarding', () => {
  it('marks parent as complete and emits event', () => {
    const s = createSession('scenario-1', CONFIG);
    completeOnboarding(s, 'parent_a');

    expect(s.onboarding.parentA.completed).toBe(true);
    expect(s.events.has('OnboardingComplete')).toBe(true);
    expect(s.mode).toBe('onboarding'); // Still onboarding (B not done)
  });

  it('transitions to operational when both complete', () => {
    const s = createSession('scenario-1', CONFIG);
    completeOnboarding(s, 'parent_a');
    completeOnboarding(s, 'parent_b');

    expect(s.mode).toBe('operational');
    expect(s.events.count('OnboardingComplete')).toBe(2);
  });
});

describe('enterMediation / exitMediation', () => {
  it('enters mediation mode', () => {
    const s = createSession('scenario-1', CONFIG);
    s.mode = 'operational';
    enterMediation(s);
    expect(s.mode).toBe('mediation');
  });

  it('exits to operational when no active cases', () => {
    const s = createSession('scenario-1', CONFIG);
    s.mode = 'mediation';
    exitMediation(s);
    expect(s.mode).toBe('operational');
  });

  it('stays in mediation when active cases remain', () => {
    const s = createSession('scenario-1', CONFIG);
    s.mode = 'mediation';
    openCase(s, 'disruption', 'parent_a', 'Sick');
    exitMediation(s);
    expect(s.mode).toBe('mediation');
  });
});

describe('getSessionContext', () => {
  it('returns summary of session state', () => {
    const s = createSession('scenario-1', CONFIG);
    const ctx = getSessionContext(s);

    expect(ctx.mode).toBe('onboarding');
    expect(ctx.scheduleExists).toBe(false);
    expect(ctx.currentDay).toBe(0);
    expect(ctx.onboardingA).toBe(false);
    expect(ctx.onboardingB).toBe(false);
    expect(ctx.activeCaseCount).toBe(0);
    expect(ctx.childNames).toEqual(['Emma']);
    expect(ctx.parentALabel).toBe('Mom');
    expect(ctx.parentBLabel).toBe('Dad');
  });
});
