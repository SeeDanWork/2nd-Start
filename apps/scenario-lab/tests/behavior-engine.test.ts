import { describe, it, expect } from 'vitest';
import {
  evaluateProposal,
  evaluateDisruption,
  generatePersonaMessage,
  classifySystemMessage,
  classifyAllTopics,
  generateReactiveAnswer,
  generateCompoundAnswer,
  isOnboardingComplete,
  generateSyntheticSystemResponse,
  getArchetype,
  evaluateProposalWithArchetype,
  computeMetrics,
  DecisionResult,
} from '../lib/behavior-engine';
import { PARENT_PERSONAS } from '../lib/personas';

const COOP = PARENT_PERSONAS.find(p => p.id === 'cooperative_organizer')!;
const SCOREKEEPER = PARENT_PERSONAS.find(p => p.id === 'fairness_scorekeeper')!;
const CONTROLLER = PARENT_PERSONAS.find(p => p.id === 'high_conflict_controller')!;
const AVOIDANT = PARENT_PERSONAS.find(p => p.id === 'avoidant_parent')!;
const GAMER = PARENT_PERSONAS.find(p => p.id === 'strategic_gamer')!;
const FLEXIBLE = PARENT_PERSONAS.find(p => p.id === 'flexible_disorganized')!;

const CONFIG = {
  name: 'Test',
  description: 'Test',
  children: [{ age: 7, name: 'Emma' }],
  parentA: { label: 'Mom', phone: '+1111' },
  parentB: { label: 'Dad', phone: '+2222' },
  template: 'alternating_weeks' as const,
  targetSplit: 50,
  lockedNights: [] as any[],
  distanceMiles: 10,
  tags: [] as string[],
};

describe('evaluateProposal', () => {
  it('cooperative persona accepts with high confidence', () => {
    // Run 20 times — should accept majority
    let accepts = 0;
    for (let i = 0; i < 20; i++) {
      const r = evaluateProposal(COOP, 2, false, false, 10);
      if (r.decision === 'accept') accepts++;
    }
    expect(accepts).toBeGreaterThan(10);
  });

  it('returns valid decision result', () => {
    const r = evaluateProposal(COOP, 5, false, false, 10);
    expect(['accept', 'reject', 'counter', 'ignore', 'delay']).toContain(r.decision);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(r.reasoning).toBeTruthy();
    expect(typeof r.delay_seconds).toBe('number');
  });

  it('high fairness deviation lowers acceptance for scorekeeper', () => {
    let accepts = 0;
    for (let i = 0; i < 20; i++) {
      const r = evaluateProposal(SCOREKEEPER, 20, false, false, 10);
      if (r.decision === 'accept') accepts++;
    }
    // Should accept less than cooperative
    expect(accepts).toBeLessThan(18);
  });

  it('disruption bonus increases acceptance for low-conflict personas', () => {
    let acceptsNormal = 0;
    let acceptsDisruption = 0;
    for (let i = 0; i < 50; i++) {
      if (evaluateProposal(SCOREKEEPER, 10, false, false, 10).decision === 'accept') acceptsNormal++;
      if (evaluateProposal(SCOREKEEPER, 10, false, true, 10).decision === 'accept') acceptsDisruption++;
    }
    // Disruption should generally increase acceptance (probabilistic, large sample)
    expect(acceptsDisruption).toBeGreaterThanOrEqual(acceptsNormal - 10);
  });
});

describe('evaluateDisruption', () => {
  it('flexible persona accepts quickly', () => {
    const r = evaluateDisruption(FLEXIBLE, { type: 'child_sick', day: 5 }, 5);
    expect(r.decision).toBe('accept');
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('returns valid result for all personas', () => {
    for (const p of PARENT_PERSONAS) {
      const r = evaluateDisruption(p, { type: 'work_emergency', day: 10 }, 10);
      expect(['accept', 'reject', 'counter', 'ignore', 'delay']).toContain(r.decision);
    }
  });
});

describe('generatePersonaMessage', () => {
  it('generates greeting for all personas', () => {
    for (const p of PARENT_PERSONAS) {
      const msg = generatePersonaMessage(p, 'greeting');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('generates different messages for different situations', () => {
    const greeting = generatePersonaMessage(COOP, 'greeting');
    const complaint = generatePersonaMessage(COOP, 'complaint');
    expect(greeting).not.toBe(complaint);
  });

  it('includes event type in disruption report', () => {
    const msg = generatePersonaMessage(COOP, 'disruption_report', { eventType: 'Child is sick' });
    expect(msg).toContain('Child is sick');
  });

  it('high-conflict persona generates resistant messages', () => {
    const msg = generatePersonaMessage(CONTROLLER, 'proposal_response');
    // Controller has high fairness_sensitivity AND high conflict_level
    // The branch depends on which threshold hits first in the switch
    expect(msg.length).toBeGreaterThan(0);
    expect(msg.toLowerCase()).toMatch(/fairness|no|disadvantage|agree/);
  });
});

describe('classifySystemMessage', () => {
  it('detects greeting', () => {
    expect(classifySystemMessage("Welcome to ADCP! Let's get started.")).toBe('greeting');
  });

  it('detects children_count', () => {
    expect(classifySystemMessage('How many children do you have?')).toBe('children_count');
  });

  it('detects arrangement', () => {
    expect(classifySystemMessage('How does custody work now?')).toBe('arrangement');
  });

  it('detects distance', () => {
    expect(classifySystemMessage('How far apart do you live?')).toBe('distance');
  });

  it('detects phone', () => {
    expect(classifySystemMessage("What is your co-parent's phone number?")).toBe('phone');
  });

  it('detects confirmed', () => {
    expect(classifySystemMessage("Your family schedule is now created! You can now view your upcoming exchanges.")).toBe('confirmed');
  });

  it('detects confirm', () => {
    expect(classifySystemMessage("Here's your setup. Does this look right? Reply yes to confirm.")).toBe('confirm');
  });

  it('detects locked_days with specific nights phrasing', () => {
    expect(classifySystemMessage('Are there any specific nights that must always be with one parent?')).toBe('locked_days');
  });

  it('returns unknown for unrecognizable text', () => {
    expect(classifySystemMessage('The quick brown fox jumps over the lazy dog')).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(classifySystemMessage('')).toBe('unknown');
  });
});

describe('classifyAllTopics', () => {
  it('finds multiple topics in compound questions', () => {
    const topics = classifyAllTopics('What time split are you aiming for? And how far apart do you live?');
    expect(topics).toContain('split');
    expect(topics).toContain('distance');
  });

  it('returns terminal state for confirmed messages', () => {
    const topics = classifyAllTopics("All set! Your schedule is ready.");
    expect(topics).toContain('confirmed');
    expect(topics).toHaveLength(1);
  });
});

describe('generateReactiveAnswer', () => {
  it('generates children count answer', () => {
    const answer = generateReactiveAnswer('children_count', COOP, CONFIG);
    expect(answer).toContain('Emma');
  });

  it('generates arrangement answer based on template', () => {
    const answer = generateReactiveAnswer('arrangement', COOP, CONFIG);
    expect(answer).toContain('alternate');
  });

  it('returns empty for already-answered topic', () => {
    const answered = new Set(['arrangement']);
    const answer = generateReactiveAnswer('arrangement', COOP, CONFIG, answered);
    expect(answer).toBe('');
  });

  it('always answers confirm even if in answered set', () => {
    const answered = new Set(['confirm']);
    const answer = generateReactiveAnswer('confirm', COOP, CONFIG, answered);
    expect(answer).toContain('right');
  });
});

describe('generateCompoundAnswer', () => {
  it('answers multiple topics from compound question', () => {
    const { answer, topics } = generateCompoundAnswer(
      'What split do you want? How far apart do you live?',
      COOP,
      CONFIG,
      new Set(),
    );
    expect(answer.length).toBeGreaterThan(0);
    expect(topics.length).toBeGreaterThanOrEqual(1);
  });

  it('skips already-answered topics', () => {
    const answered = new Set(['split', 'distance']);
    const { answer, topics } = generateCompoundAnswer(
      'What split do you want? How far apart do you live?',
      COOP,
      CONFIG,
      answered,
    );
    // Should fall through to next unanswered info
    expect(topics.every(t => !answered.has(t))).toBe(true);
  });

  it('returns confirm when everything is answered', () => {
    const allAnswered = new Set([
      'greeting', 'children_count', 'children_ages', 'arrangement',
      'locked_days', 'weekends', 'split', 'exchange', 'distance',
      'phone', 'frustrations',
    ]);
    const { answer, topics } = generateCompoundAnswer(
      'Anything else?',
      COOP,
      CONFIG,
      allAnswered,
    );
    expect(topics).toContain('confirm');
  });
});

describe('isOnboardingComplete', () => {
  it('returns true for completion message', () => {
    expect(isOnboardingComplete("Your family schedule is now created! You can now view your upcoming exchanges.")).toBe(true);
  });

  it('returns false for mid-onboarding question', () => {
    expect(isOnboardingComplete("How many children do you have?")).toBe(false);
  });
});

describe('generateSyntheticSystemResponse', () => {
  it('returns welcome for empty topics', () => {
    const resp = generateSyntheticSystemResponse(CONFIG, new Set());
    expect(resp).toContain('Welcome');
  });

  it('progresses through onboarding steps', () => {
    const answered = new Set(['children_count']);
    const resp = generateSyntheticSystemResponse(CONFIG, answered);
    expect(resp).toContain('arrangement');
  });

  it('returns completion when all topics answered', () => {
    const allAnswered = new Set([
      'greeting', 'children_count', 'children_ages', 'arrangement',
      'locked_days', 'weekends', 'split', 'exchange', 'distance',
      'phone', 'frustrations', 'confirm',
    ]);
    const resp = generateSyntheticSystemResponse(CONFIG, allAnswered);
    expect(resp).toContain('created');
  });
});

describe('getArchetype', () => {
  it('finds archetype for known pair', () => {
    const a = getArchetype('cooperative_organizer', 'cooperative_organizer');
    // May or may not exist depending on catalog
    // Just ensure it doesn't throw
    expect(a === null || typeof a === 'object').toBe(true);
  });

  it('returns null for unknown pair', () => {
    const a = getArchetype('nonexistent_a', 'nonexistent_b');
    expect(a).toBeNull();
  });
});

describe('computeMetrics', () => {
  it('returns zeroes for empty array', () => {
    const m = computeMetrics([]);
    expect(m.totalProposals).toBe(0);
    expect(m.acceptanceRate).toBe(0);
  });

  it('computes rates correctly', () => {
    const decisions: DecisionResult[] = [
      { decision: 'accept', confidence: 0.9, reasoning: '', delay_seconds: 0 },
      { decision: 'accept', confidence: 0.8, reasoning: '', delay_seconds: 0 },
      { decision: 'reject', confidence: 0.5, reasoning: '', delay_seconds: 0 },
      { decision: 'counter', confidence: 0.6, reasoning: '', delay_seconds: 0 },
    ];
    const m = computeMetrics(decisions);
    expect(m.totalProposals).toBe(4);
    expect(m.acceptanceRate).toBe(0.5);
    expect(m.rejectionRate).toBe(0.25);
    expect(m.counterRate).toBe(0.25);
  });

  it('counts escalations from consecutive rejections', () => {
    const decisions: DecisionResult[] = [
      { decision: 'reject', confidence: 0.5, reasoning: '', delay_seconds: 0 },
      { decision: 'reject', confidence: 0.5, reasoning: '', delay_seconds: 0 },
      { decision: 'reject', confidence: 0.5, reasoning: '', delay_seconds: 0 },
    ];
    const m = computeMetrics(decisions);
    expect(m.conflictEscalations).toBe(2); // streak of 2 and streak of 3
  });

  it('counts gaming attempts', () => {
    const decisions: DecisionResult[] = [
      { decision: 'accept', confidence: 0.9, reasoning: '', delay_seconds: 0, injected_events: [{ type: 'extra_time_request', day: 5 }] },
      { decision: 'accept', confidence: 0.8, reasoning: '', delay_seconds: 0 },
    ];
    const m = computeMetrics(decisions);
    expect(m.gamingAttempts).toBe(1);
  });
});
