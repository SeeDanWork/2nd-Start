import {
  ExplanationRecord,
  ExplanationTargetType,
  NormalizedArtifact,
} from '../types';

function makeRecordId(targetId: string, code: string, index: number): string {
  return `${targetId}:${code}:${index}`;
}

const CONSTRAINT_LEVEL_TO_CODE: Record<string, string> = {
  HARD: 'CALENDAR_HARD_CONSTRAINT',
  STRONG: 'CALENDAR_STRONG_CONSTRAINT',
  SOFT: 'CALENDAR_SOFT_CONSTRAINT',
};

const KIND_TO_CODE: Record<string, string> = {
  SCHOOL: 'CALENDAR_HARD_SCHOOL_EVENT',
  DAYCARE: 'CALENDAR_HARD_DAYCARE_EVENT',
  MEDICAL: 'CALENDAR_HARD_MEDICAL_EVENT',
  CLOSURE: 'CALENDAR_HARD_CLOSURE_EVENT',
  ACTIVITY: 'CALENDAR_STRONG_ACTIVITY_EVENT',
  WORK: 'CALENDAR_STRONG_WORK_EVENT',
  TRAVEL: 'CALENDAR_STRONG_TRAVEL_EVENT',
  HOLIDAY: 'CALENDAR_SOFT_HOLIDAY_EVENT',
  INFORMATIONAL: 'CALENDAR_SOFT_INFORMATIONAL_EVENT',
  OTHER: 'CALENDAR_SOFT_OTHER_EVENT',
};

const KIND_TO_TEMPLATE: Record<string, string> = {
  SCHOOL: 'School event on {date} was treated as a hard constraint.',
  DAYCARE: 'Daycare event on {date} was treated as a hard constraint.',
  MEDICAL: 'Medical appointment on {date} was treated as a hard constraint.',
  CLOSURE: 'Closure on {date} was treated as a hard constraint.',
  ACTIVITY: 'Activity on {date} was treated as a strong constraint.',
  WORK: 'Work commitment on {date} was treated as a strong constraint.',
  TRAVEL: 'Travel on {date} was treated as a strong constraint.',
  HOLIDAY: 'Holiday on {date} was treated as a soft constraint.',
  INFORMATIONAL: 'Informational event on {date} was noted.',
  OTHER: 'Calendar event on {date} was noted.',
};

/**
 * Builds explanation records for calendar classification and constraint decisions.
 */
export class CalendarExplanationBuilder {
  buildCalendarExplanations(input: {
    targetType: ExplanationTargetType;
    targetId: string;
    calendarArtifacts?: NormalizedArtifact[];
    createdAt: string;
  }): ExplanationRecord[] {
    const records: ExplanationRecord[] = [];
    const { targetType, targetId, calendarArtifacts, createdAt } = input;

    if (!calendarArtifacts || calendarArtifacts.length === 0) {
      return records;
    }

    let classIdx = 0;
    let constraintIdx = 0;

    for (const artifact of calendarArtifacts) {
      if (artifact.type === 'CALENDAR_CLASSIFICATION') {
        const kind = artifact.data['kind'] as string | undefined;
        const level = artifact.data['constraintLevel'] as string | undefined;
        const reason = artifact.data['classificationReason'] as string | undefined;
        const date = artifact.data['date'] as string | undefined;

        const code = (kind && KIND_TO_CODE[kind]) ?? CONSTRAINT_LEVEL_TO_CODE[level ?? ''] ?? 'CALENDAR_CLASSIFICATION';
        const template = (kind && KIND_TO_TEMPLATE[kind]) ?? 'Calendar event was classified as {constraintLevel}.';
        const importance = level === 'HARD' ? 'PRIMARY' as const
          : level === 'STRONG' ? 'SECONDARY' as const
          : 'SUPPORTING' as const;

        records.push({
          recordId: makeRecordId(targetId, code, classIdx),
          targetType,
          targetId,
          category: 'CALENDAR',
          importance,
          code,
          messageTemplate: template,
          data: {
            kind,
            constraintLevel: level,
            classificationReason: reason,
            ...artifact.data,
          },
          date,
          childId: artifact.data['childId'] as string | undefined,
          sourceArtifacts: [artifact.source],
          createdAt,
        });
        classIdx++;
      }

      if (artifact.type === 'CALENDAR_CONSTRAINT_SUMMARY') {
        records.push({
          recordId: makeRecordId(targetId, 'CALENDAR_CONSTRAINT_SUMMARY', constraintIdx),
          targetType,
          targetId,
          category: 'CALENDAR',
          importance: 'SUPPORTING',
          code: 'CALENDAR_CONSTRAINT_SUMMARY',
          messageTemplate: 'Calendar constraints were applied to the scheduling window.',
          data: artifact.data,
          sourceArtifacts: [artifact.source],
          createdAt,
        });
        constraintIdx++;
      }
    }

    return records;
  }
}
