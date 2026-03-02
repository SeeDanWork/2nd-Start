import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  preferenceFit,
  ParentPreferenceInputSchema,
  MODE_WEIGHT_PROFILES,
  type ParentPreferenceInput,
  type ScheduleMode,
} from '../../src/recommendations/preferences';
import {
  recommendThreeModes,
  recommendBaselineV2,
  type BaselineRecommendationInputV2,
} from '../../src/recommendations/scoring';
import { TEMPLATES_V2, type TemplateDefV2 } from '../../src/recommendations/templates';

// ─── Helpers ──────────────────────────────────────────────────────

function getTemplate(id: string): TemplateDefV2 {
  return TEMPLATES_V2.find((t) => t.id === id)!;
}

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

function makePrefs(overrides: Partial<ParentPreferenceInput> = {}): ParentPreferenceInput {
  return {
    targetSharePct: 50,
    maxHandoffsPerWeek: 3,
    maxConsecutiveAway: 5,
    weekendPreference: 'equal',
    priorityWeights: { timeSplit: 0.8, handoffs: 0.5, weekends: 0.5 },
    ...overrides,
  };
}

// ─── 1. preferenceFit component ──────────────────────────────────

describe('preferenceFit', () => {
  it('returns high score when template perfectly matches preferences', () => {
    // 223 is 50/50, 3 handoffs/week, maxBlock=3, alternating weekends
    const template = getTemplate('223');
    const prefs = makePrefs({
      targetSharePct: 50,
      maxHandoffsPerWeek: 3,
      maxConsecutiveAway: 5,
      weekendPreference: 'alternating',
      priorityWeights: { timeSplit: 1, handoffs: 1, weekends: 1 },
    });
    const score = preferenceFit(template, prefs);
    expect(score).toBeGreaterThan(0.7);
  });

  it('returns low score for mismatched templates', () => {
    // 2week_blocks is 50/50 but maxBlock=14, 0.5 handoffs/week
    const template = getTemplate('2week_blocks');
    const prefs = makePrefs({
      targetSharePct: 50,
      maxHandoffsPerWeek: 7,
      maxConsecutiveAway: 2,
      weekendPreference: 'alternating',
      priorityWeights: { timeSplit: 0.5, handoffs: 1, weekends: 1 },
    });
    const score = preferenceFit(template, prefs);
    expect(score).toBeLessThan(0.5);
  });

  it('gives direct pick bonus when preferredTemplateId matches', () => {
    const template = getTemplate('7on7off');
    const prefsWithPick = makePrefs({ preferredTemplateId: '7on7off' });
    const prefsWithoutPick = makePrefs({ preferredTemplateId: undefined });
    const scoreWith = preferenceFit(template, prefsWithPick);
    const scoreWithout = preferenceFit(template, prefsWithoutPick);
    expect(scoreWith).toBeGreaterThan(scoreWithout);
  });

  it('returns value between 0 and 1', () => {
    for (const template of TEMPLATES_V2) {
      const score = preferenceFit(template, makePrefs());
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('handles zero priority weights gracefully', () => {
    const template = getTemplate('223');
    const prefs = makePrefs({
      priorityWeights: { timeSplit: 0, handoffs: 0, weekends: 0 },
    });
    const score = preferenceFit(template, prefs);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('penalizes when maxBlock exceeds maxConsecutiveAway', () => {
    const shortBlock = getTemplate('223'); // maxBlock=3
    const longBlock = getTemplate('7on7off'); // maxBlock=7
    const prefs = makePrefs({ maxConsecutiveAway: 3 });
    const shortScore = preferenceFit(shortBlock, prefs);
    const longScore = preferenceFit(longBlock, prefs);
    expect(shortScore).toBeGreaterThan(longScore);
  });
});

// ─── 2. Zod schema validation ────────────────────────────────────

describe('ParentPreferenceInputSchema', () => {
  it('accepts valid input', () => {
    const result = ParentPreferenceInputSchema.parse(makePrefs());
    expect(result.targetSharePct).toBe(50);
  });

  it('rejects targetSharePct out of range', () => {
    expect(() =>
      ParentPreferenceInputSchema.parse(makePrefs({ targetSharePct: 150 })),
    ).toThrow(ZodError);
    expect(() =>
      ParentPreferenceInputSchema.parse(makePrefs({ targetSharePct: -10 })),
    ).toThrow(ZodError);
  });

  it('rejects maxHandoffsPerWeek out of range', () => {
    expect(() =>
      ParentPreferenceInputSchema.parse(makePrefs({ maxHandoffsPerWeek: 0 })),
    ).toThrow(ZodError);
    expect(() =>
      ParentPreferenceInputSchema.parse(makePrefs({ maxHandoffsPerWeek: 10 })),
    ).toThrow(ZodError);
  });

  it('rejects invalid weekendPreference', () => {
    expect(() =>
      ParentPreferenceInputSchema.parse(makePrefs({ weekendPreference: 'bogus' as any })),
    ).toThrow(ZodError);
  });

  it('rejects priorityWeights out of range', () => {
    expect(() =>
      ParentPreferenceInputSchema.parse(
        makePrefs({ priorityWeights: { timeSplit: 2, handoffs: 0.5, weekends: 0.5 } }),
      ),
    ).toThrow(ZodError);
  });
});

// ─── 3. MODE_WEIGHT_PROFILES ─────────────────────────────────────

describe('MODE_WEIGHT_PROFILES', () => {
  it('evidence mode has preferenceFit=0', () => {
    expect(MODE_WEIGHT_PROFILES.evidence.preferenceFit).toBe(0);
  });

  it('parent_vision mode has preferenceFit=0.65', () => {
    expect(MODE_WEIGHT_PROFILES.parent_vision.preferenceFit).toBe(0.65);
  });

  it('balanced mode has preferenceFit=0.30', () => {
    expect(MODE_WEIGHT_PROFILES.balanced.preferenceFit).toBe(0.30);
  });

  it('all mode weights sum to 1.0', () => {
    const modes: ScheduleMode[] = ['evidence', 'parent_vision', 'balanced'];
    for (const mode of modes) {
      const w = MODE_WEIGHT_PROFILES[mode];
      const sum = w.ageFit + w.goalFit + w.logisticsFit + w.constraintFit + w.preferenceFit;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });
});

// ─── 4. recommendThreeModes ──────────────────────────────────────

describe('recommendThreeModes', () => {
  const input = makeInput();
  const prefs = makePrefs();

  it('returns all three modes', () => {
    const result = recommendThreeModes(input, prefs);
    expect(result.evidence).toBeDefined();
    expect(result.parentVision).toBeDefined();
    expect(result.balanced).toBeDefined();
    expect(result.baselineOutput).toBeDefined();
  });

  it('each mode has top 5 templates', () => {
    const result = recommendThreeModes(input, prefs);
    expect(result.evidence.recommendedTemplates.length).toBe(5);
    expect(result.parentVision.recommendedTemplates.length).toBe(5);
    expect(result.balanced.recommendedTemplates.length).toBe(5);
  });

  it('evidence mode produces same top template as recommendBaselineV2', () => {
    const threeMode = recommendThreeModes(input, prefs);
    const baseline = recommendBaselineV2(input);
    // Evidence mode should rank the same #1 template
    expect(threeMode.evidence.recommendedTemplates[0].templateId).toBe(
      baseline.aggregate.recommendedTemplates[0].templateId,
    );
  });

  it('parent_vision mode ranks preferred template highest when direct pick set', () => {
    const prefsWithPick = makePrefs({
      preferredTemplateId: '7on7off',
      targetSharePct: 50,
      maxHandoffsPerWeek: 1,
      maxConsecutiveAway: 7,
      priorityWeights: { timeSplit: 1, handoffs: 1, weekends: 1 },
    });
    const result = recommendThreeModes(input, prefsWithPick);
    // In parent_vision mode (65% preference weight), the preferred template
    // should be ranked very high (top 3 at least)
    const pvTemplates = result.parentVision.recommendedTemplates.map((t) => t.templateId);
    expect(pvTemplates.slice(0, 3)).toContain('7on7off');
  });

  it('balanced mode produces middle-ground ranking', () => {
    const prefsForExtreme = makePrefs({
      preferredTemplateId: '2week_blocks',
      targetSharePct: 50,
      maxHandoffsPerWeek: 1,
      maxConsecutiveAway: 14,
      priorityWeights: { timeSplit: 1, handoffs: 1, weekends: 1 },
    });
    const result = recommendThreeModes(
      makeInput({ children: [{ childId: 'c1', ageBand: '14-17y' }] }),
      prefsForExtreme,
    );
    // Balanced should put 2week_blocks higher than evidence but potentially
    // not as high as parent_vision
    const evRank = result.evidence.recommendedTemplates.findIndex(
      (t) => t.templateId === '2week_blocks',
    );
    const balRank = result.balanced.recommendedTemplates.findIndex(
      (t) => t.templateId === '2week_blocks',
    );
    // Balanced should favor the preference more than pure evidence
    // (lower index = higher rank)
    expect(balRank).toBeLessThanOrEqual(evRank);
  });

  it('mode field is set on each template score', () => {
    const result = recommendThreeModes(input, prefs);
    for (const ts of result.evidence.recommendedTemplates) {
      expect(ts.mode).toBe('evidence');
    }
    for (const ts of result.parentVision.recommendedTemplates) {
      expect(ts.mode).toBe('parent_vision');
    }
    for (const ts of result.balanced.recommendedTemplates) {
      expect(ts.mode).toBe('balanced');
    }
  });

  it('debug includes preferenceFit scores', () => {
    const result = recommendThreeModes(input, prefs);
    for (const ts of result.parentVision.recommendedTemplates) {
      expect(ts.debug?.preferenceFit).toBeDefined();
      expect(ts.debug!.preferenceFit).toBeGreaterThanOrEqual(0);
    }
  });

  it('score breakdown includes preferenceFit for all templates', () => {
    const result = recommendThreeModes(input, prefs);
    for (const id of Object.keys(result.parentVision.scoreBreakdown)) {
      expect(result.parentVision.scoreBreakdown[id].preferenceFit).toBeDefined();
    }
  });
});

// ─── 5. Safety: minAgeMonths hard penalty in all modes ───────────

describe('minAgeMonths safety invariant', () => {
  it('blocks infant-inappropriate templates in evidence mode', () => {
    const infantInput = makeInput({
      children: [{ childId: 'c1', ageBand: '0-6m' }],
    });
    const prefs = makePrefs({
      preferredTemplateId: '7on7off', // minAgeMonths=72
      priorityWeights: { timeSplit: 1, handoffs: 1, weekends: 1 },
    });
    const result = recommendThreeModes(infantInput, prefs);

    // 7on7off should NOT be #1 in any mode for infants
    expect(result.evidence.recommendedTemplates[0].templateId).not.toBe('7on7off');
    expect(result.parentVision.recommendedTemplates[0].templateId).not.toBe('7on7off');
    expect(result.balanced.recommendedTemplates[0].templateId).not.toBe('7on7off');
  });

  it('blocks 2week_blocks for young children in all modes', () => {
    const youngChildInput = makeInput({
      children: [{ childId: 'c1', ageBand: '3-5y' }],
    });
    const prefs = makePrefs({
      preferredTemplateId: '2week_blocks', // minAgeMonths=156
      priorityWeights: { timeSplit: 1, handoffs: 1, weekends: 1 },
    });
    const result = recommendThreeModes(youngChildInput, prefs);

    // 2week_blocks should score very low in all modes for young children
    for (const mode of ['evidence', 'parentVision', 'balanced'] as const) {
      const bd = result[mode].scoreBreakdown['2week_blocks'];
      // ageFit should be 0.05 (hard penalty)
      expect(bd.ageFit).toBe(0.05);
    }
  });
});

// ─── 6. Determinism ──────────────────────────────────────────────

describe('determinism', () => {
  it('same input produces identical three-mode output', () => {
    const input = makeInput();
    const prefs = makePrefs();
    const r1 = recommendThreeModes(input, prefs);
    const r2 = recommendThreeModes(input, prefs);
    expect(r1.evidence.recommendedTemplates.map((t) => t.templateId)).toEqual(
      r2.evidence.recommendedTemplates.map((t) => t.templateId),
    );
    expect(r1.parentVision.recommendedTemplates.map((t) => t.templateId)).toEqual(
      r2.parentVision.recommendedTemplates.map((t) => t.templateId),
    );
    expect(r1.balanced.recommendedTemplates.map((t) => t.templateId)).toEqual(
      r2.balanced.recommendedTemplates.map((t) => t.templateId),
    );
  });
});
