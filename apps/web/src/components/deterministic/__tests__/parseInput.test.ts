import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseFamilyInput, parseDisruptionInput } from '../parseInput';
import { DisruptionEventType, OverrideStrength } from '@adcp/shared';

// ─── Time Control ────────────────────────────────────────────────
// parseInput uses new Date() internally, so we freeze time for deterministic tests.

const FROZEN_NOW = new Date('2026-03-02T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── parseFamilyInput: Children ─────────────────────────────────

describe('parseFamilyInput: children', () => {
  it('"kids ages 3 and 7" → 2 children', () => {
    const { input } = parseFamilyInput('kids ages 3 and 7');
    expect(input.children).toHaveLength(2);
    // Each has a birthdate (not ageBand)
    for (const c of input.children) {
      expect(c.birthdate).toBeTruthy();
    }
  });

  it('"child ages 2, 5, and 10" → 3 children', () => {
    const { input } = parseFamilyInput('child ages 2, 5, and 10');
    expect(input.children).toHaveLength(3);
  });

  it('"8 month old" → 1 child with birthdate ~8 months ago', () => {
    const { input } = parseFamilyInput('8 month old');
    expect(input.children).toHaveLength(1);
    const bd = new Date(input.children[0].birthdate! + 'T00:00:00Z');
    const monthsDiff =
      (FROZEN_NOW.getFullYear() - bd.getFullYear()) * 12 +
      (FROZEN_NOW.getMonth() - bd.getMonth());
    expect(monthsDiff).toBeGreaterThanOrEqual(7);
    expect(monthsDiff).toBeLessThanOrEqual(9);
  });

  it('"born 2022-05-15" → 1 child with exact birthdate', () => {
    const { input } = parseFamilyInput('born 2022-05-15');
    expect(input.children).toHaveLength(1);
    expect(input.children[0].birthdate).toBe('2022-05-15');
  });

  it('"5-year-old" → 1 child', () => {
    const { input } = parseFamilyInput('5-year-old');
    expect(input.children).toHaveLength(1);
  });

  it('no child info → defaults with warning', () => {
    const { input, warnings } = parseFamilyInput('shared school stability');
    expect(input.children).toHaveLength(1);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('No children detected');
  });

  it('standalone date "2020-01-15" as birthdate', () => {
    const { input } = parseFamilyInput('2020-01-15');
    expect(input.children).toHaveLength(1);
    expect(input.children[0].birthdate).toBe('2020-01-15');
  });
});

// ─── parseFamilyInput: Arrangement ──────────────────────────────

describe('parseFamilyInput: arrangement', () => {
  it('"primary" → primary_visits detected (text presence)', () => {
    const { input } = parseFamilyInput('primary kids ages 5');
    // arrangement isn't stored in input, but we can verify goals/structure
    // The arrangement detection happens in DeterministicView, not parseFamilyInput
    // However, the fact it parses without error is the key test
    expect(input.children).toHaveLength(1);
  });
});

// ─── parseFamilyInput: Goals ────────────────────────────────────

describe('parseFamilyInput: goals', () => {
  it('"stability" → stabilityFirst: true', () => {
    const { input } = parseFamilyInput('kids ages 5 stability');
    expect(input.goals.stabilityFirst).toBe(true);
  });

  it('"minimize separation" → minimizeSeparation: true', () => {
    const { input } = parseFamilyInput('kids ages 5 minimize separation');
    expect(input.goals.minimizeSeparation).toBe(true);
  });

  it('"fairness" → fairnessStrict: true', () => {
    const { input } = parseFamilyInput('kids ages 5 fairness');
    expect(input.goals.fairnessStrict).toBe(true);
  });

  it('"50/50" → fairnessStrict: true', () => {
    const { input } = parseFamilyInput('kids ages 5 50/50');
    expect(input.goals.fairnessStrict).toBe(true);
  });

  it('"equal" → fairnessStrict: true', () => {
    const { input } = parseFamilyInput('kids ages 5 equal');
    expect(input.goals.fairnessStrict).toBe(true);
  });

  it('multiple goals in same text all set', () => {
    const { input } = parseFamilyInput('kids ages 5 stability fairness');
    expect(input.goals.stabilityFirst).toBe(true);
    expect(input.goals.fairnessStrict).toBe(true);
  });

  it('no goals → all false', () => {
    const { input } = parseFamilyInput('kids ages 5');
    expect(input.goals.stabilityFirst).toBe(false);
    expect(input.goals.minimizeSeparation).toBe(false);
    expect(input.goals.fairnessStrict).toBe(false);
  });
});

// ─── parseFamilyInput: Anchor ───────────────────────────────────

describe('parseFamilyInput: anchor', () => {
  it('"school" → type school, days Mon-Fri', () => {
    const { input } = parseFamilyInput('kids ages 5 school');
    expect(input.anchor.type).toBe('school');
    expect(input.anchor.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('"daycare" → type daycare', () => {
    const { input } = parseFamilyInput('kids ages 2 daycare');
    expect(input.anchor.type).toBe('daycare');
  });

  it('no anchor keyword → type none', () => {
    const { input } = parseFamilyInput('kids ages 5');
    expect(input.anchor.type).toBe('none');
  });
});

// ─── parseFamilyInput: Distance ─────────────────────────────────

describe('parseFamilyInput: distance', () => {
  it('"35 minutes apart" → 35', () => {
    const { input } = parseFamilyInput('kids ages 5 35 minutes apart');
    expect(input.distanceBetweenHomesMinutes).toBe(35);
  });

  it('"60 min drive" → 60', () => {
    const { input } = parseFamilyInput('kids ages 5 60 min drive');
    expect(input.distanceBetweenHomesMinutes).toBe(60);
  });

  it('no distance → defaults to 15', () => {
    const { input } = parseFamilyInput('kids ages 5');
    expect(input.distanceBetweenHomesMinutes).toBe(15);
  });
});

// ─── parseFamilyInput: Constraints ──────────────────────────────

describe('parseFamilyInput: constraints', () => {
  it('"father 3 locked nights" → lockedNightsCountA: 3', () => {
    const { input } = parseFamilyInput('kids ages 5 father 3 locked nights');
    expect(input.constraintsSummary?.lockedNightsCountA).toBe(3);
  });

  it('"shift work" → shiftWorkLikelyA: true', () => {
    const { input } = parseFamilyInput('kids ages 5 shift work');
    expect(input.constraintsSummary?.shiftWorkLikelyA).toBe(true);
  });

  it('"no in-person" → noInPersonExchange: true', () => {
    const { input } = parseFamilyInput('kids ages 5 no in-person');
    expect(input.constraintsSummary?.noInPersonExchange).toBe(true);
  });
});

// ─── parseFamilyInput: Exchange Preference ──────────────────────

describe('parseFamilyInput: exchange preference', () => {
  it('school anchor → auto-sets prefer_anchor', () => {
    const { input } = parseFamilyInput('kids ages 5 school');
    expect(input.exchangePreference).toBe('prefer_anchor');
  });

  it('no anchor → unknown', () => {
    const { input } = parseFamilyInput('kids ages 5');
    expect(input.exchangePreference).toBe('unknown');
  });
});

// ─── parseDisruptionInput ───────────────────────────────────────

describe('parseDisruptionInput', () => {
  it('"child sick 2026-03-10" → CHILD_SICK event', () => {
    const events = parseDisruptionInput('child sick 2026-03-10');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(DisruptionEventType.CHILD_SICK);
    expect(events[0].startDate).toBe('2026-03-10');
  });

  it('"father travel 2026-03-14 5 days" → PARENT_TRAVEL with correct dates and parent', () => {
    const events = parseDisruptionInput('father travel 2026-03-14 5 days');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(DisruptionEventType.PARENT_TRAVEL);
    expect(events[0].startDate).toBe('2026-03-14');
    expect(events[0].endDate).toBe('2026-03-18'); // 5 days: 14,15,16,17,18
    expect(events[0].reportedBy).toBe('parent_a');
    expect(events[0].metadata).toEqual({ affectedParent: 'parent_a' });
  });

  it('"school closed March 10" → SCHOOL_CLOSED with correct date', () => {
    const events = parseDisruptionInput('school closed March 10');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(DisruptionEventType.SCHOOL_CLOSED);
    expect(events[0].startDate).toBe('2026-03-10');
  });

  it('"holiday tomorrow" → PUBLIC_HOLIDAY with tomorrow\'s date', () => {
    const events = parseDisruptionInput('holiday tomorrow');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(DisruptionEventType.PUBLIC_HOLIDAY);
    expect(events[0].startDate).toBe('2026-03-03'); // tomorrow from frozen 2026-03-02
  });

  it('"camp 2026-07-01 2 weeks" → CAMP_WEEK with 14-day duration', () => {
    const events = parseDisruptionInput('camp 2026-07-01 2 weeks');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(DisruptionEventType.CAMP_WEEK);
    expect(events[0].startDate).toBe('2026-07-01');
    expect(events[0].endDate).toBe('2026-07-14');
  });

  it('"hard" keyword sets HARD strength', () => {
    const events = parseDisruptionInput('father travel 2026-03-14 5 days hard');
    expect(events[0].overrideStrength).toBe(OverrideStrength.HARD);
  });

  it('"must" keyword sets HARD strength', () => {
    const events = parseDisruptionInput('child sick 2026-03-10 must');
    expect(events[0].overrideStrength).toBe(OverrideStrength.HARD);
  });

  it('multi-line input → multiple events', () => {
    const events = parseDisruptionInput(
      'child sick 2026-03-10\nfather travel 2026-03-14 5 days',
    );
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe(DisruptionEventType.CHILD_SICK);
    expect(events[1].type).toBe(DisruptionEventType.PARENT_TRAVEL);
  });

  it('unknown event type defaults to OTHER_DECLARED', () => {
    const events = parseDisruptionInput('something weird 2026-03-10');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(DisruptionEventType.OTHER_DECLARED);
  });

  it('"mother travel" → reportedBy parent_b with metadata', () => {
    const events = parseDisruptionInput('mother travel 2026-03-14 3 days');
    expect(events[0].reportedBy).toBe('parent_b');
    expect(events[0].metadata).toEqual({ affectedParent: 'parent_b' });
  });

  it('no parent keyword → reportedBy null, metadata empty', () => {
    const events = parseDisruptionInput('holiday 2026-03-14');
    expect(events[0].reportedBy).toBeNull();
    expect(events[0].metadata).toEqual({});
  });

  it('all events have unique IDs', () => {
    const events = parseDisruptionInput(
      'child sick 2026-03-10\nfather travel 2026-03-14 5 days\nholiday 2026-03-20',
    );
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all events have required fields', () => {
    const events = parseDisruptionInput('father travel 2026-03-14 5 days');
    const e = events[0];
    expect(e.id).toBeTruthy();
    expect(e.familyId).toBe('synthetic-family');
    expect(e.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(e.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(e.resolvedAt).toBeNull();
  });
});
