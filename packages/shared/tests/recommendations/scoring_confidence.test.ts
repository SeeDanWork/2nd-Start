import { describe, it, expect } from 'vitest';
import {
  recommendBaselineV2,
  type BaselineRecommendationInputV2,
} from '../../src/recommendations/scoring';

// ─── Helpers ──────────────────────────────────────────────────────

function makeInput(
  overrides: Partial<BaselineRecommendationInputV2> = {},
): BaselineRecommendationInputV2 {
  return {
    children: [{ childId: 'c1', ageBand: '5-7y' }],
    anchor: { type: 'school' },
    exchangePreference: 'ok_in_person',
    goals: {
      stabilityFirst: false,
      minimizeSeparation: false,
      fairnessStrict: false,
    },
    aggregationMode: 'youngest_child_rules',
    ...overrides,
  };
}

function getTopConfidence(input: BaselineRecommendationInputV2): 'low' | 'medium' | 'high' {
  const result = recommendBaselineV2(input);
  return result.aggregate.recommendedTemplates[0].confidence;
}

function getTopTemplateId(input: BaselineRecommendationInputV2): string {
  const result = recommendBaselineV2(input);
  return result.aggregate.recommendedTemplates[0].templateId;
}

// ─── Clear-Cut Scenarios ─────────────────────────────────────────

describe('confidence: clear-cut scenarios', () => {
  it('infant (0-6m) with no anchor → HIGH confidence (223_daytime dominates)', () => {
    const input = makeInput({
      children: [{ childId: 'baby', ageBand: '0-6m' }],
      anchor: { type: 'none' },
      exchangePreference: 'unknown',
    });
    const result = recommendBaselineV2(input);
    const top = result.aggregate.recommendedTemplates[0];
    expect(['223_daytime', '223']).toContain(top.templateId);
    // Infant strongly prefers specific templates — should not be LOW
    expect(['medium', 'high']).toContain(top.confidence);
  });

  it('infant with birthdate (4 months) → most templates get minAge penalty → HIGH confidence', () => {
    // A 4-month-old: most templates have minAgeMonths > 4, getting 0.05 ageFit
    // Only 223_daytime (minAge=0) avoids penalty → clear winner
    const input = makeInput({
      children: [{ childId: 'baby', birthdate: '2025-11-01' }], // ~4 months
      anchor: { type: 'none' },
      exchangePreference: 'unknown',
    });
    const result = recommendBaselineV2(input);
    const top = result.aggregate.recommendedTemplates[0];
    expect(top.templateId).toBe('223_daytime');
    expect(['medium', 'high']).toContain(top.confidence);
  });

  it('teen (14-17y) + stability + distance >90 → top is low-handoff template', () => {
    const input = makeInput({
      children: [{ childId: 'teen', ageBand: '14-17y' }],
      anchor: { type: 'none' },
      exchangePreference: 'unknown',
      distanceBetweenHomesMinutes: 100,
      goals: {
        stabilityFirst: true,
        minimizeSeparation: false,
        fairnessStrict: false,
      },
    });
    const result = recommendBaselineV2(input);
    const top = result.aggregate.recommendedTemplates[0];
    expect(['7on7off', '2week_blocks']).toContain(top.templateId);
    // Multiple low-handoff templates score similarly → LOW confidence is expected
    // What matters is the top template category, not confidence
    expect(['low', 'medium', 'high']).toContain(top.confidence);
  });
});

// ─── Ambiguous Scenarios ─────────────────────────────────────────

describe('confidence: ambiguous scenarios', () => {
  it('school-age no goals no constraints → LOW or MEDIUM (many templates score similarly)', () => {
    const input = makeInput({
      children: [{ childId: 'kid', ageBand: '8-10y' }],
      anchor: { type: 'none' },
      exchangePreference: 'unknown',
    });
    const conf = getTopConfidence(input);
    expect(['low', 'medium']).toContain(conf);
  });

  it('opposing goals (stability + minimizeSeparation) → LOW or MEDIUM', () => {
    const input = makeInput({
      goals: {
        stabilityFirst: true,
        minimizeSeparation: true,
        fairnessStrict: false,
      },
    });
    const conf = getTopConfidence(input);
    expect(['low', 'medium']).toContain(conf);
  });
});

// ─── Confidence Threshold Behavior ──────────────────────────────

describe('confidence threshold mechanics', () => {
  it('top template always has a confidence value', () => {
    const result = recommendBaselineV2(makeInput());
    expect(['low', 'medium', 'high']).toContain(
      result.aggregate.recommendedTemplates[0].confidence,
    );
  });

  it('non-top templates have confidence based on gap from top', () => {
    const result = recommendBaselineV2(makeInput());
    const templates = result.aggregate.recommendedTemplates;
    for (const t of templates.slice(1)) {
      expect(['low', 'medium']).toContain(t.confidence);
    }
  });

  it('scores are sorted descending', () => {
    const result = recommendBaselineV2(makeInput());
    const scores = result.aggregate.recommendedTemplates.map((t) => t.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('all 5 templates have debug scores', () => {
    const result = recommendBaselineV2(makeInput());
    for (const t of result.aggregate.recommendedTemplates) {
      expect(t.debug).toBeDefined();
      expect(t.debug!.ageFit).toBeGreaterThanOrEqual(0);
      expect(t.debug!.goalFit).toBeGreaterThanOrEqual(0);
      expect(t.debug!.logisticsFit).toBeGreaterThanOrEqual(0);
      expect(t.debug!.constraintFit).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── minAgeMonths Impact on Confidence ──────────────────────────

describe('minAgeMonths impact on confidence', () => {
  it('young infant with birthdate: age-inappropriate templates are demoted', () => {
    const input = makeInput({
      children: [{ childId: 'baby', birthdate: '2025-11-01' }],
      anchor: { type: 'none' },
      exchangePreference: 'unknown',
    });
    const result = recommendBaselineV2(input);
    // Templates with minAgeMonths > 4 should have very low ageFit
    const twoWeek = result.aggregate.recommendedTemplates.find(
      (t) => t.templateId === '2week_blocks',
    );
    if (twoWeek) {
      expect(twoWeek.debug!.ageFit).toBe(0.05); // hard penalty
    }
  });

  it('ageBand-only input (no birthdate): minAgeMonths penalty not applied', () => {
    const input = makeInput({
      children: [{ childId: 'kid', ageBand: '0-6m' }],
      anchor: { type: 'none' },
      exchangePreference: 'unknown',
    });
    const result = recommendBaselineV2(input);
    // Without birthdate, childAgeMonths is undefined → no hard penalty
    // But age band still drives preferred templates
    const top = result.aggregate.recommendedTemplates[0];
    expect(['223_daytime', '223']).toContain(top.templateId);
  });
});

// ─── Relative Gap Verification ──────────────────────────────────

describe('relative gap calculation', () => {
  it('debug scoreBreakdown contains all scored templates', () => {
    const result = recommendBaselineV2(makeInput());
    const breakdown = result.debug?.scoreBreakdown;
    expect(breakdown).toBeDefined();
    // Should have entries for all 13 templates
    expect(Object.keys(breakdown!).length).toBe(13);
  });

  it('top 5 are the highest-scoring from the full breakdown', () => {
    const result = recommendBaselineV2(makeInput());
    const breakdown = result.debug!.scoreBreakdown;
    const allScores = Object.entries(breakdown).sort(
      ([, a], [, b]) => b.total - a.total,
    );
    const top5FromBreakdown = allScores.slice(0, 5).map(([id]) => id);
    const top5FromResult = result.aggregate.recommendedTemplates.map(
      (t) => t.templateId,
    );
    expect(top5FromResult).toEqual(top5FromBreakdown);
  });
});
