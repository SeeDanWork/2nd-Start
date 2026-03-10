import { describe, it, expect } from 'vitest';
import {
  describeFairnessDelta,
  describeTransitionImpact,
  describeRoutineImpact,
  describeCompensation,
  assessOverall,
  explainProposal,
} from '../../src/mediation/explain';
import { ParentRole } from '../../src/enums';
import type { LabeledCalendarDiff } from '../../src/mediation/types';
import type { HandoffImpact } from '../../src/types';

describe('describeFairnessDelta', () => {
  it('returns no-change text when both deltas are 0', () => {
    expect(describeFairnessDelta(0, 0, 8)).toBe('No change to overnight or weekend balance.');
  });

  it('describes positive overnight delta', () => {
    const result = describeFairnessDelta(2, 0, 8);
    expect(result).toContain('Parent A +2 nights');
    expect(result).toContain('8-week window');
  });

  it('describes negative overnight delta', () => {
    const result = describeFairnessDelta(-1, 0, 4);
    expect(result).toContain('Parent B');
    expect(result).toContain('-1 night');
  });

  it('describes weekend delta', () => {
    const result = describeFairnessDelta(0, 1, 8);
    expect(result).toContain('weekend balance +1');
  });

  it('describes both overnight and weekend delta', () => {
    const result = describeFairnessDelta(1, -1, 8);
    expect(result).toContain('Parent A +1 night');
    expect(result).toContain('weekend balance -1');
  });
});

describe('describeTransitionImpact', () => {
  it('returns no-transitions text when all are 0', () => {
    expect(describeTransitionImpact(0, 0, 0)).toBe('No additional transitions.');
  });

  it('describes added transitions', () => {
    const result = describeTransitionImpact(2, 0, 0);
    expect(result).toContain('Adds 2 transitions');
  });

  it('describes removed transitions', () => {
    const result = describeTransitionImpact(-1, 0, 0);
    expect(result).toContain('Removes 1 transition');
  });

  it('describes streak change and school nights', () => {
    const result = describeTransitionImpact(1, 2, 3);
    expect(result).toContain('Adds 1 transition');
    expect(result).toContain('longest streak increases by 2');
    expect(result).toContain('3 school nights affected');
  });
});

describe('describeRoutineImpact', () => {
  const noImpact: HandoffImpact = { newHandoffs: 0, removedHandoffs: 0, nonDaycareHandoffs: 0 };

  it('describes no school night changes', () => {
    const result = describeRoutineImpact(noImpact, 0);
    expect(result).toContain('No school night changes');
  });

  it('describes school nights affected', () => {
    const result = describeRoutineImpact(noImpact, 2);
    expect(result).toContain('2 school nights affected');
  });

  it('describes new handoffs', () => {
    const result = describeRoutineImpact({ newHandoffs: 2, removedHandoffs: 0, nonDaycareHandoffs: 1 }, 0);
    expect(result).toContain('2 new handoffs');
    expect(result).toContain('1 non-daycare handoff');
  });
});

describe('describeCompensation', () => {
  it('returns null when no compensation diffs', () => {
    const diffs: LabeledCalendarDiff[] = [
      { date: '2026-03-10', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B, isRequested: true, isCompensation: false },
    ];
    expect(describeCompensation(diffs)).toBeNull();
  });

  it('describes single compensation date', () => {
    const diffs: LabeledCalendarDiff[] = [
      { date: '2026-03-14', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B, isRequested: false, isCompensation: true },
    ];
    const result = describeCompensation(diffs);
    expect(result).toContain('Parent B');
    expect(result).toContain('2026-03-14');
  });

  it('describes contiguous compensation range', () => {
    const diffs: LabeledCalendarDiff[] = [
      { date: '2026-03-14', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B, isRequested: false, isCompensation: true },
      { date: '2026-03-15', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B, isRequested: false, isCompensation: true },
    ];
    const result = describeCompensation(diffs);
    expect(result).toContain('2026-03-14 to 2026-03-15');
  });
});

describe('assessOverall', () => {
  it('returns favorable when no impact', () => {
    expect(assessOverall(0, 0)).toBe('favorable');
  });

  it('returns neutral for moderate impact', () => {
    expect(assessOverall(1, 1)).toBe('neutral');
  });

  it('returns unfavorable for large impact', () => {
    expect(assessOverall(2, 2)).toBe('unfavorable');
  });

  it('returns neutral when overnight delta is 1 and no transitions', () => {
    expect(assessOverall(1, 0)).toBe('neutral');
  });
});

describe('explainProposal', () => {
  it('produces a complete explanation object', () => {
    const result = explainProposal(
      { overnightDelta: 1, weekendDelta: 0, windowWeeks: 8 },
      { transitionsDelta: 0, maxStreakChange: 0, schoolNightChanges: 0 },
      { newHandoffs: 0, removedHandoffs: 0, nonDaycareHandoffs: 0 },
      [],
    );
    expect(result).toHaveProperty('fairnessDeltaText');
    expect(result).toHaveProperty('transitionImpactText');
    expect(result).toHaveProperty('routineImpactText');
    expect(result).toHaveProperty('compensationSummary');
    expect(result).toHaveProperty('overallAssessment');
    expect(result.compensationSummary).toBeNull();
  });
});
