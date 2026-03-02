import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeMilestones, MILESTONES } from '../milestones';
import type { BaselineRecommendationInputV2 } from '@adcp/shared';
import {
  DisruptionEventType,
  DisruptionScope,
  DisruptionSource,
  OverrideStrength,
} from '@adcp/shared';
import type { DisruptionEvent } from '@adcp/shared';

// ─── Time Control ────────────────────────────────────────────────

const FROZEN_NOW = new Date('2026-03-02T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Helpers ──────────────────────────────────────────────────────

function makeInput(
  overrides: Partial<BaselineRecommendationInputV2> = {},
): BaselineRecommendationInputV2 {
  return {
    children: [{ childId: 'c1', birthdate: '2020-03-01' }], // ~6 years old
    anchor: { type: 'school' },
    exchangePreference: 'prefer_anchor',
    goals: {
      stabilityFirst: false,
      minimizeSeparation: false,
      fairnessStrict: false,
    },
    aggregationMode: 'youngest_child_rules',
    ...overrides,
  };
}

function makeDisruptionEvent(overrides: Partial<DisruptionEvent> = {}): DisruptionEvent {
  return {
    id: 'test-event-1',
    familyId: 'synthetic-family',
    type: DisruptionEventType.PARENT_TRAVEL,
    scope: DisruptionScope.HOUSEHOLD,
    source: DisruptionSource.USER_DECLARED,
    overrideStrength: OverrideStrength.SOFT,
    startDate: '2026-03-14',
    endDate: '2026-03-18',
    metadata: { affectedParent: 'parent_a' },
    reportedBy: 'parent_a',
    resolvedAt: null,
    ...overrides,
  };
}

// ─── Snapshot Structure ─────────────────────────────────────────

describe('snapshot structure', () => {
  it('returns exactly 6 snapshots', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [],
    });
    expect(snapshots).toHaveLength(6);
  });

  it('snapshots have correct labels', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [],
    });
    expect(snapshots.map((s) => s.label)).toEqual(
      MILESTONES.map((m) => m.label),
    );
  });

  it('each snapshot has all required fields populated', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [],
    });
    for (const s of snapshots) {
      expect(s.refDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.children.length).toBeGreaterThan(0);
      expect(s.youngestBand).toBeTruthy();
      expect(s.weightProfile).toBeTruthy();
      expect(s.solverWeights.length).toBeGreaterThan(0);
      expect(s.recommendation).toBeDefined();
      expect(s.rationale.length).toBeGreaterThan(0);
      expect(s.scheduleDays).toHaveLength(140);
      expect(s.templateSchedules.length).toBeGreaterThan(0);
      expect(s.templateSchedules.length).toBeLessThanOrEqual(4);
    }
  });

  it('refDate for each milestone is correctly offset from today', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [],
    });
    const today = FROZEN_NOW.toISOString().slice(0, 10);
    for (let i = 0; i < snapshots.length; i++) {
      const expected = new Date(today + 'T00:00:00Z');
      expected.setUTCDate(expected.getUTCDate() + MILESTONES[i].days);
      expect(snapshots[i].refDate).toBe(expected.toISOString().slice(0, 10));
    }
  });
});

// ─── Age Band Transitions Over Time ─────────────────────────────

describe('age band transitions', () => {
  it('11-month-old transitions from 6-12m to 1-2y around +3 months', () => {
    const input = makeInput({
      children: [{ childId: 'baby', birthdate: '2025-04-01' }], // ~11 months at start
    });
    const snapshots = computeMilestones({
      familyInput: input,
      arrangement: 'shared',
      disruptionEvents: [],
    });

    // Start: 11 months → 6-12m
    expect(snapshots[0].children[0].ageBand).toBe('6-12m');

    // +3 months: 14 months → 1-2y
    const threeMonths = snapshots.find((s) => s.label === '+3 Months')!;
    expect(threeMonths.children[0].ageBand).toBe('1-2y');
  });

  it('child without birthdate stays in same band across all milestones', () => {
    const input = makeInput({
      children: [{ childId: 'kid', ageBand: '5-7y' } as any],
    });
    // Remove birthdate to force ageBand-only path
    input.children[0] = { childId: 'kid', ageBand: '5-7y' };
    const snapshots = computeMilestones({
      familyInput: input,
      arrangement: 'shared',
      disruptionEvents: [],
    });

    for (const s of snapshots) {
      expect(s.children[0].ageBand).toBe('5-7y');
    }
  });

  it('changes array detects band_transition', () => {
    const input = makeInput({
      children: [{ childId: 'baby', birthdate: '2025-04-01' }],
    });
    const snapshots = computeMilestones({
      familyInput: input,
      arrangement: 'shared',
      disruptionEvents: [],
    });

    // Find a milestone with a band transition
    const transitionMilestone = snapshots.find((s) =>
      s.changes.some((c) => c.type === 'band_transition'),
    );
    expect(transitionMilestone).toBeDefined();
  });
});

// ─── Disruption Overlay Integration ─────────────────────────────

describe('disruption overlay integration', () => {
  it('no disruptions → empty overlays at each milestone', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [],
    });
    for (const s of snapshots) {
      expect(s.overlays).toHaveLength(0);
      expect(s.solverPayload).toBeNull();
    }
  });

  it('with disruption → Start milestone has locks', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [makeDisruptionEvent()],
    });
    const start = snapshots[0];
    expect(start.overlays.length).toBeGreaterThan(0);
    expect(start.solverPayload).not.toBeNull();
    expect(start.solverPayload!.disruption_locks.length).toBeGreaterThan(0);
  });

  it('disruption dates are time-shifted for future milestones', () => {
    const event = makeDisruptionEvent({
      startDate: '2026-03-14',
      endDate: '2026-03-18',
    });
    const snapshots = computeMilestones({
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [event],
    });

    // +2 weeks milestone: disruption dates should be shifted by 14 days
    const twoWeeks = snapshots.find((s) => s.label === '+2 Weeks')!;
    if (twoWeeks.overlays.length > 0) {
      // The overlay's dates should be approximately 14 days after the original
      const lockDates = twoWeeks.solverPayload?.disruption_locks.map((l) => l.date) ?? [];
      if (lockDates.length > 0) {
        const firstLock = new Date(lockDates[0] + 'T00:00:00Z');
        const originalStart = new Date('2026-03-14T00:00:00Z');
        const diffDays = Math.round(
          (firstLock.getTime() - originalStart.getTime()) / 86400000,
        );
        expect(diffDays).toBe(14); // shifted by 14 days
      }
    }
  });

  it('locks appear in generated schedule days', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [makeDisruptionEvent()],
    });
    const start = snapshots[0];
    const disruptedDays = start.scheduleDays.filter(
      (d) => d.source === 'Disruption',
    );
    expect(disruptedDays.length).toBeGreaterThan(0);
  });
});

// ─── Schedule Generation Within Milestones ──────────────────────

describe('schedule generation within milestones', () => {
  it('scheduleDays is 140 entries at each milestone', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [],
    });
    for (const s of snapshots) {
      expect(s.scheduleDays).toHaveLength(140);
    }
  });

  it('templateSchedules has 1-4 entries each with 140 days', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [],
    });
    for (const s of snapshots) {
      expect(s.templateSchedules.length).toBeGreaterThanOrEqual(1);
      expect(s.templateSchedules.length).toBeLessThanOrEqual(4);
      for (const ts of s.templateSchedules) {
        expect(ts.scheduleDays).toHaveLength(140);
        expect(ts.template.templateId).toBeTruthy();
      }
    }
  });
});

// ─── Determinism ────────────────────────────────────────────────

describe('determinism', () => {
  it('same input → deep-equal output', () => {
    const input = {
      familyInput: makeInput(),
      arrangement: 'shared',
      disruptionEvents: [] as DisruptionEvent[],
    };
    const a = computeMilestones(input);
    const b = computeMilestones(input);
    expect(a).toEqual(b);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────

describe('edge cases', () => {
  it('single child, no disruptions, minimal input', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput({
        children: [{ childId: 'c1', ageBand: '5-7y' }],
        anchor: { type: 'none' },
        exchangePreference: 'unknown',
      }),
      arrangement: 'shared',
      disruptionEvents: [],
    });
    expect(snapshots).toHaveLength(6);
    for (const s of snapshots) {
      expect(s.topTemplate).not.toBeNull();
    }
  });

  it('multiple children produce valid output', () => {
    const snapshots = computeMilestones({
      familyInput: makeInput({
        children: [
          { childId: 'c1', birthdate: '2023-01-01' },
          { childId: 'c2', birthdate: '2020-06-15' },
        ],
      }),
      arrangement: 'shared',
      disruptionEvents: [],
    });
    expect(snapshots).toHaveLength(6);
    for (const s of snapshots) {
      expect(s.children).toHaveLength(2);
    }
  });
});
