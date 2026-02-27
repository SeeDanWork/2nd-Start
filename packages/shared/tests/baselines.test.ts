import { describe, it, expect } from 'vitest';
import {
  recommendBaselines,
  type BaselineInput,
  type AgeBand,
  type BaselineRecommendation,
} from '../src/recommendations/baselines';

// ─── Helpers ───────────────────────────────────────────────────────

function makeInput(overrides: Partial<BaselineInput> = {}): BaselineInput {
  return {
    childrenAgeBands: ['5-10'],
    schoolOrDaycareAnchor: 'school',
    exchangePreference: 'ok_in_person',
    goals: {
      stabilityFirst: false,
      minimizeSeparation: false,
      fairnessStrict: false,
    },
    ...overrides,
  };
}

// ─── 1. Max consecutive by age band ────────────────────────────────

describe('maxConsecutiveNightsDefault by age band', () => {
  const cases: [AgeBand, number][] = [
    ['0-2', 2],
    ['3-4', 3],
    ['5-10', 5],
    ['11-17', 7],
  ];

  it.each(cases)(
    'age band %s → maxConsecutive = %d',
    (ageBand, expected) => {
      const result = recommendBaselines(
        makeInput({ childrenAgeBands: [ageBand] }),
      );
      expect(result.maxConsecutiveNightsDefault).toBe(expected);
      expect(result.maxDaysAwayDefault).toBe(expected);
    },
  );
});

// ─── 2. Top-ranked templates by age ────────────────────────────────

describe('top-ranked templates by age', () => {
  it('0-2 → 2-2-3 ranked first', () => {
    const result = recommendBaselines(
      makeInput({ childrenAgeBands: ['0-2'] }),
    );
    expect(result.recommendedTemplates[0].templateId).toBe('2-2-3');
  });

  it('11-17 → week-on-week-off ranked first or second', () => {
    const result = recommendBaselines(
      makeInput({ childrenAgeBands: ['11-17'] }),
    );
    const topTwoIds = result.recommendedTemplates
      .slice(0, 2)
      .map((t) => t.templateId);
    expect(topTwoIds).toContain('week-on-week-off');
  });
});

// ─── 3. Goal modifiers affect maxConsecutive ───────────────────────

describe('goal modifiers on maxConsecutive', () => {
  it('stabilityFirst increases maxConsecutive', () => {
    const baseline = recommendBaselines(
      makeInput({ childrenAgeBands: ['5-10'] }),
    );
    const withStability = recommendBaselines(
      makeInput({
        childrenAgeBands: ['5-10'],
        goals: {
          stabilityFirst: true,
          minimizeSeparation: false,
          fairnessStrict: false,
        },
      }),
    );
    expect(withStability.maxConsecutiveNightsDefault).toBeGreaterThan(
      baseline.maxConsecutiveNightsDefault,
    );
  });

  it('minimizeSeparation decreases maxConsecutive', () => {
    const baseline = recommendBaselines(
      makeInput({ childrenAgeBands: ['5-10'] }),
    );
    const withMinSep = recommendBaselines(
      makeInput({
        childrenAgeBands: ['5-10'],
        goals: {
          stabilityFirst: false,
          minimizeSeparation: true,
          fairnessStrict: false,
        },
      }),
    );
    expect(withMinSep.maxConsecutiveNightsDefault).toBeLessThan(
      baseline.maxConsecutiveNightsDefault,
    );
  });
});

// ─── 4. Distance favors fewer-handoff templates ────────────────────

describe('distance modifier', () => {
  it('120 min distance → fewer-handoff templates ranked higher', () => {
    const close = recommendBaselines(
      makeInput({ distanceBetweenHomesMinutes: 10 }),
    );
    const far = recommendBaselines(
      makeInput({ distanceBetweenHomesMinutes: 120 }),
    );

    // Find the rank of week-on-week-off in each
    const closeRank = close.recommendedTemplates.findIndex(
      (t) => t.templateId === 'week-on-week-off',
    );
    const farRank = far.recommendedTemplates.findIndex(
      (t) => t.templateId === 'week-on-week-off',
    );

    // week-on-week-off should be ranked higher (lower index) when far
    expect(farRank).toBeLessThan(closeRank);
  });
});

// ─── 5. Determinism ────────────────────────────────────────────────

describe('determinism', () => {
  it('identical input → identical output', () => {
    const input = makeInput({
      childrenAgeBands: ['3-4', '5-10'],
      distanceBetweenHomesMinutes: 30,
      goals: {
        stabilityFirst: true,
        minimizeSeparation: false,
        fairnessStrict: true,
      },
    });

    const result1 = recommendBaselines(input);
    const result2 = recommendBaselines(input);

    expect(result1).toEqual(result2);
  });
});

// ─── 6. Rationale includes disclaimer ──────────────────────────────

describe('rationale disclaimer', () => {
  it('always includes "not advice" disclaimer', () => {
    const result = recommendBaselines(makeInput());
    const hasDisclaimer = result.rationale.some(
      (r) =>
        r.toLowerCase().includes('not') &&
        r.toLowerCase().includes('advice'),
    );
    expect(hasDisclaimer).toBe(true);
  });
});

// ─── 7. Mixed age bands use youngest ───────────────────────────────

describe('mixed age bands', () => {
  it('0-2 + 11-17 → uses youngest (0-2)', () => {
    const result = recommendBaselines(
      makeInput({ childrenAgeBands: ['0-2', '11-17'] }),
    );
    expect(result.maxConsecutiveNightsDefault).toBe(2);
    expect(result.recommendedTemplates[0].templateId).toBe('2-2-3');
  });
});

// ─── 8. Full example I/O fixtures ──────────────────────────────────

describe('example I/O fixtures', () => {
  it('fixture 1: infant, close homes, minimize separation', () => {
    const result = recommendBaselines({
      childrenAgeBands: ['0-2'],
      schoolOrDaycareAnchor: 'daycare',
      exchangePreference: 'prefer_school_daycare',
      distanceBetweenHomesMinutes: 15,
      goals: {
        stabilityFirst: false,
        minimizeSeparation: true,
        fairnessStrict: true,
      },
    });

    expect(result.maxConsecutiveNightsDefault).toBe(2);
    expect(result.maxDaysAwayDefault).toBe(2);
    expect(result.recommendedTemplates[0].templateId).toBe('2-2-3');
    expect(result.recommendedTemplates[0].confidence).toBe('high');
    expect(result.recommendedTemplates.length).toBe(5);
    expect(result.rationale.length).toBeGreaterThanOrEqual(3);
  });

  it('fixture 2: teenager, far apart, stability first', () => {
    const result = recommendBaselines({
      childrenAgeBands: ['11-17'],
      schoolOrDaycareAnchor: 'school',
      exchangePreference: 'ok_in_person',
      distanceBetweenHomesMinutes: 100,
      goals: {
        stabilityFirst: true,
        minimizeSeparation: false,
        fairnessStrict: false,
      },
    });

    expect(result.maxConsecutiveNightsDefault).toBe(7);
    expect(result.recommendedTemplates[0].templateId).toBe('week-on-week-off');
    expect(result.recommendedTemplates[0].confidence).toBe('high');
    // Rationale should mention distance
    const mentionsDistance = result.rationale.some((r) =>
      r.includes('100 min'),
    );
    expect(mentionsDistance).toBe(true);
  });

  it('fixture 3: mixed ages, school anchor, strict fairness', () => {
    const result = recommendBaselines({
      childrenAgeBands: ['3-4', '5-10'],
      schoolOrDaycareAnchor: 'school',
      exchangePreference: 'prefer_school_daycare',
      distanceBetweenHomesMinutes: 25,
      parentConstraintsSummary: {
        lockedNightsCountA: 1,
        lockedNightsCountB: 0,
      },
      goals: {
        stabilityFirst: false,
        minimizeSeparation: false,
        fairnessStrict: true,
      },
    });

    // Youngest is 3-4 → maxConsecutive = 3
    expect(result.maxConsecutiveNightsDefault).toBe(3);
    // School-aligned + fairness should favor 3-4-4-3
    expect(result.recommendedTemplates[0].templateId).toBe('3-4-4-3');
    // primary-weekends should be penalized (asymmetric)
    const pwIndex = result.recommendedTemplates.findIndex(
      (t) => t.templateId === 'primary-weekends',
    );
    expect(pwIndex).toBeGreaterThan(2); // Not in top 3
    // Multiple children note in rationale
    const multiChildNote = result.rationale.some((r) =>
      r.includes('Multiple children'),
    );
    expect(multiChildNote).toBe(true);
  });
});
