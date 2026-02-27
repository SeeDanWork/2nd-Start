import { describe, it, expect } from 'vitest';
import {
  generateRationale,
  generateSuggestedWhen,
  generateTradeoffs,
  getDisclaimers,
  type RecommendationInput,
  type AggregateResult,
  type TemplateScore,
} from '../../src/recommendations/explain';
import { TEMPLATES_V2 } from '../../src/recommendations/templates';

// ─── Helpers ──────────────────────────────────────────────────────

function getTemplate(id: string) {
  return TEMPLATES_V2.find((t) => t.id === id)!;
}

function makeRecommendationInput(
  overrides: Partial<RecommendationInput> = {},
): RecommendationInput {
  return {
    children: [{ childId: 'c1', ageBand: '5-7y' }],
    anchor: { type: 'school' },
    exchangePreference: 'ok_in_person',
    goals: {
      stabilityFirst: false,
      minimizeSeparation: false,
      fairnessStrict: false,
    },
    ...overrides,
  };
}

function makeAggregate(overrides: Partial<AggregateResult> = {}): AggregateResult {
  return {
    derivedFrom: 'youngest_child_rules',
    maxConsecutive: 5,
    maxAway: 5,
    youngestBand: '5-7y',
    ...overrides,
  };
}

function makeTopTemplates(ids: string[] = ['2255']): TemplateScore[] {
  return ids.map((id) => ({
    template: getTemplate(id),
    score: 0.8,
    confidence: 'high' as const,
  }));
}

// ─── 1. generateRationale ────────────────────────────────────────

describe('generateRationale', () => {
  it('returns 3-6 bullets for a basic input', () => {
    const input = makeRecommendationInput();
    const agg = makeAggregate();
    const bullets = generateRationale(input, agg, makeTopTemplates());
    expect(bullets.length).toBeGreaterThanOrEqual(2);
    expect(bullets.length).toBeLessThanOrEqual(6);
  });

  it('mentions age band', () => {
    const bullets = generateRationale(
      makeRecommendationInput(),
      makeAggregate({ youngestBand: '0-6m' }),
      makeTopTemplates(['223_daytime']),
    );
    const mentionsAge = bullets.some((b) => b.includes('0–6 months'));
    expect(mentionsAge).toBe(true);
  });

  it('mentions distance when >45 min', () => {
    const input = makeRecommendationInput({ distanceBetweenHomesMinutes: 60 });
    const bullets = generateRationale(input, makeAggregate(), makeTopTemplates());
    const mentionsDist = bullets.some((b) => b.includes('60 minutes'));
    expect(mentionsDist).toBe(true);
  });

  it('mentions stability goal', () => {
    const input = makeRecommendationInput({
      goals: { stabilityFirst: true, minimizeSeparation: false, fairnessStrict: false },
    });
    const bullets = generateRationale(input, makeAggregate(), makeTopTemplates());
    const mentionsStability = bullets.some((b) =>
      b.toLowerCase().includes('stability'),
    );
    expect(mentionsStability).toBe(true);
  });

  it('mentions multiple children', () => {
    const input = makeRecommendationInput({
      children: [
        { childId: 'c1', ageBand: '2-3y' },
        { childId: 'c2', ageBand: '8-10y' },
      ],
    });
    const bullets = generateRationale(input, makeAggregate(), makeTopTemplates());
    const mentionsMulti = bullets.some((b) =>
      b.toLowerCase().includes('youngest') || b.toLowerCase().includes('children'),
    );
    expect(mentionsMulti).toBe(true);
  });
});

// ─── 2. generateSuggestedWhen ────────────────────────────────────

describe('generateSuggestedWhen', () => {
  it('includes base suggestions', () => {
    const input = makeRecommendationInput();
    const reasons = generateSuggestedWhen(getTemplate('223'), input);
    expect(reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('adds distance reason for low-handoff templates', () => {
    const input = makeRecommendationInput({ distanceBetweenHomesMinutes: 60 });
    const reasons = generateSuggestedWhen(getTemplate('7on7off'), input);
    const hasDist = reasons.some((r) => r.toLowerCase().includes('distance'));
    expect(hasDist).toBe(true);
  });

  it('adds fairness reason for symmetric templates', () => {
    const input = makeRecommendationInput({
      goals: { stabilityFirst: false, minimizeSeparation: false, fairnessStrict: true },
    });
    const reasons = generateSuggestedWhen(getTemplate('7on7off'), input);
    const hasFairness = reasons.some((r) => r.toLowerCase().includes('equal'));
    expect(hasFairness).toBe(true);
  });
});

// ─── 3. generateTradeoffs ────────────────────────────────────────

describe('generateTradeoffs', () => {
  it('includes base tradeoffs', () => {
    const input = makeRecommendationInput();
    const tradeoffs = generateTradeoffs(getTemplate('7on7off'), input);
    expect(tradeoffs.length).toBeGreaterThanOrEqual(2);
  });

  it('adds distance tradeoff for high-handoff templates', () => {
    const input = makeRecommendationInput({ distanceBetweenHomesMinutes: 60 });
    const tradeoffs = generateTradeoffs(getTemplate('primary_plus_midweek'), input);
    const hasDist = tradeoffs.some((t) => t.toLowerCase().includes('distance'));
    expect(hasDist).toBe(true);
  });
});

// ─── 4. Neutral language check ───────────────────────────────────

describe('neutral language', () => {
  it('no "should", "must", or "best" in rationale bullets', () => {
    const input = makeRecommendationInput({
      distanceBetweenHomesMinutes: 60,
      goals: { stabilityFirst: true, minimizeSeparation: true, fairnessStrict: true },
      children: [
        { childId: 'c1', ageBand: '2-3y' },
        { childId: 'c2', ageBand: '8-10y' },
      ],
    });
    const bullets = generateRationale(
      input,
      makeAggregate(),
      makeTopTemplates(),
    );
    for (const bullet of bullets) {
      const lower = bullet.toLowerCase();
      expect(lower).not.toMatch(/\bshould\b/);
      expect(lower).not.toMatch(/\bmust\b/);
      expect(lower).not.toMatch(/\bbest\b/);
    }
  });

  it('no "should", "must", or "best" in suggestedWhen', () => {
    const input = makeRecommendationInput({
      distanceBetweenHomesMinutes: 60,
      goals: { stabilityFirst: false, minimizeSeparation: false, fairnessStrict: true },
    });
    for (const template of TEMPLATES_V2) {
      const reasons = generateSuggestedWhen(template, input);
      for (const reason of reasons) {
        const lower = reason.toLowerCase();
        expect(lower).not.toMatch(/\bshould\b/);
        expect(lower).not.toMatch(/\bmust\b/);
        expect(lower).not.toMatch(/\bbest\b/);
      }
    }
  });

  it('no "should", "must", or "best" in tradeoffs', () => {
    const input = makeRecommendationInput({ distanceBetweenHomesMinutes: 60 });
    for (const template of TEMPLATES_V2) {
      const tradeoffs = generateTradeoffs(template, input);
      for (const tradeoff of tradeoffs) {
        const lower = tradeoff.toLowerCase();
        expect(lower).not.toMatch(/\bshould\b/);
        expect(lower).not.toMatch(/\bmust\b/);
        expect(lower).not.toMatch(/\bbest\b/);
      }
    }
  });
});

// ─── 5. getDisclaimers ───────────────────────────────────────────

describe('getDisclaimers', () => {
  it('returns non-empty array', () => {
    const disclaimers = getDisclaimers();
    expect(disclaimers.length).toBeGreaterThan(0);
  });

  it('includes advice disclaimer', () => {
    const disclaimers = getDisclaimers();
    const hasAdvice = disclaimers.some(
      (d) => d.toLowerCase().includes('not') && d.toLowerCase().includes('advice'),
    );
    expect(hasAdvice).toBe(true);
  });

  it('includes "starting point" or "change anytime"', () => {
    const disclaimers = getDisclaimers();
    const hasStartingPoint = disclaimers.some(
      (d) =>
        d.toLowerCase().includes('starting point') ||
        d.toLowerCase().includes('change'),
    );
    expect(hasStartingPoint).toBe(true);
  });
});
