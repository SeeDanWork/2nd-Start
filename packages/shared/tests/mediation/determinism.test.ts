import { describe, it, expect } from 'vitest';
import { computeFeedbackDelta, applyFeedbackToWeights, emptyWeightDelta } from '../../src/mediation/feedback-weights';
import { labelCalendarDiffs } from '../../src/mediation/compensation';
import { explainProposal } from '../../src/mediation/explain';
import { runPreConflictChecks } from '../../src/mediation/preconflict';
import { buildGuidedResponse } from '../../src/mediation/guided-response';
import { FeedbackCategory } from '../../src/mediation/types';
import { ParentRole } from '../../src/enums';
import { DEFAULT_SOLVER_WEIGHTS } from '../../src/constants';
import type { ProposalOption, CalendarDiffEntry } from '../../src/types';
import type { StructuredFeedback } from '../../src/mediation/types';

/**
 * Determinism tests: same input → same output, every time.
 */
describe('determinism', () => {
  const feedbacks: StructuredFeedback[] = [
    { category: FeedbackCategory.FAIRNESS, severity: 3 },
    { category: FeedbackCategory.TRANSITIONS, severity: 2 },
    { category: FeedbackCategory.ROUTINE, severity: 1 },
  ];

  it('computeFeedbackDelta is deterministic', () => {
    const a = computeFeedbackDelta(feedbacks);
    const b = computeFeedbackDelta(feedbacks);
    expect(a).toEqual(b);
  });

  it('applyFeedbackToWeights is deterministic', () => {
    const delta = computeFeedbackDelta(feedbacks);
    const a = applyFeedbackToWeights({ ...DEFAULT_SOLVER_WEIGHTS }, delta);
    const b = applyFeedbackToWeights({ ...DEFAULT_SOLVER_WEIGHTS }, delta);
    expect(a).toEqual(b);
  });

  it('labelCalendarDiffs is deterministic', () => {
    const diffs: CalendarDiffEntry[] = [
      { date: '2026-03-10', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
      { date: '2026-03-14', oldParent: ParentRole.PARENT_B, newParent: ParentRole.PARENT_A },
    ];
    const dates = ['2026-03-10'];
    const a = labelCalendarDiffs(diffs, dates);
    const b = labelCalendarDiffs(diffs, dates);
    expect(a).toEqual(b);
  });

  it('runPreConflictChecks is deterministic', () => {
    const params = {
      familyId: 'fam-1',
      referenceDate: '2026-03-05',
      parentANights: 34,
      parentBNights: 28,
      windowWeeks: 8,
      maxOvernightDelta: 8,
      maxConsecutiveCurrent: 4,
      maxConsecutiveAllowed: 5,
      budgetUsed: 3,
      budgetLimit: 4,
    };
    const a = runPreConflictChecks(params);
    const b = runPreConflictChecks(params);
    expect(a).toEqual(b);
  });

  it('buildGuidedResponse is deterministic', () => {
    const option: ProposalOption = {
      id: 'opt-1',
      bundleId: 'bundle-1',
      rank: 1,
      label: 'Minimal change',
      calendarDiff: [
        { date: '2026-03-10', oldParent: ParentRole.PARENT_A, newParent: ParentRole.PARENT_B },
      ],
      fairnessImpact: { overnightDelta: 1, weekendDelta: 0, windowWeeks: 8 },
      stabilityImpact: { transitionsDelta: 1, maxStreakChange: 0, schoolNightChanges: 0 },
      handoffImpact: { newHandoffs: 1, removedHandoffs: 0, nonDaycareHandoffs: 0 },
      penaltyScore: 5.0,
      isAutoApprovable: false,
    };
    const a = buildGuidedResponse(option, ['2026-03-10']);
    const b = buildGuidedResponse(option, ['2026-03-10']);
    expect(a).toEqual(b);
  });
});
