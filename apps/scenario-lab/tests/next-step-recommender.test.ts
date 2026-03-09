import { describe, it, expect } from 'vitest';
import { heuristicRecommend } from '../lib/llm/next-step-recommender';
import { LLMMessageInterpretation, LLMContext } from '../lib/llm/schema';

function makeInterpretation(overrides: Partial<LLMMessageInterpretation> = {}): LLMMessageInterpretation {
  return {
    intent: 'general_unknown',
    ambiguityFlags: [],
    confidence: 0.5,
    ...overrides,
  };
}

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

describe('heuristicRecommend — onboarding', () => {
  it('recommends complete_onboarding on confirm', () => {
    const interp = makeInterpretation({ intent: 'onboarding_answer', onboardingTopics: ['confirm'] });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('complete_onboarding');
    expect(result.confidence).toBe(0.9);
  });

  it('recommends advance_onboarding with topics', () => {
    const interp = makeInterpretation({ intent: 'onboarding_answer', onboardingTopics: ['children_count', 'children_ages'] });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('advance_onboarding');
    expect(result.confidence).toBe(0.8);
  });

  it('recommends advance_onboarding with low confidence when no topics', () => {
    const interp = makeInterpretation({ intent: 'onboarding_answer', onboardingTopics: [] });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('advance_onboarding');
    expect(result.confidence).toBe(0.5);
  });
});

describe('heuristicRecommend — disruption', () => {
  it('recommends open_case for clear disruption', () => {
    const interp = makeInterpretation({
      intent: 'report_disruption',
      disruptionType: 'child_sick',
      confidence: 0.8,
    });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('open_case');
    expect(result.caseType).toBe('disruption');
    expect(result.acknowledgmentText).toContain('child illness');
  });

  it('asks clarification when ambiguity flags present', () => {
    const interp = makeInterpretation({
      intent: 'report_disruption',
      disruptionType: 'other',
      ambiguityFlags: ['duration_unclear'],
      confidence: 0.6,
    });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('ask_clarification');
    expect(result.clarificationField).toBe('duration_unclear');
  });

  it('asks clarification for unknown type with low confidence', () => {
    const interp = makeInterpretation({
      intent: 'report_disruption',
      disruptionType: 'other',
      confidence: 0.4,
    });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('ask_clarification');
    expect(result.clarificationField).toBe('disruption_type');
  });

  it('includes duration in acknowledgment', () => {
    const interp = makeInterpretation({
      intent: 'report_disruption',
      disruptionType: 'child_sick',
      durationEstimate: 'today_only',
      confidence: 0.8,
    });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.acknowledgmentText).toContain('today only');
  });

  it('includes urgency in acknowledgment', () => {
    const interp = makeInterpretation({
      intent: 'report_disruption',
      disruptionType: 'family_emergency',
      urgency: 'high',
      confidence: 0.8,
    });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.acknowledgmentText).toContain('urgent');
  });
});

describe('heuristicRecommend — coverage request', () => {
  it('recommends open_case when no active case', () => {
    const interp = makeInterpretation({ intent: 'request_coverage' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('open_case');
    expect(result.caseType).toBe('coverage_request');
  });

  it('recommends update_case when active case exists', () => {
    const interp = makeInterpretation({ intent: 'request_coverage' });
    const ctx = makeContext({
      activeCase: { id: 'c1', type: 'disruption', status: 'open', pendingResponseFrom: null, summary: '' },
    });
    const result = heuristicRecommend(interp, ctx);
    expect(result.nextStep).toBe('update_case');
  });
});

describe('heuristicRecommend — respond to request', () => {
  it('recommends update_case', () => {
    const interp = makeInterpretation({ intent: 'respond_to_request' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('update_case');
  });
});

describe('heuristicRecommend — respond to proposal', () => {
  it('recommends update_case', () => {
    const interp = makeInterpretation({ intent: 'respond_to_proposal' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('update_case');
    expect(result.confidence).toBe(0.8);
  });
});

describe('heuristicRecommend — confirm/reject', () => {
  it('recommends update_case on confirm with active case', () => {
    const interp = makeInterpretation({ intent: 'confirm_action' });
    const ctx = makeContext({
      activeCase: { id: 'c1', type: 'disruption', status: 'open', pendingResponseFrom: null, summary: '' },
    });
    const result = heuristicRecommend(interp, ctx);
    expect(result.nextStep).toBe('update_case');
    expect(result.confidence).toBe(0.85);
  });

  it('recommends acknowledge on confirm without active case', () => {
    const interp = makeInterpretation({ intent: 'confirm_action' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('acknowledge');
    expect(result.acknowledgmentText).toBe('Got it.');
  });

  it('recommends update_case on reject with active case', () => {
    const interp = makeInterpretation({ intent: 'reject_action' });
    const ctx = makeContext({
      activeCase: { id: 'c1', type: 'disruption', status: 'open', pendingResponseFrom: null, summary: '' },
    });
    const result = heuristicRecommend(interp, ctx);
    expect(result.nextStep).toBe('update_case');
  });

  it('recommends acknowledge on reject without active case', () => {
    const interp = makeInterpretation({ intent: 'reject_action' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('acknowledge');
    expect(result.acknowledgmentText).toBe('Understood.');
  });
});

describe('heuristicRecommend — counter proposal', () => {
  it('recommends generate_proposals', () => {
    const interp = makeInterpretation({ intent: 'counter_proposal' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('generate_proposals');
  });
});

describe('heuristicRecommend — complaint', () => {
  it('recommends show_metrics for fairness complaint', () => {
    const interp = makeInterpretation({ intent: 'complaint', structuredObjection: 'fairness' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('show_metrics');
  });

  it('recommends update_case for non-fairness complaint with active case', () => {
    const interp = makeInterpretation({ intent: 'complaint', structuredObjection: 'routine_disruption' });
    const ctx = makeContext({
      activeCase: { id: 'c1', type: 'disruption', status: 'open', pendingResponseFrom: null, summary: '' },
    });
    const result = heuristicRecommend(interp, ctx);
    expect(result.nextStep).toBe('update_case');
  });

  it('recommends record_feedback_only for non-fairness complaint without case', () => {
    const interp = makeInterpretation({ intent: 'complaint', structuredObjection: 'inconvenience' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('record_feedback_only');
  });
});

describe('heuristicRecommend — feedback', () => {
  it('recommends record_feedback_only', () => {
    const interp = makeInterpretation({ intent: 'provide_feedback' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('record_feedback_only');
    expect(result.acknowledgmentText).toBe('Thanks for the feedback.');
  });

  it('uses empathetic text for frustrated feedback', () => {
    const interp = makeInterpretation({ intent: 'provide_feedback', emotionalTone: 'frustrated' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.acknowledgmentText).toContain('frustrating');
  });
});

describe('heuristicRecommend — schedule question', () => {
  it('recommends show_metrics', () => {
    const interp = makeInterpretation({ intent: 'ask_schedule_question' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('show_metrics');
  });
});

describe('heuristicRecommend — clarification answer', () => {
  it('recommends update_case', () => {
    const interp = makeInterpretation({ intent: 'clarification_answer' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('update_case');
  });
});

describe('heuristicRecommend — unknown intent', () => {
  it('recommends update_case when active case exists', () => {
    const interp = makeInterpretation({ intent: 'general_unknown' });
    const ctx = makeContext({
      activeCase: { id: 'c1', type: 'disruption', status: 'open', pendingResponseFrom: null, summary: '' },
    });
    const result = heuristicRecommend(interp, ctx);
    expect(result.nextStep).toBe('update_case');
    expect(result.confidence).toBe(0.4);
  });

  it('recommends acknowledge with help text when no active case', () => {
    const interp = makeInterpretation({ intent: 'general_unknown' });
    const result = heuristicRecommend(interp, makeContext());
    expect(result.nextStep).toBe('acknowledge');
    expect(result.confidence).toBe(0.3);
    expect(result.acknowledgmentText).toContain('help');
  });
});

describe('heuristicRecommend — all recommendations have required fields', () => {
  const intents = [
    'report_disruption', 'request_coverage', 'respond_to_request',
    'respond_to_proposal', 'ask_schedule_question', 'provide_feedback',
    'complaint', 'clarification_answer', 'onboarding_answer',
    'confirm_action', 'reject_action', 'counter_proposal', 'general_unknown',
  ] as const;

  for (const intent of intents) {
    it(`returns valid recommendation for ${intent}`, () => {
      const interp = makeInterpretation({
        intent,
        onboardingTopics: intent === 'onboarding_answer' ? ['arrangement'] : undefined,
        disruptionType: intent === 'report_disruption' ? 'child_sick' : undefined,
        confidence: 0.8,
      });
      const result = heuristicRecommend(interp, makeContext());
      expect(result.nextStep).toBeTruthy();
      expect(result.rationale).toBeTruthy();
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  }
});
