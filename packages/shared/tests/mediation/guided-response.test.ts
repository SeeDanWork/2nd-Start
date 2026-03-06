import { describe, it, expect } from 'vitest';
import { buildGuidedResponse, buildGuidedBundle } from '../../src/mediation/guided-response';
import { ParentRole } from '../../src/enums';
import type { ProposalOption } from '../../src/types';

function makeOption(overrides: Partial<ProposalOption> = {}): ProposalOption {
  return {
    id: 'opt-1',
    bundleId: 'bundle-1',
    rank: 1,
    label: 'Minimal change',
    calendarDiff: [
      { date: '2026-03-10', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
      { date: '2026-03-14', oldParent: ParentRole.PARENT_B, newParent: ParentRole.PARENT_A },
    ],
    fairnessImpact: { overnightDelta: 0, weekendDelta: 0, windowWeeks: 8 },
    stabilityImpact: { transitionsDelta: 1, maxStreakChange: 0, schoolNightChanges: 0 },
    handoffImpact: { newHandoffs: 1, removedHandoffs: 0, nonDaycareHandoffs: 0 },
    penaltyScore: 5.2,
    isAutoApprovable: false,
    ...overrides,
  };
}

describe('buildGuidedResponse', () => {
  it('includes optionId, rank, label, penaltyScore', () => {
    const result = buildGuidedResponse(makeOption(), ['2026-03-10']);
    expect(result.optionId).toBe('opt-1');
    expect(result.rank).toBe(1);
    expect(result.label).toBe('Minimal change');
    expect(result.penaltyScore).toBe(5.2);
    expect(result.isAutoApprovable).toBe(false);
  });

  it('labels requested vs compensation diffs', () => {
    const result = buildGuidedResponse(makeOption(), ['2026-03-10']);
    expect(result.labeledDiffs).toHaveLength(2);
    expect(result.labeledDiffs[0].isRequested).toBe(true);
    expect(result.labeledDiffs[1].isCompensation).toBe(true);
  });

  it('produces a fairness explanation', () => {
    const result = buildGuidedResponse(makeOption(), ['2026-03-10']);
    expect(result.explanation).toBeDefined();
    expect(result.explanation.overallAssessment).toBeDefined();
    expect(result.explanation.compensationSummary).not.toBeNull();
  });

  it('uses default label when option label is null', () => {
    const result = buildGuidedResponse(makeOption({ label: null }), []);
    expect(result.label).toBe('Option 1');
  });
});

describe('buildGuidedBundle', () => {
  it('sorts options by rank', () => {
    const options = [
      makeOption({ id: 'opt-3', rank: 3 }),
      makeOption({ id: 'opt-1', rank: 1 }),
      makeOption({ id: 'opt-2', rank: 2 }),
    ];
    const result = buildGuidedBundle(options, []);
    expect(result.map((r) => r.optionId)).toEqual(['opt-1', 'opt-2', 'opt-3']);
  });

  it('handles empty options array', () => {
    expect(buildGuidedBundle([], [])).toEqual([]);
  });

  it('returns all guided responses for each option', () => {
    const options = [makeOption(), makeOption({ id: 'opt-2', rank: 2 })];
    const result = buildGuidedBundle(options, ['2026-03-10']);
    expect(result).toHaveLength(2);
    expect(result[0].explanation).toBeDefined();
    expect(result[1].explanation).toBeDefined();
  });
});
