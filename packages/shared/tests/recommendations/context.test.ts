import { describe, it, expect } from 'vitest';
import {
  computeFamilyContextDefaults,
  type FamilyGoals,
} from '../../src/recommendations/context';

const REF_DATE = '2026-02-27';

// Helper: date string N months before REF_DATE
function monthsAgo(months: number): string {
  const d = new Date(REF_DATE + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().split('T')[0];
}

describe('computeFamilyContextDefaults', () => {
  // ─── No children / null birthdates → school-age fallback ───

  it('returns school-age defaults when children array is empty', () => {
    const ctx = computeFamilyContextDefaults([]);
    expect(ctx.youngestBand).toBe('5-7y');
    expect(ctx.maxConsecutive).toBe(5);
    expect(ctx.maxAway).toBe(5);
    expect(ctx.solverWeightProfile).toBe('school_age');
    expect(ctx.perChild).toHaveLength(0);
  });

  it('returns school-age defaults when all children have null DOB', () => {
    const ctx = computeFamilyContextDefaults([
      { childId: 'c1', dateOfBirth: null },
      { childId: 'c2', dateOfBirth: null },
    ]);
    expect(ctx.youngestBand).toBe('5-7y');
    expect(ctx.perChild).toHaveLength(0);
  });

  // ─── Single infant ─────────────────────────────────────────

  it('single 3-month-old → infant profile, maxConsecutive=1', () => {
    const ctx = computeFamilyContextDefaults([
      { childId: 'baby', dateOfBirth: monthsAgo(3) },
    ]);
    expect(ctx.youngestBand).toBe('0-6m');
    expect(ctx.maxConsecutive).toBe(1);
    expect(ctx.maxAway).toBe(1);
    expect(ctx.solverWeightProfile).toBe('infant');
    expect(ctx.preferredTemplateIds).toContain('223_daytime');
    expect(ctx.perChild).toHaveLength(1);
    expect(ctx.perChild[0].ageBand).toBe('0-6m');
  });

  // ─── Single teenager ───────────────────────────────────────

  it('single 15-year-old → teen profile, maxConsecutive=7', () => {
    const ctx = computeFamilyContextDefaults([
      { childId: 'teen', dateOfBirth: monthsAgo(15 * 12) },
    ]);
    expect(ctx.youngestBand).toBe('14-17y');
    expect(ctx.maxConsecutive).toBe(7);
    expect(ctx.solverWeightProfile).toBe('teen');
  });

  // ─── Multi-child: youngest-child-rules ─────────────────────

  it('infant + teenager → infant drives family defaults', () => {
    const ctx = computeFamilyContextDefaults([
      { childId: 'teen', dateOfBirth: monthsAgo(14 * 12) },
      { childId: 'baby', dateOfBirth: monthsAgo(9) },
    ]);
    expect(ctx.youngestBand).toBe('6-12m');
    expect(ctx.maxConsecutive).toBe(2);
    expect(ctx.solverWeightProfile).toBe('infant');
    // Per-child still has individual bands
    expect(ctx.perChild).toHaveLength(2);
    const teenChild = ctx.perChild.find((c) => c.childId === 'teen');
    expect(teenChild?.ageBand).toBe('14-17y');
    expect(teenChild?.maxConsecutive).toBe(7);
  });

  it('skips children with null DOB, uses remaining valid child', () => {
    const ctx = computeFamilyContextDefaults([
      { childId: 'c1', dateOfBirth: null },
      { childId: 'c2', dateOfBirth: monthsAgo(4 * 12) }, // 4y → 3-5y band
    ]);
    expect(ctx.youngestBand).toBe('3-5y');
    expect(ctx.maxConsecutive).toBe(4);
    expect(ctx.solverWeightProfile).toBe('young_child');
    expect(ctx.perChild).toHaveLength(1);
  });

  // ─── Goal adjustments ─────────────────────────────────────

  it('stabilityFirst +1 on maxConsecutive', () => {
    const goals: FamilyGoals = { stabilityFirst: true, minimizeSeparation: false, fairnessStrict: false };
    const ctx = computeFamilyContextDefaults(
      [{ childId: 'c', dateOfBirth: monthsAgo(4 * 12) }], // 3-5y band, base=4
      goals,
    );
    expect(ctx.maxConsecutive).toBe(5); // 4+1
  });

  it('minimizeSeparation -1 on maxConsecutive', () => {
    const goals: FamilyGoals = { stabilityFirst: false, minimizeSeparation: true, fairnessStrict: false };
    const ctx = computeFamilyContextDefaults(
      [{ childId: 'c', dateOfBirth: monthsAgo(4 * 12) }], // 3-5y band, base=4
      goals,
    );
    expect(ctx.maxConsecutive).toBe(3); // 4-1
  });

  it('minimizeSeparation floors at 1 for infants', () => {
    const goals: FamilyGoals = { stabilityFirst: false, minimizeSeparation: true, fairnessStrict: false };
    const ctx = computeFamilyContextDefaults(
      [{ childId: 'baby', dateOfBirth: monthsAgo(3) }], // 0-6m, base=1
      goals,
    );
    expect(ctx.maxConsecutive).toBe(1); // floor at 1
  });

  // ─── Solver weight profiles ────────────────────────────────

  it.each([
    { months: 3, expected: 'infant' },
    { months: 9, expected: 'infant' },
    { months: 18, expected: 'young_child' },
    { months: 30, expected: 'young_child' },
    { months: 48, expected: 'young_child' },
    { months: 72, expected: 'school_age' },
    { months: 108, expected: 'school_age' },
    { months: 144, expected: 'teen' },
    { months: 192, expected: 'teen' },
  ])('$months months → $expected profile', ({ months, expected }) => {
    const ctx = computeFamilyContextDefaults([
      { childId: 'c', dateOfBirth: monthsAgo(months) },
    ]);
    expect(ctx.solverWeightProfile).toBe(expected);
  });

  // ─── Preferred templates ───────────────────────────────────

  it('school-age children get 7on7off in preferred templates', () => {
    const ctx = computeFamilyContextDefaults([
      { childId: 'c', dateOfBirth: monthsAgo(8 * 12) },
    ]);
    expect(ctx.preferredTemplateIds).toContain('7on7off');
  });

  // ─── Per-child defaults with goals applied ─────────────────

  it('per-child values reflect goal adjustments individually', () => {
    const goals: FamilyGoals = { stabilityFirst: true, minimizeSeparation: false, fairnessStrict: false };
    const ctx = computeFamilyContextDefaults(
      [
        { childId: 'young', dateOfBirth: monthsAgo(18) }, // 1-2y, base max=2
        { childId: 'older', dateOfBirth: monthsAgo(6 * 12) }, // 5-7y, base max=5
      ],
      goals,
    );
    const young = ctx.perChild.find((c) => c.childId === 'young')!;
    const older = ctx.perChild.find((c) => c.childId === 'older')!;
    expect(young.maxConsecutive).toBe(3); // 2+1
    expect(older.maxConsecutive).toBe(6); // 5+1
  });
});
