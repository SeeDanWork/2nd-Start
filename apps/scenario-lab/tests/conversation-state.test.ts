import { describe, it, expect } from 'vitest';
import {
  getConversationPhase,
  buildAnsweredTopics,
  getLastSystemMessage,
  isOnboardingDone,
  resolveParentContext,
} from '../lib/conversation/state';
import { Scenario, Message } from '../lib/types';

function makeMessage(from: 'user' | 'system', text: string, phone = '+1111'): Message {
  return { id: 'msg-' + Math.random(), from, text, timestamp: new Date().toISOString(), phone };
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test-1',
    config: {
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
    },
    status: 'draft',
    messagesA: [],
    messagesB: [],
    logs: [],
    schedule: [],
    currentDay: 0,
    activeDisruptions: [],
    bootstrapFacts: null,
    familyId: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe('getConversationPhase', () => {
  it('returns not_started for empty scenario', () => {
    expect(getConversationPhase(makeScenario())).toBe('not_started');
  });

  it('returns onboarding when messages exist but no schedule', () => {
    expect(getConversationPhase(makeScenario({
      messagesA: [makeMessage('system', 'Welcome!')],
    }))).toBe('onboarding');
  });

  it('returns onboarding_complete when schedule exists but day=0', () => {
    expect(getConversationPhase(makeScenario({
      schedule: [{ date: '2026-03-09', assignedTo: 'parent_a', isTransition: false }],
    }))).toBe('onboarding_complete');
  });

  it('returns simulating when schedule exists and day>0', () => {
    expect(getConversationPhase(makeScenario({
      schedule: [{ date: '2026-03-09', assignedTo: 'parent_a', isTransition: false }],
      currentDay: 5,
    }))).toBe('simulating');
  });

  it('returns disruption_active when active disruptions exist', () => {
    expect(getConversationPhase(makeScenario({
      activeDisruptions: [{
        id: 'x', state: 'COVERAGE_REQUESTED', eventType: 'child_sick',
        reportingParent: 'parent_a', otherParent: 'parent_b',
        duration: null, coverageType: null, reportedAt: '', affectedDays: [],
        proposals: null, selectedProposalId: null, resolvedAt: null,
      }],
    }))).toBe('disruption_active');
  });

  it('returns completed for completed scenario', () => {
    expect(getConversationPhase(makeScenario({ status: 'completed' }))).toBe('completed');
  });

  it('ignores resolved disruptions', () => {
    expect(getConversationPhase(makeScenario({
      schedule: [{ date: '2026-03-09', assignedTo: 'parent_a', isTransition: false }],
      currentDay: 5,
      activeDisruptions: [{
        id: 'x', state: 'RESOLVED', eventType: 'child_sick',
        reportingParent: 'parent_a', otherParent: 'parent_b',
        duration: null, coverageType: null, reportedAt: '', affectedDays: [],
        proposals: null, selectedProposalId: null, resolvedAt: '2026-03-10',
      }],
    }))).toBe('simulating');
  });
});

describe('buildAnsweredTopics', () => {
  it('returns empty set for no messages', () => {
    expect(buildAnsweredTopics([]).size).toBe(0);
  });

  it('marks topic as answered when user replies to system', () => {
    const messages = [
      makeMessage('system', 'How many children do you have?'),
      makeMessage('user', 'I have 2 kids'),
    ];
    const topics = buildAnsweredTopics(messages);
    expect(topics.has('children_count')).toBe(true);
  });

  it('does not mark topic if no user reply follows', () => {
    const messages = [
      makeMessage('system', 'How many children do you have?'),
    ];
    const topics = buildAnsweredTopics(messages);
    expect(topics.size).toBe(0);
  });

  it('handles multiple QA pairs', () => {
    const messages = [
      makeMessage('system', 'How many children do you have?'),
      makeMessage('user', '2 kids'),
      makeMessage('system', 'How does custody work?'),
      makeMessage('user', 'Alternating weeks'),
    ];
    const topics = buildAnsweredTopics(messages);
    expect(topics.has('children_count')).toBe(true);
    expect(topics.has('arrangement')).toBe(true);
  });
});

describe('getLastSystemMessage', () => {
  it('returns empty for no messages', () => {
    expect(getLastSystemMessage([])).toBe('');
  });

  it('returns last system message text', () => {
    const messages = [
      makeMessage('system', 'First'),
      makeMessage('user', 'Reply'),
      makeMessage('system', 'Second'),
    ];
    expect(getLastSystemMessage(messages)).toBe('Second');
  });
});

describe('isOnboardingDone', () => {
  it('returns false for empty messages', () => {
    expect(isOnboardingDone([])).toBe(false);
  });

  it('returns true when last system message is completion', () => {
    const messages = [
      makeMessage('system', "Your family schedule is now created! You can now view your upcoming exchanges."),
    ];
    expect(isOnboardingDone(messages)).toBe(true);
  });

  it('returns false for mid-onboarding', () => {
    const messages = [
      makeMessage('system', 'How many children do you have?'),
    ];
    expect(isOnboardingDone(messages)).toBe(false);
  });
});

describe('resolveParentContext', () => {
  it('resolves parent A correctly', () => {
    const s = makeScenario({
      messagesA: [makeMessage('system', 'Welcome!', '+1111')],
    });
    const ctx = resolveParentContext(s, '+1111');
    expect(ctx.isParentA).toBe(true);
    expect(ctx.messages).toBe(s.messagesA);
  });

  it('resolves parent B correctly', () => {
    const s = makeScenario({
      messagesB: [makeMessage('system', 'Welcome!', '+2222')],
    });
    const ctx = resolveParentContext(s, '+2222');
    expect(ctx.isParentA).toBe(false);
    expect(ctx.messages).toBe(s.messagesB);
  });
});
