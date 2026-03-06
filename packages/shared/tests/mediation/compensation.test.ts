import { describe, it, expect } from 'vitest';
import { labelCalendarDiffs } from '../../src/mediation/compensation';
import { ParentRole } from '../../src/enums';
import type { CalendarDiffEntry } from '../../src/types';

describe('labelCalendarDiffs', () => {
  it('labels requested dates correctly', () => {
    const diff: CalendarDiffEntry[] = [
      { date: '2026-03-10', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
    ];
    const result = labelCalendarDiffs(diff, ['2026-03-10']);
    expect(result).toHaveLength(1);
    expect(result[0].isRequested).toBe(true);
    expect(result[0].isCompensation).toBe(false);
  });

  it('labels compensation dates correctly', () => {
    const diff: CalendarDiffEntry[] = [
      { date: '2026-03-10', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
      { date: '2026-03-14', oldParent: ParentRole.PARENT_B, newParent: ParentRole.PARENT_A },
    ];
    const result = labelCalendarDiffs(diff, ['2026-03-10']);
    expect(result[0].isRequested).toBe(true);
    expect(result[0].isCompensation).toBe(false);
    expect(result[1].isRequested).toBe(false);
    expect(result[1].isCompensation).toBe(true);
  });

  it('handles empty diff', () => {
    expect(labelCalendarDiffs([], ['2026-03-10'])).toEqual([]);
  });

  it('handles empty request dates — all are compensation', () => {
    const diff: CalendarDiffEntry[] = [
      { date: '2026-03-10', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
    ];
    const result = labelCalendarDiffs(diff, []);
    expect(result[0].isRequested).toBe(false);
    expect(result[0].isCompensation).toBe(true);
  });

  it('handles all-requested scenario', () => {
    const diff: CalendarDiffEntry[] = [
      { date: '2026-03-10', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
      { date: '2026-03-11', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
    ];
    const result = labelCalendarDiffs(diff, ['2026-03-10', '2026-03-11']);
    expect(result.every((d) => d.isRequested)).toBe(true);
    expect(result.every((d) => !d.isCompensation)).toBe(true);
  });

  it('preserves parent role values', () => {
    const diff: CalendarDiffEntry[] = [
      { date: '2026-03-10', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
    ];
    const result = labelCalendarDiffs(diff, []);
    expect(result[0].oldParent).toBe(ParentRole.PARENT_A);
    expect(result[0].newParent).toBe(ParentRole.PARENT_B);
  });
});
