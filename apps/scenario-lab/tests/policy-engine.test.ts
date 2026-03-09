import { describe, it, expect } from 'vitest';
import { processMessageSync, buildLLMContext } from '../lib/conversation/policy-engine';
import { createSession, getActiveCase } from '../lib/conversation/session';
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

describe('buildLLMContext', () => {
  it('builds context from session', () => {
    const s = createSession('s1', CONFIG);
    const ctx = buildLLMContext(s, 'parent_a', 'Hello');

    expect(ctx.mode).toBe('onboarding');
    expect(ctx.sender).toBe('parent_a');
    expect(ctx.messageText).toBe('Hello');
    expect(ctx.family.childNames).toEqual(['Emma']);
    expect(ctx.family.parentALabel).toBe('Mom');
    expect(ctx.schedule.exists).toBe(false);
    expect(ctx.onboarding.parentADone).toBe(false);
    expect(ctx.activeCase).toBeNull();
  });

  it('includes active case when present', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'mediation';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;
    const c = s.cases.openCase(s.id, 'disruption', 'parent_a', 'Child sick');

    const ctx = buildLLMContext(s, 'parent_b', 'I can cover');
    expect(ctx.activeCase).not.toBeNull();
    expect(ctx.activeCase!.id).toBe(c.id);
    expect(ctx.activeCase!.type).toBe('disruption');
  });
});

describe('processMessageSync — onboarding', () => {
  it('advances onboarding when topics detected', () => {
    const s = createSession('s1', CONFIG);
    const result = processMessageSync(s, 'parent_a', 'We have 2 kids aged 5 and 8');

    expect(result.interpretation.intent).toBe('onboarding_answer');
    expect(result.recommendation.nextStep).toBe('advance_onboarding');
    expect(result.eventsEmitted.length).toBeGreaterThanOrEqual(3); // message + intent + onboarding step
    expect(s.onboarding.parentA.started).toBe(true);
    expect(s.events.has('OnboardingStepCompleted')).toBe(true);
  });

  it('completes onboarding on confirm', () => {
    const s = createSession('s1', CONFIG);
    const result = processMessageSync(s, 'parent_a', 'Yes, looks good');

    expect(result.interpretation.intent).toBe('onboarding_answer');
    expect(result.recommendation.nextStep).toBe('complete_onboarding');
    expect(s.onboarding.parentA.completed).toBe(true);
    expect(s.events.has('OnboardingComplete')).toBe(true);
  });

  it('transitions to operational when both parents complete', () => {
    const s = createSession('s1', CONFIG);
    processMessageSync(s, 'parent_a', 'Yes, confirm');
    expect(s.mode).toBe('onboarding'); // B not done yet

    processMessageSync(s, 'parent_b', 'Yes, approve');
    expect(s.mode).toBe('operational');
    expect(s.events.count('OnboardingComplete')).toBe(2);
  });
});

describe('processMessageSync — disruption reporting', () => {
  it('opens a case for disruption report', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'operational';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;

    const result = processMessageSync(s, 'parent_a', 'My kid is sick with a fever');

    expect(result.interpretation.intent).toBe('report_disruption');
    expect(result.recommendation.nextStep).toBe('open_case');
    expect(s.mode).toBe('mediation');
    expect(result.modeChanged).toBe(true);

    const activeCase = getActiveCase(s);
    expect(activeCase).not.toBeNull();
    expect(activeCase!.type).toBe('disruption');
    expect(activeCase!.initiator).toBe('parent_a');

    // Other parent should be notified
    expect(s.events.has('CoverageRequestSent')).toBe(true);
    expect(activeCase!.pendingResponseFrom).toBe('parent_b');
  });

  it('asks clarification for ambiguous disruption', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'operational';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;

    // Message that triggers disruption but with low confidence and unknown type
    const result = processMessageSync(s, 'parent_a', "emergency! something happened, not sure what");

    expect(result.interpretation.intent).toBe('report_disruption');
    // Should either open case or ask clarification depending on ambiguity
    expect(['open_case', 'ask_clarification']).toContain(result.recommendation.nextStep);
  });
});

describe('processMessageSync — coverage request', () => {
  it('opens coverage_request case', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'operational';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;

    const result = processMessageSync(s, 'parent_a', 'Can you cover for me today?');

    expect(result.interpretation.intent).toBe('request_coverage');
    expect(result.recommendation.nextStep).toBe('open_case');
    expect(result.recommendation.caseType).toBe('coverage_request');

    const activeCase = getActiveCase(s);
    expect(activeCase).not.toBeNull();
    expect(activeCase!.type).toBe('coverage_request');
  });
});

describe('processMessageSync — confirm/reject with active case', () => {
  it('updates case on confirm', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'mediation';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;
    s.cases.openCase(s.id, 'disruption', 'parent_a', 'Child sick');

    const result = processMessageSync(s, 'parent_b', 'Yes, I can help');

    expect(result.interpretation.intent).toBe('confirm_action');
    expect(result.recommendation.nextStep).toBe('update_case');

    const activeCase = getActiveCase(s);
    expect(activeCase!.status).toBe('resolution_pending');
  });

  it('updates case on reject', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'mediation';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;
    s.cases.openCase(s.id, 'disruption', 'parent_a', 'Child sick');

    const result = processMessageSync(s, 'parent_b', "No, I can't do that");

    expect(result.interpretation.intent).toBe('reject_action');
    expect(result.recommendation.nextStep).toBe('update_case');

    const activeCase = getActiveCase(s);
    expect(activeCase!.status).toBe('proposals_pending');
  });
});

describe('processMessageSync — counter proposal', () => {
  it('triggers generate_proposals', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'mediation';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;
    const c = s.cases.openCase(s.id, 'disruption', 'parent_a', 'Child sick');
    s.cases.transitionStatus(c.id, 'awaiting_selection', 'Test');

    const result = processMessageSync(s, 'parent_b', 'How about instead we try something else?');

    expect(result.interpretation.intent).toBe('counter_proposal');
    expect(result.recommendation.nextStep).toBe('generate_proposals');
  });
});

describe('processMessageSync — complaint', () => {
  it('shows metrics for fairness complaint', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'operational';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;

    const result = processMessageSync(s, 'parent_a', "This isn't fair, I always get less time");

    expect(result.interpretation.intent).toBe('complaint');
    expect(result.recommendation.nextStep).toBe('show_metrics');
  });
});

describe('processMessageSync — feedback', () => {
  it('records feedback and sends acknowledgment', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'operational';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;

    const result = processMessageSync(s, 'parent_a', 'Thanks, that was great');

    expect(result.interpretation.intent).toBe('provide_feedback');
    expect(result.recommendation.nextStep).toBe('record_feedback_only');
    expect(s.events.has('FeedbackRecorded')).toBe(true);
    expect(s.events.has('SystemAcknowledgment')).toBe(true);
  });
});

describe('processMessageSync — schedule question', () => {
  it('recommends show_metrics', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'operational';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;

    const result = processMessageSync(s, 'parent_a', 'When is the next exchange?');

    expect(result.interpretation.intent).toBe('ask_schedule_question');
    expect(result.recommendation.nextStep).toBe('show_metrics');
  });
});

describe('processMessageSync — unknown intent', () => {
  it('acknowledges unknown message', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'operational';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;

    const result = processMessageSync(s, 'parent_a', 'asdfghjkl');

    expect(result.interpretation.intent).toBe('general_unknown');
    expect(result.recommendation.nextStep).toBe('acknowledge');
    expect(s.events.has('SystemAcknowledgment')).toBe(true);
  });
});

describe('processMessageSync — event stream integrity', () => {
  it('always emits ParentMessageReceived and ParentIntentParsed', () => {
    const s = createSession('s1', CONFIG);
    processMessageSync(s, 'parent_a', 'Hello world');

    expect(s.events.has('ParentMessageReceived')).toBe(true);
    expect(s.events.has('ParentIntentParsed')).toBe(true);
  });

  it('records events in correct order', () => {
    const s = createSession('s1', CONFIG);
    processMessageSync(s, 'parent_a', 'Thanks for the help');

    const events = s.events.all();
    const kinds = events.map(e => e.kind);

    // First two should always be message received and intent parsed
    expect(kinds[0]).toBe('ParentMessageReceived');
    expect(kinds[1]).toBe('ParentIntentParsed');
  });

  it('links case events to case ID', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'operational';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;

    processMessageSync(s, 'parent_a', 'My kid is sick with a fever');

    const activeCase = getActiveCase(s);
    expect(activeCase).not.toBeNull();
    expect(activeCase!.relatedEventIds.length).toBeGreaterThan(0);
  });

  it('multiple messages build up event stream', () => {
    const s = createSession('s1', CONFIG);
    processMessageSync(s, 'parent_a', 'We have 2 kids aged 5 and 8');
    processMessageSync(s, 'parent_a', 'We do alternating weeks');

    // Each message should add at least 3 events (message + intent + action)
    expect(s.events.length).toBeGreaterThanOrEqual(6);
  });
});

describe('processMessageSync — clarification flow', () => {
  it('handles clarification answer on active case', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'mediation';
    s.onboarding.parentA.completed = true;
    s.onboarding.parentB.completed = true;
    const c = s.cases.openCase(s.id, 'disruption', 'parent_a', 'Sick');
    s.cases.transitionStatus(c.id, 'awaiting_clarification', 'Test');

    const result = processMessageSync(s, 'parent_a', 'It started yesterday afternoon');

    expect(result.interpretation.intent).toBe('clarification_answer');
    expect(result.recommendation.nextStep).toBe('update_case');

    const activeCase = getActiveCase(s);
    expect(activeCase!.status).toBe('open'); // Back to open from awaiting_clarification
  });
});
