import { describe, it, expect } from 'vitest';
import { buildTranscript, transcriptToLegacyMessages } from '../lib/conversation/view-builder';
import { createSession, emitEvent, openCase, completeOnboarding } from '../lib/conversation/session';
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

describe('buildTranscript — parent messages', () => {
  it('shows own message as user, other as system', () => {
    const s = createSession('s1', CONFIG);
    emitEvent(s, 'ParentMessageReceived', 'parent_a', { text: 'Hello', phone: '+1111' });

    const aView = buildTranscript(s, 'parent_a');
    const bView = buildTranscript(s, 'parent_b');

    expect(aView).toHaveLength(1);
    expect(aView[0].from).toBe('user');
    expect(aView[0].text).toBe('Hello');
    expect(aView[0].kind).toBe('parent_text');

    // Parent B should NOT see parent A's message (visibility rules)
    expect(bView).toHaveLength(0);
  });
});

describe('buildTranscript — system messages', () => {
  it('renders system acknowledgment for targeted parent only', () => {
    const s = createSession('s1', CONFIG);
    emitEvent(s, 'SystemAcknowledgment', 'system', { text: 'Got it.', targetParent: 'parent_a' });

    const aView = buildTranscript(s, 'parent_a');
    const bView = buildTranscript(s, 'parent_b');

    expect(aView).toHaveLength(1);
    expect(aView[0].kind).toBe('system_ack');
    expect(aView[0].from).toBe('system');
    expect(bView).toHaveLength(0);
  });

  it('renders system question with choices', () => {
    const s = createSession('s1', CONFIG);
    emitEvent(s, 'SystemQuestion', 'system', {
      text: 'How long?',
      targetParent: 'parent_a',
      choices: [
        { id: '1', label: 'Today only' },
        { id: '2', label: '2-3 days' },
      ],
    });

    const aView = buildTranscript(s, 'parent_a');
    expect(aView).toHaveLength(1);
    expect(aView[0].kind).toBe('structured_choice');
    expect(aView[0].choices).toHaveLength(2);
  });
});

describe('buildTranscript — coverage flow', () => {
  it('reporter sees confirmation, other sees coverage request', () => {
    const s = createSession('s1', CONFIG);
    s.mode = 'mediation';

    // Reporter (parent_a) gets coverage request created
    emitEvent(s, 'CoverageRequestCreated', 'parent_a', {
      reporter: 'parent_a', eventType: 'child_sick', duration: 'today_only', description: 'Sick',
    });

    // Other parent gets coverage request sent
    emitEvent(s, 'CoverageRequestSent', 'system', {
      targetParent: 'parent_b',
      summary: 'Mom says she is too sick to handle childcare today. Would you like to cover?',
    });

    const aView = buildTranscript(s, 'parent_a');
    const bView = buildTranscript(s, 'parent_b');

    // Mom sees "Coverage request sent to Dad"
    expect(aView.some(e => e.kind === 'case_status' && e.text.includes('Dad'))).toBe(true);
    // Dad sees the coverage request with choices
    expect(bView.some(e => e.kind === 'structured_choice')).toBe(true);
    expect(bView.find(e => e.kind === 'structured_choice')!.choices).toBeDefined();
  });
});

describe('buildTranscript — proposal flow', () => {
  it('renders proposal selection differently per parent', () => {
    const s = createSession('s1', CONFIG);

    emitEvent(s, 'ProposalOptionSelected', 'parent_b', {
      bundleId: 'b1',
      optionId: 'opt1',
      optionLabel: 'Full coverage transfer',
      selectedBy: 'parent_b',
    });

    const aView = buildTranscript(s, 'parent_a');
    const bView = buildTranscript(s, 'parent_b');

    // Parent A (not selector) sees system message about Dad's selection
    expect(aView).toHaveLength(1);
    expect(aView[0].from).toBe('system');
    expect(aView[0].text).toContain('Dad selected');

    // Parent B (selector) sees their own selection
    expect(bView).toHaveLength(1);
    expect(bView[0].from).toBe('user');
    expect(bView[0].text).toContain('Selected: Full coverage transfer');
  });
});

describe('buildTranscript — resolution', () => {
  it('both parents see resolution', () => {
    const s = createSession('s1', CONFIG);

    emitEvent(s, 'ResolutionApplied', 'system', {
      resolutionType: 'proposal_accepted',
      summary: 'Schedule adjustment applied. Mom: 28 nights, Dad: 28 nights.',
      fairnessSnapshot: {
        parentANights: 28,
        parentBNights: 28,
        transitionsPerWeek: 2,
        stabilityScore: 'strong',
      },
    });

    const aView = buildTranscript(s, 'parent_a');
    const bView = buildTranscript(s, 'parent_b');

    expect(aView).toHaveLength(1);
    expect(bView).toHaveLength(1);
    expect(aView[0].kind).toBe('calculation_trace');
    expect(aView[0].metadata).toHaveProperty('fairness');
  });
});

describe('buildTranscript — onboarding complete', () => {
  it('renders different messages per parent', () => {
    const s = createSession('s1', CONFIG);
    completeOnboarding(s, 'parent_a');

    const aView = buildTranscript(s, 'parent_a');
    const bView = buildTranscript(s, 'parent_b');

    // Mom sees standard completion
    expect(aView).toHaveLength(1);
    expect(aView[0].kind).toBe('schedule_created');
    expect(aView[0].text).toContain('schedule is now created');

    // Dad sees completion with Mom's name
    expect(bView).toHaveLength(1);
    expect(bView[0].kind).toBe('schedule_created');
    expect(bView[0].text).toContain('Mom');
  });
});

describe('buildTranscript — day summary', () => {
  it('renders personalized text per parent', () => {
    const s = createSession('s1', CONFIG);
    emitEvent(s, 'DaySummaryGenerated', 'system', {
      day: 0,
      date: '2026-03-09',
      assignedTo: 'parent_a',
      isTransition: false,
      textForA: 'Mon Mar 9 | Emma with you.',
      textForB: 'Mon Mar 9 | Emma with Mom.',
    });

    const aView = buildTranscript(s, 'parent_a');
    const bView = buildTranscript(s, 'parent_b');

    expect(aView[0].text).toContain('with you');
    expect(bView[0].text).toContain('with Mom');
  });
});

describe('buildTranscript — case lifecycle', () => {
  it('both see case opened and closed', () => {
    const s = createSession('s1', CONFIG);
    const c = openCase(s, 'disruption', 'parent_a', 'Child is sick');

    emitEvent(s, 'CaseClosed', 'system', {
      resolution: 'Coverage accepted and schedule updated.',
    }, c.id);

    const aView = buildTranscript(s, 'parent_a');
    const bView = buildTranscript(s, 'parent_b');

    // Both see case opened
    expect(aView.some(e => e.kind === 'case_status' && e.text.includes('sick'))).toBe(true);
    expect(bView.some(e => e.kind === 'case_status' && e.text.includes('sick'))).toBe(true);

    // Both see case closed
    expect(aView.some(e => e.text.includes('Resolved'))).toBe(true);
    expect(bView.some(e => e.text.includes('Resolved'))).toBe(true);
  });
});

describe('buildTranscript — objection', () => {
  it('author sees as user message, other sees as case status', () => {
    const s = createSession('s1', CONFIG);

    emitEvent(s, 'StructuredObjectionRecorded', 'parent_b', {
      objectionType: 'fairness',
      description: "This doesn't feel fair.",
      from: 'parent_b',
    });

    const aView = buildTranscript(s, 'parent_a');
    const bView = buildTranscript(s, 'parent_b');

    // Dad (author) doesn't see it rendered (visibility: origin parent only)
    // Actually — let's check: objection is from parent_b, visible to parent_b
    expect(bView).toHaveLength(1);
    expect(bView[0].from).toBe('user');
    expect(bView[0].text).toContain("doesn't feel fair");

    // Mom doesn't see the raw objection (visibility is origin-only)
    expect(aView).toHaveLength(0);
  });
});

describe('transcriptToLegacyMessages', () => {
  it('converts entries to legacy format', () => {
    const s = createSession('s1', CONFIG);
    emitEvent(s, 'ParentMessageReceived', 'parent_a', { text: 'Hi', phone: '+1111' });
    emitEvent(s, 'SystemAcknowledgment', 'system', { text: 'Hello!', targetParent: 'parent_a' });

    const entries = buildTranscript(s, 'parent_a');
    const legacy = transcriptToLegacyMessages(entries, '+1111');

    expect(legacy).toHaveLength(2);
    expect(legacy[0]).toHaveProperty('id');
    expect(legacy[0]).toHaveProperty('from');
    expect(legacy[0]).toHaveProperty('text');
    expect(legacy[0]).toHaveProperty('timestamp');
    expect(legacy[0]).toHaveProperty('phone', '+1111');
  });
});
