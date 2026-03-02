import { describe, it, expect } from 'vitest';
import { TEMPLATES_V2, type TemplateDefV2 } from '../../src/recommendations/templates';

// ─── Helpers ──────────────────────────────────────────────────────

/** Count occurrences of a value in a pattern */
function count(pattern: (0 | 1)[], value: 0 | 1): number {
  return pattern.filter((v) => v === value).length;
}

/** Longest consecutive run of `value` in a pattern (non-wrapping). */
function longestRun(pattern: (0 | 1)[], value: 0 | 1): number {
  let max = 0;
  let current = 0;
  for (const v of pattern) {
    if (v === value) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

/** Count transitions (0→1 or 1→0) in a pattern, treating it as cyclic. */
function countTransitions(pattern: (0 | 1)[]): number {
  let transitions = 0;
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i] !== pattern[i - 1]) transitions++;
  }
  // Wrap: last → first
  if (pattern[pattern.length - 1] !== pattern[0]) transitions++;
  return transitions;
}

/**
 * Normalize a variable-length pattern to a 14-day cycle for nights/handoff comparison.
 * For 7-day patterns, repeat once. For 28-day, fold to two 14-day halves.
 */
function normalizeTo14(pattern: (0 | 1)[]): (0 | 1)[] {
  if (pattern.length === 14) return pattern;
  if (pattern.length === 7) return [...pattern, ...pattern];
  if (pattern.length === 28) return pattern.slice(0, 14); // first half
  return pattern; // unexpected length, return as-is
}

// ─── Tests ────────────────────────────────────────────────────────

describe('template catalog integrity', () => {
  it('all template IDs are unique', () => {
    const ids = TEMPLATES_V2.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('catalog contains exactly 13 templates', () => {
    expect(TEMPLATES_V2).toHaveLength(13);
  });
});

describe('template pattern metadata consistency', () => {
  const templates = TEMPLATES_V2.map((t): [string, TemplateDefV2] => [t.id, t]);

  it.each(templates)('%s: nightsA matches count of 0s in pattern', (id, template) => {
    expect(count(template.pattern14, 0)).toBe(template.nightsA);
  });

  it.each(templates)('%s: nightsB matches count of 1s in pattern', (id, template) => {
    expect(count(template.pattern14, 1)).toBe(template.nightsB);
  });

  it.each(templates)('%s: nightsA + nightsB = pattern length', (id, template) => {
    expect(template.nightsA + template.nightsB).toBe(template.pattern14.length);
  });

  it.each(templates)('%s: maxBlockA matches longest consecutive run of 0s', (id, template) => {
    expect(longestRun(template.pattern14, 0)).toBe(template.maxBlockA);
  });

  it.each(templates)('%s: maxBlockB matches longest consecutive run of 1s', (id, template) => {
    expect(longestRun(template.pattern14, 1)).toBe(template.maxBlockB);
  });

  it.each(templates)('%s: maxBlock = max(maxBlockA, maxBlockB)', (id, template) => {
    expect(template.maxBlock).toBe(Math.max(template.maxBlockA, template.maxBlockB));
  });

  it.each(templates)('%s: pattern only contains 0 and 1', (id, template) => {
    for (const v of template.pattern14) {
      expect([0, 1]).toContain(v);
    }
  });

  it.each(templates)('%s: handoffsPer2Weeks is a positive integer', (id, template) => {
    expect(template.handoffsPer2Weeks).toBeGreaterThan(0);
    expect(Number.isInteger(template.handoffsPer2Weeks)).toBe(true);
  });

  it.each(templates)('%s: pattern has at least one transition', (id, template) => {
    const transitions = countTransitions(template.pattern14);
    expect(transitions).toBeGreaterThanOrEqual(2); // at least one A→B and one B→A
  });
});

describe('template pattern lengths', () => {
  it('7-day pattern: 43', () => {
    expect(TEMPLATES_V2.find((t) => t.id === '43')!.pattern14).toHaveLength(7);
  });

  it('7-day pattern: 52_weekday_weekend', () => {
    expect(TEMPLATES_V2.find((t) => t.id === '52_weekday_weekend')!.pattern14).toHaveLength(7);
  });

  it('14-day pattern: 223', () => {
    expect(TEMPLATES_V2.find((t) => t.id === '223')!.pattern14).toHaveLength(14);
  });

  it('28-day pattern: 2week_blocks', () => {
    expect(TEMPLATES_V2.find((t) => t.id === '2week_blocks')!.pattern14).toHaveLength(28);
  });

  it('all patterns have valid length (7, 14, or 28)', () => {
    for (const t of TEMPLATES_V2) {
      expect([7, 14, 28]).toContain(t.pattern14.length);
    }
  });
});

describe('2-week blocks regression', () => {
  const twoWeek = TEMPLATES_V2.find((t) => t.id === '2week_blocks')!;

  it('first 14 days are all parent A (0)', () => {
    const firstHalf = twoWeek.pattern14.slice(0, 14);
    expect(firstHalf.every((v) => v === 0)).toBe(true);
  });

  it('last 14 days are all parent B (1)', () => {
    const secondHalf = twoWeek.pattern14.slice(14, 28);
    expect(secondHalf.every((v) => v === 1)).toBe(true);
  });

  it('nightsA = 14, nightsB = 14', () => {
    expect(twoWeek.nightsA).toBe(14);
    expect(twoWeek.nightsB).toBe(14);
  });

  it('maxBlock = 14 (not 28 — each parent only 14 consecutive)', () => {
    expect(twoWeek.maxBlock).toBe(14);
  });
});

describe('minAgeMonths ordering', () => {
  it('templates with very long blocks (14+) have high minAgeMonths', () => {
    const veryLongBlock = TEMPLATES_V2.filter((t) => t.maxBlock >= 14);
    for (const t of veryLongBlock) {
      expect(t.minAgeMonths).toBeGreaterThanOrEqual(120); // at least 10y
    }
  });

  it('50/50 templates with maxBlock >= 7 require school age', () => {
    // Equal-time templates with week-long blocks need older children
    const longEqual = TEMPLATES_V2.filter(
      (t) => t.maxBlock >= 7 && t.nightsA === t.nightsB,
    );
    for (const t of longEqual) {
      expect(t.minAgeMonths).toBeGreaterThanOrEqual(60);
    }
  });

  it('2week_blocks has the highest minAgeMonths', () => {
    const twoWeek = TEMPLATES_V2.find((t) => t.id === '2week_blocks')!;
    for (const t of TEMPLATES_V2) {
      expect(twoWeek.minAgeMonths).toBeGreaterThanOrEqual(t.minAgeMonths);
    }
  });

  it('223_daytime has minAgeMonths = 0 (suitable for newborns)', () => {
    const daytime = TEMPLATES_V2.find((t) => t.id === '223_daytime')!;
    expect(daytime.minAgeMonths).toBe(0);
  });
});

describe('template metadata fields', () => {
  it.each(TEMPLATES_V2.map((t): [string, TemplateDefV2] => [t.id, t]))(
    '%s: has all required metadata fields',
    (id, template) => {
      expect(template.name).toBeTruthy();
      expect(template.splitRatio).toBeTruthy();
      expect(template.evidenceBasis).toBeTruthy();
      expect(template.suggestedWhenBase.length).toBeGreaterThanOrEqual(2);
      expect(template.tradeoffsBase.length).toBeGreaterThanOrEqual(2);
      expect(template.minAgeMonths).toBeGreaterThanOrEqual(0);
    },
  );

  it('50/50 templates have equal nights', () => {
    const equal = TEMPLATES_V2.filter((t) => t.splitRatio === '50/50');
    expect(equal.length).toBeGreaterThanOrEqual(5);
    for (const t of equal) {
      expect(t.nightsA).toBe(t.nightsB);
    }
  });
});
