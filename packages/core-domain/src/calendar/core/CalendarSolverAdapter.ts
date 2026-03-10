import {
  CalendarTranslationResult,
  CalendarArtifact,
  CalendarConstraintRecord,
} from '../types';
import {
  AvailabilityConstraintProvider,
  UnavailableAssignment,
  PlanningWindow,
} from '../../solver/types';

/**
 * Adapts calendar translation output into solver-compatible inputs.
 */
export class CalendarSolverAdapter {
  /**
   * Convert HARD parent constraints into explicit unavailable assignments.
   * Only converts when scope is PARENT and constraint is HARD.
   */
  toAvailabilityConstraintProvider(
    input: CalendarTranslationResult,
  ): AvailabilityConstraintProvider {
    const hardParentConstraints = input.constraints.filter(
      c => c.constraintLevel === 'HARD' && c.scopeType === 'PARENT' && c.parentId,
    );

    return {
      getUnavailableAssignments(
        familyId: string,
        parentIds: string[],
        childIds: string[],
        window: PlanningWindow,
      ): UnavailableAssignment[] {
        const assignments: UnavailableAssignment[] = [];

        for (const constraint of hardParentConstraints) {
          if (!constraint.parentId) continue;
          if (!parentIds.includes(constraint.parentId)) continue;
          if (constraint.date < window.startDate || constraint.date > window.endDate) continue;

          // Parent is unavailable for all children on this date
          for (const childId of childIds) {
            assignments.push({
              date: constraint.date,
              childId,
              parentId: constraint.parentId,
            });
          }
        }

        // Sort deterministically
        return assignments.sort((a, b) => {
          const dc = a.date.localeCompare(b.date);
          if (dc !== 0) return dc;
          const cc = a.childId.localeCompare(b.childId);
          if (cc !== 0) return cc;
          return a.parentId.localeCompare(b.parentId);
        });
      },
    };
  }

  /**
   * Build context artifacts from calendar translation for solver audit.
   */
  toCalendarContextArtifacts(input: CalendarTranslationResult): CalendarArtifact[] {
    const artifacts: CalendarArtifact[] = [];

    const hardCount = input.constraints.filter(c => c.constraintLevel === 'HARD').length;
    const strongCount = input.constraints.filter(c => c.constraintLevel === 'STRONG').length;
    const softCount = input.constraints.filter(c => c.constraintLevel === 'SOFT').length;

    artifacts.push({
      type: 'CALENDAR_CONSTRAINT_SUMMARY',
      data: {
        familyId: input.familyId,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        totalConstraints: input.constraints.length,
        hardCount,
        strongCount,
        softCount,
      },
    });

    // Child commitment signals (STRONG child constraints)
    const childCommitments = input.constraints.filter(
      c => c.constraintLevel === 'STRONG' && c.scopeType === 'CHILD' && c.childId,
    );
    if (childCommitments.length > 0) {
      artifacts.push({
        type: 'CHILD_COMMITMENT_SIGNALS',
        data: {
          commitments: childCommitments.map(c => ({
            childId: c.childId,
            date: c.date,
            kind: c.kind,
            title: c.title,
          })),
        },
      });
    }

    return artifacts;
  }
}
