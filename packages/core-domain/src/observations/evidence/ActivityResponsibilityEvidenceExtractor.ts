import { ObservationEvidenceExtractor } from './ObservationEvidenceExtractor';
import { BehaviorObservationWindow, ObservationEvidenceRecord } from '../types';

export interface ActivityRecord {
  activityId: string;
  familyId: string;
  date: string;
  childId: string;
  responsibleParentId: string;
  activityLabel: string;
}

/**
 * Extracts evidence about activity responsibility patterns.
 * Detects repeated parent-activity-child associations.
 */
export class ActivityResponsibilityEvidenceExtractor implements ObservationEvidenceExtractor {
  readonly evidenceType = 'ACTIVITY_RESPONSIBILITY';

  constructor(private readonly activities: ActivityRecord[]) {}

  extractEvidence(input: {
    window: BehaviorObservationWindow;
  }): ObservationEvidenceRecord[] {
    const { window } = input;

    const filtered = this.activities
      .filter(a =>
        a.familyId === window.familyId &&
        a.date >= window.startDate &&
        a.date <= window.endDate,
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.activityId.localeCompare(b.activityId));

    return filtered.map(activity => ({
      evidenceId: `activity-${activity.activityId}`,
      familyId: window.familyId,
      evidenceType: this.evidenceType,
      date: activity.date,
      childId: activity.childId,
      parentId: activity.responsibleParentId,
      relatedEntityType: 'ACTIVITY',
      relatedEntityId: activity.activityId,
      data: {
        activityLabel: activity.activityLabel,
        responsibleParentId: activity.responsibleParentId,
      },
      createdAt: activity.date + 'T00:00:00Z',
    }));
  }
}
