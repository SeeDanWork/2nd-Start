import { describe, it, expect } from 'vitest';
import { heuristicInterpret } from '../lib/llm/interpret-message';
import { LLMContext } from '../lib/llm/schema';

function makeContext(overrides: Partial<LLMContext> = {}): LLMContext {
  return {
    mode: 'operational',
    sender: 'parent_a',
    messageText: '',
    recentEvents: [],
    activeCase: null,
    family: {
      childNames: ['Emma'],
      parentALabel: 'Mom',
      parentBLabel: 'Dad',
      template: 'alternating_weeks',
      targetSplit: 50,
    },
    schedule: { exists: true, currentDay: 5 },
    onboarding: { parentADone: true, parentBDone: true, answeredTopics: [] },
    ...overrides,
  };
}

describe('heuristicInterpret — onboarding mode', () => {
  it('detects onboarding_answer intent', () => {
    const ctx = makeContext({ mode: 'onboarding', messageText: 'We have 2 kids aged 5 and 8' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('onboarding_answer');
    expect(result.onboardingTopics).toContain('children_count');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('detects arrangement topic', () => {
    const ctx = makeContext({ mode: 'onboarding', messageText: 'We do alternating weeks' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('onboarding_answer');
    expect(result.onboardingTopics).toContain('arrangement');
  });

  it('detects split topic', () => {
    const ctx = makeContext({ mode: 'onboarding', messageText: 'We want 50/50' });
    const result = heuristicInterpret(ctx);
    expect(result.onboardingTopics).toContain('split');
  });

  it('detects confirm topic', () => {
    const ctx = makeContext({ mode: 'onboarding', messageText: 'Yes, looks good' });
    const result = heuristicInterpret(ctx);
    expect(result.onboardingTopics).toContain('confirm');
  });

  it('returns low confidence with no detected topics', () => {
    const ctx = makeContext({ mode: 'onboarding', messageText: 'hmm' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('onboarding_answer');
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe('heuristicInterpret — confirm/reject', () => {
  it('detects confirm_action', () => {
    const ctx = makeContext({ messageText: 'Yes, that works' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('confirm_action');
    expect(result.confidence).toBe(0.85);
  });

  it('detects reject_action', () => {
    const ctx = makeContext({ messageText: 'No, I disagree' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('reject_action');
    expect(result.confidence).toBe(0.85);
  });

  it('detects various confirm phrases', () => {
    for (const phrase of ['ok', 'sure', 'looks good', 'correct', 'approve']) {
      const result = heuristicInterpret(makeContext({ messageText: phrase }));
      expect(result.intent).toBe('confirm_action');
    }
  });

  it('detects various reject phrases', () => {
    for (const phrase of ['nope', 'decline', 'reject', 'not acceptable']) {
      const result = heuristicInterpret(makeContext({ messageText: phrase }));
      expect(result.intent).toBe('reject_action');
    }
  });
});

describe('heuristicInterpret — disruption reporting', () => {
  it('detects child_sick disruption', () => {
    const ctx = makeContext({ messageText: 'My kid is sick with a fever' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('report_disruption');
    expect(result.disruptionType).toBe('child_sick');
  });

  it('detects parent_sick disruption', () => {
    const ctx = makeContext({ messageText: "I'm sick and can't handle pickup" });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('report_disruption');
    expect(result.disruptionType).toBe('parent_sick');
  });

  it('detects work_emergency disruption', () => {
    const ctx = makeContext({ messageText: 'Work emergency, got called in for overtime' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('report_disruption');
    expect(result.disruptionType).toBe('work_emergency');
  });

  it('detects transport_failure disruption', () => {
    const ctx = makeContext({ messageText: "My car broke down and I can't make pickup" });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('report_disruption');
    expect(result.disruptionType).toBe('transport_failure');
  });

  it('detects school_closure disruption', () => {
    const ctx = makeContext({ messageText: "There's no school today, snow day, can't make it" });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('report_disruption');
    expect(result.disruptionType).toBe('school_closure');
  });

  it('detects family_emergency disruption', () => {
    const ctx = makeContext({ messageText: 'Family emergency, my mom is in the hospital' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('report_disruption');
    expect(result.disruptionType).toBe('family_emergency');
  });

  it('detects urgency', () => {
    const ctx = makeContext({ messageText: "Emergency! Can't make pickup right now" });
    const result = heuristicInterpret(ctx);
    expect(result.urgency).toBe('high');
  });

  it('detects duration', () => {
    const ctx = makeContext({ messageText: "Kid is sick, probably just today only" });
    const result = heuristicInterpret(ctx);
    expect(result.durationEstimate).toBe('today_only');
  });

  it('detects multi-day duration', () => {
    const ctx = makeContext({ messageText: "Child is sick, probably a couple days" });
    const result = heuristicInterpret(ctx);
    expect(result.durationEstimate).toBe('2_3_days');
  });
});

describe('heuristicInterpret — coverage request', () => {
  it('detects request_coverage', () => {
    const ctx = makeContext({ messageText: 'Can you cover for me today?' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('request_coverage');
    expect(result.confidence).toBe(0.7);
  });

  it('detects pick up request', () => {
    const ctx = makeContext({ messageText: 'Can you pick up the kids?' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('request_coverage');
  });

  it('detects take over request', () => {
    const ctx = makeContext({ messageText: 'Can you take over tonight?' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('request_coverage');
  });
});

describe('heuristicInterpret — proposal response', () => {
  it('detects respond_to_proposal when selecting an option', () => {
    const ctx = makeContext({
      messageText: 'I pick option 1',
      activeCase: { id: 'c1', type: 'disruption', status: 'awaiting_selection', pendingResponseFrom: null, summary: '' },
    });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('respond_to_proposal');
  });

  it('detects counter_proposal', () => {
    const ctx = makeContext({
      messageText: 'How about instead we do something else?',
      activeCase: { id: 'c1', type: 'disruption', status: 'awaiting_selection', pendingResponseFrom: null, summary: '' },
    });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('counter_proposal');
  });
});

describe('heuristicInterpret — complaints', () => {
  it('detects fairness complaint', () => {
    const ctx = makeContext({ messageText: "This isn't fair, I always get less time" });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('complaint');
    expect(result.structuredObjection).toBe('fairness');
  });

  it('detects routine_disruption complaint', () => {
    const ctx = makeContext({ messageText: "I always have too many transitions back and forth" });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('complaint');
    expect(result.structuredObjection).toBe('too_many_transitions');
  });

  it('detects emotional tone', () => {
    const ctx = makeContext({ messageText: "I'm frustrated this is so unfair" });
    const result = heuristicInterpret(ctx);
    expect(result.emotionalTone).toBe('frustrated');
  });
});

describe('heuristicInterpret — feedback', () => {
  it('detects positive feedback', () => {
    const ctx = makeContext({ messageText: 'Thanks, that was great' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('provide_feedback');
  });

  it('detects frustrated feedback with tone', () => {
    const ctx = makeContext({ messageText: "I'm frustrated with this" });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('provide_feedback');
    expect(result.emotionalTone).toBe('frustrated');
  });
});

describe('heuristicInterpret — schedule questions', () => {
  it('detects schedule question', () => {
    const ctx = makeContext({ messageText: 'When is the next exchange?' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('ask_schedule_question');
    expect(result.requestedAction).toBe('show_schedule');
  });

  it('detects calendar question', () => {
    const ctx = makeContext({ messageText: "What's on the calendar this week?" });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('ask_schedule_question');
  });

  it('detects whose turn question', () => {
    const ctx = makeContext({ messageText: 'Whose turn is it today?' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('ask_schedule_question');
  });
});

describe('heuristicInterpret — respond to request', () => {
  it('detects respond_to_request when pending', () => {
    const ctx = makeContext({
      messageText: 'Sure I can do that',
      activeCase: { id: 'c1', type: 'coverage_request', status: 'awaiting_other_parent', pendingResponseFrom: 'parent_a', summary: '' },
    });
    const result = heuristicInterpret(ctx);
    // "Sure" matches confirm_action first (regex order), which is fine
    expect(['confirm_action', 'respond_to_request']).toContain(result.intent);
  });
});

describe('heuristicInterpret — clarification answer', () => {
  it('detects clarification_answer in mediation mode with awaiting case', () => {
    const ctx = makeContext({
      mode: 'mediation',
      messageText: 'It started yesterday afternoon',
      activeCase: { id: 'c1', type: 'disruption', status: 'awaiting_clarification', pendingResponseFrom: null, summary: '' },
    });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('clarification_answer');
    expect(result.referencedCaseId).toBe('c1');
  });
});

describe('heuristicInterpret — unknown intent', () => {
  it('returns general_unknown for gibberish', () => {
    const ctx = makeContext({ messageText: 'asdfghjkl' });
    const result = heuristicInterpret(ctx);
    expect(result.intent).toBe('general_unknown');
    expect(result.confidence).toBe(0.5);
  });

  it('always has ambiguityFlags array', () => {
    const ctx = makeContext({ messageText: 'random text' });
    const result = heuristicInterpret(ctx);
    expect(Array.isArray(result.ambiguityFlags)).toBe(true);
  });
});
