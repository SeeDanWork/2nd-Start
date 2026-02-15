import { Injectable } from '@nestjs/common';
import { ConstraintType, ConstraintHardness, ConstraintOwner } from '@adcp/shared';

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  constraints: Array<{
    type: string;
    hardness: string;
    weight: number;
    owner: string;
    parameters: Record<string, unknown>;
  }>;
}

@Injectable()
export class OnboardingService {
  getTemplates(): OnboardingTemplate[] {
    return [
      {
        id: 'daycare_week_split',
        name: 'Daycare week split',
        description: 'Mon/Tue with one parent, Wed/Thu flexible, alternating weekends. Daycare exchanges on weekdays.',
        constraints: [
          {
            type: ConstraintType.LOCKED_NIGHT,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.PARENT_A,
            parameters: { parent: 'parent_a', daysOfWeek: [1, 2] },
          },
          {
            type: ConstraintType.MAX_CONSECUTIVE,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.SHARED,
            parameters: { parent: 'parent_a', maxNights: 5 },
          },
          {
            type: ConstraintType.MAX_CONSECUTIVE,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.SHARED,
            parameters: { parent: 'parent_b', maxNights: 5 },
          },
          {
            type: ConstraintType.WEEKEND_SPLIT,
            hardness: ConstraintHardness.SOFT,
            weight: 80,
            owner: ConstraintOwner.SHARED,
            parameters: { targetPctParentA: 50, tolerancePct: 10 },
          },
          {
            type: ConstraintType.DAYCARE_EXCHANGE_ONLY,
            hardness: ConstraintHardness.SOFT,
            weight: 60,
            owner: ConstraintOwner.SHARED,
            parameters: { preferDaycare: true },
          },
        ],
      },
      {
        id: 'alternating_weeks',
        name: 'Alternating weeks',
        description: '7-on/7-off pattern. Monday daycare exchange. Simple and predictable.',
        constraints: [
          {
            type: ConstraintType.MAX_CONSECUTIVE,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.SHARED,
            parameters: { parent: 'parent_a', maxNights: 7 },
          },
          {
            type: ConstraintType.MAX_CONSECUTIVE,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.SHARED,
            parameters: { parent: 'parent_b', maxNights: 7 },
          },
          {
            type: ConstraintType.MAX_TRANSITIONS_PER_WEEK,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.SHARED,
            parameters: { maxTransitions: 1 },
          },
        ],
      },
      {
        id: '2_2_3_rotation',
        name: '2-2-3 rotation',
        description: '2 days each parent, then alternating 3-day weekends. Balanced with frequent contact.',
        constraints: [
          {
            type: ConstraintType.MAX_CONSECUTIVE,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.SHARED,
            parameters: { parent: 'parent_a', maxNights: 3 },
          },
          {
            type: ConstraintType.MAX_CONSECUTIVE,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.SHARED,
            parameters: { parent: 'parent_b', maxNights: 3 },
          },
          {
            type: ConstraintType.WEEKEND_SPLIT,
            hardness: ConstraintHardness.SOFT,
            weight: 80,
            owner: ConstraintOwner.SHARED,
            parameters: { targetPctParentA: 50, tolerancePct: 10 },
          },
        ],
      },
      {
        id: '5_2_weekday_weekend',
        name: '5-2 weekday/weekend split',
        description: 'One parent has weekdays, other has weekends. Clear routine for school-age children.',
        constraints: [
          {
            type: ConstraintType.LOCKED_NIGHT,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.PARENT_A,
            parameters: { parent: 'parent_a', daysOfWeek: [0, 1, 2, 3, 4] },
          },
          {
            type: ConstraintType.LOCKED_NIGHT,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.PARENT_B,
            parameters: { parent: 'parent_b', daysOfWeek: [5, 6] },
          },
          {
            type: ConstraintType.MAX_TRANSITIONS_PER_WEEK,
            hardness: ConstraintHardness.HARD,
            weight: 100,
            owner: ConstraintOwner.SHARED,
            parameters: { maxTransitions: 2 },
          },
        ],
      },
    ];
  }

  getTemplate(templateId: string): OnboardingTemplate | undefined {
    return this.getTemplates().find((t) => t.id === templateId);
  }
}
