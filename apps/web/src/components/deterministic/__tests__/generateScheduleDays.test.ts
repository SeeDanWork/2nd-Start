import { describe, it, expect } from 'vitest';
import { generateScheduleDays } from '../milestones';
import { TEMPLATES_V2 } from '@adcp/shared';

// ─── Helpers ──────────────────────────────────────────────────────

function getPattern(id: string): (0 | 1)[] {
  return TEMPLATES_V2.find((t) => t.id === id)!.pattern14;
}

function maxStreak(days: { assignedTo: string }[]): { parent: string; length: number } {
  let maxLen = 0;
  let maxParent = '';
  let currentLen = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i].assignedTo === days[i - 1].assignedTo) {
      currentLen++;
    } else {
      if (currentLen > maxLen) {
        maxLen = currentLen;
        maxParent = days[i - 1].assignedTo;
      }
      currentLen = 1;
    }
  }
  if (currentLen > maxLen) {
    maxLen = currentLen;
    maxParent = days[days.length - 1].assignedTo;
  }
  return { parent: maxParent, length: maxLen };
}

// ─── Basic Pattern Application ───────────────────────────────────

describe('basic pattern application', () => {
  it('produces exactly 140 days', () => {
    const days = generateScheduleDays(getPattern('223'), new Map(), '2026-03-02');
    expect(days).toHaveLength(140);
  });

  it('every day has date, assignedTo, and source', () => {
    const days = generateScheduleDays(getPattern('223'), new Map(), '2026-03-02');
    for (const d of days) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['parent_a', 'parent_b']).toContain(d.assignedTo);
      expect(d.source).toBeTruthy();
    }
  });

  it('dates are contiguous with no gaps', () => {
    const days = generateScheduleDays(getPattern('223'), new Map(), '2026-03-02');
    for (let i = 1; i < days.length; i++) {
      // Use UTC to avoid DST issues
      const prev = new Date(days[i - 1].date + 'T00:00:00Z');
      const curr = new Date(days[i].date + 'T00:00:00Z');
      const diffMs = curr.getTime() - prev.getTime();
      expect(diffMs).toBe(86400000); // exactly 1 day
    }
  });

  it('dates are unique (no duplicates)', () => {
    const days = generateScheduleDays(getPattern('223'), new Map(), '2026-03-02');
    const dates = days.map((d) => d.date);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('14-day pattern cycles correctly over 140 days', () => {
    const pattern = getPattern('223');
    const days = generateScheduleDays(pattern, new Map(), '2026-03-02'); // Monday
    // Monday = pattern index 0
    for (let cycle = 0; cycle < 10; cycle++) {
      for (let j = 0; j < 14; j++) {
        const dayIdx = cycle * 14 + j;
        if (dayIdx >= 140) break;
        const expected = pattern[j] === 0 ? 'parent_a' : 'parent_b';
        expect(days[dayIdx].assignedTo).toBe(expected);
      }
    }
  });

  it('7-day pattern (43) repeats every 7 days', () => {
    const pattern = getPattern('43');
    expect(pattern).toHaveLength(7);
    const days = generateScheduleDays(pattern, new Map(), '2026-03-02'); // Monday
    // Every 7th day should have the same assignment
    for (let i = 7; i < 140; i++) {
      expect(days[i].assignedTo).toBe(days[i % 7].assignedTo);
    }
  });

  it('28-day pattern (2week_blocks) cycles correctly', () => {
    const pattern = getPattern('2week_blocks');
    expect(pattern).toHaveLength(28);
    const days = generateScheduleDays(pattern, new Map(), '2026-03-02'); // Monday
    // First 14 days should be parent_a, next 14 should be parent_b
    for (let i = 0; i < 14; i++) {
      expect(days[i].assignedTo).toBe('parent_a');
    }
    for (let i = 14; i < 28; i++) {
      expect(days[i].assignedTo).toBe('parent_b');
    }
  });

  it('non-locked days have source "Regular schedule"', () => {
    const days = generateScheduleDays(getPattern('223'), new Map(), '2026-03-02');
    for (const d of days) {
      expect(d.source).toBe('Regular schedule');
    }
  });
});

// ─── Day-of-Week Alignment ───────────────────────────────────────

describe('day-of-week alignment', () => {
  it('Monday start aligns pattern index 0 to Monday', () => {
    // 2026-03-02 is a Monday
    const days = generateScheduleDays([0, 0, 0, 0, 1, 1, 1], new Map(), '2026-03-02');
    // Mon-Thu = parent_a, Fri-Sun = parent_b
    expect(days[0].assignedTo).toBe('parent_a'); // Monday
    expect(days[4].assignedTo).toBe('parent_b'); // Friday
  });

  it('Sunday start aligns pattern index 6 to Sunday', () => {
    // 2026-03-01 is a Sunday
    const days = generateScheduleDays([0, 0, 0, 0, 1, 1, 1], new Map(), '2026-03-01');
    // Sunday at offset = (0+6)%7 = 6 → pattern[6] = 1 → parent_b
    expect(days[0].assignedTo).toBe('parent_b');
    // Monday at offset = (1+6)%7 = 0 → pattern[0] = 0 → parent_a
    expect(days[1].assignedTo).toBe('parent_a');
  });
});

// ─── Lock Override ──────────────────────────────────────────────

describe('lock override', () => {
  it('single lock overrides the pattern', () => {
    const locks = new Map([['2026-03-05', 'parent_b']]);
    const days = generateScheduleDays(getPattern('223'), locks, '2026-03-02');
    const lockedDay = days.find((d) => d.date === '2026-03-05')!;
    expect(lockedDay.assignedTo).toBe('parent_b');
    expect(lockedDay.source).toBe('Disruption');
  });

  it('lock assigns correct parent regardless of pattern', () => {
    // Force parent_a on a day that the pattern would give to parent_b
    const pattern = getPattern('7on7off'); // first 7 days = A, next 7 = B
    const locks = new Map([['2026-03-12', 'parent_a']]); // day 10 (would be B)
    const days = generateScheduleDays(pattern, locks, '2026-03-02');
    const lockedDay = days.find((d) => d.date === '2026-03-12')!;
    expect(lockedDay.assignedTo).toBe('parent_a');
  });

  it('locked days have source "Disruption"', () => {
    const locks = new Map([
      ['2026-03-05', 'parent_b'],
      ['2026-03-06', 'parent_b'],
    ]);
    const days = generateScheduleDays(getPattern('223'), locks, '2026-03-02');
    const disrupted = days.filter((d) => d.source === 'Disruption');
    expect(disrupted).toHaveLength(2);
  });

  it('multiple locks on consecutive days all applied', () => {
    const locks = new Map([
      ['2026-03-14', 'parent_b'],
      ['2026-03-15', 'parent_b'],
      ['2026-03-16', 'parent_b'],
      ['2026-03-17', 'parent_b'],
      ['2026-03-18', 'parent_b'],
    ]);
    const days = generateScheduleDays(getPattern('7on7off'), locks, '2026-03-02');
    for (const date of locks.keys()) {
      const day = days.find((d) => d.date === date)!;
      expect(day.assignedTo).toBe('parent_b');
      expect(day.source).toBe('Disruption');
    }
  });
});

// ─── maxConsecutive Enforcement ──────────────────────────────────

describe('maxConsecutive enforcement', () => {
  it('7on7off with maxConsecutive=5: no streak exceeds 5', () => {
    const days = generateScheduleDays(getPattern('7on7off'), new Map(), '2026-03-02', 5);
    const streak = maxStreak(days);
    expect(streak.length).toBeLessThanOrEqual(5);
  });

  it('2week_blocks with maxConsecutive=7: no streak exceeds 7', () => {
    const days = generateScheduleDays(getPattern('2week_blocks'), new Map(), '2026-03-02', 7);
    const streak = maxStreak(days);
    expect(streak.length).toBeLessThanOrEqual(7);
  });

  it('swapped days have source "Max-consecutive cap"', () => {
    // 7on7off natively has 7-day blocks; maxConsecutive=5 forces swaps
    const days = generateScheduleDays(getPattern('7on7off'), new Map(), '2026-03-02', 5);
    const swapped = days.filter((d) => d.source === 'Max-consecutive cap');
    expect(swapped.length).toBeGreaterThan(0);
  });

  it('maxConsecutive=3 with 2255 (5-day blocks): caps enforced', () => {
    const days = generateScheduleDays(getPattern('2255'), new Map(), '2026-03-02', 3);
    const streak = maxStreak(days);
    expect(streak.length).toBeLessThanOrEqual(3);
  });

  it('maxConsecutive=14 with 2week_blocks: no swaps needed', () => {
    const days = generateScheduleDays(getPattern('2week_blocks'), new Map(), '2026-03-02', 14);
    const swapped = days.filter((d) => d.source === 'Max-consecutive cap');
    expect(swapped.length).toBe(0);
  });

  it('maxConsecutive=1 produces alternating days', () => {
    const days = generateScheduleDays(getPattern('7on7off'), new Map(), '2026-03-02', 1);
    for (let i = 1; i < days.length; i++) {
      expect(days[i].assignedTo).not.toBe(days[i - 1].assignedTo);
    }
  });

  it('locked days are NEVER swapped even if they extend a streak', () => {
    // Lock 6 consecutive days to parent_a, then check maxConsecutive=3
    const locks = new Map<string, string>();
    for (let i = 0; i < 6; i++) {
      const d = new Date('2026-03-02T00:00:00');
      d.setDate(d.getDate() + i);
      locks.set(d.toISOString().slice(0, 10), 'parent_a');
    }
    const days = generateScheduleDays(getPattern('7on7off'), locks, '2026-03-02', 3);
    // First 6 days should still be parent_a (locked)
    for (let i = 0; i < 6; i++) {
      expect(days[i].assignedTo).toBe('parent_a');
      expect(days[i].source).toBe('Disruption');
    }
  });

  it('without maxConsecutive, 7on7off has natural 7-day streaks', () => {
    const days = generateScheduleDays(getPattern('7on7off'), new Map(), '2026-03-02');
    const streak = maxStreak(days);
    expect(streak.length).toBe(7);
  });
});

// ─── Travel Scenario Regression ─────────────────────────────────

describe('travel scenario regression', () => {
  it('father travel: parent_a never appears on locked days', () => {
    // Father (parent_a) is traveling days 3-7 → lock child with parent_b
    const locks = new Map<string, string>();
    for (let i = 2; i < 7; i++) {
      const d = new Date('2026-03-02T00:00:00');
      d.setDate(d.getDate() + i);
      locks.set(d.toISOString().slice(0, 10), 'parent_b');
    }
    const days = generateScheduleDays(getPattern('7on7off'), locks, '2026-03-02', 5);
    for (const [date] of locks) {
      const day = days.find((d) => d.date === date)!;
      expect(day.assignedTo).toBe('parent_b');
    }
  });

  it('after 5-day lock block, maxConsecutive breaks the streak', () => {
    const locks = new Map<string, string>();
    // Lock days 0-4 to parent_b (5 days)
    for (let i = 0; i < 5; i++) {
      const d = new Date('2026-03-02T00:00:00');
      d.setDate(d.getDate() + i);
      locks.set(d.toISOString().slice(0, 10), 'parent_b');
    }
    // Pattern is 7on7off starting with A block. Days 5-6 would be A (regular).
    // But days 7+ would be B block (7on7off second week).
    // With maxConsecutive=5, the B streak from locks (5) + pattern (7) would be broken.
    const days = generateScheduleDays(getPattern('7on7off'), locks, '2026-03-02', 5);

    // Count max consecutive for parent_b after the lock block
    let bStreak = 0;
    let maxB = 0;
    for (const d of days) {
      if (d.assignedTo === 'parent_b') {
        bStreak++;
        maxB = Math.max(maxB, bStreak);
      } else {
        bStreak = 0;
      }
    }
    // Locked days count toward the streak, but non-locked days should be swapped
    // after maxConsecutive is reached
    expect(maxB).toBeLessThanOrEqual(5 + 1); // locks (5) + at most 1 before cap kicks in on non-locked
  });
});

// ─── Determinism ────────────────────────────────────────────────

describe('determinism', () => {
  it('same inputs produce identical outputs', () => {
    const locks = new Map([['2026-03-10', 'parent_b']]);
    const a = generateScheduleDays(getPattern('223'), locks, '2026-03-02', 5);
    const b = generateScheduleDays(getPattern('223'), locks, '2026-03-02', 5);
    expect(a).toEqual(b);
  });
});
