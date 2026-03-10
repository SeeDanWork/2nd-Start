import { describe, it, expect } from 'vitest';
import { CalendarExplanationBuilder } from '../builders/CalendarExplanationBuilder';
import { TARGET_ID, CREATED_AT, makeNormalizedArtifact } from './helpers';

describe('CalendarExplanationBuilder', () => {
  const builder = new CalendarExplanationBuilder();

  it('explains hard school classification', () => {
    const records = builder.buildCalendarExplanations({
      targetType: 'CALENDAR_EVENT_CLASSIFICATION',
      targetId: TARGET_ID,
      calendarArtifacts: [
        makeNormalizedArtifact({
          type: 'CALENDAR_CLASSIFICATION',
          data: { kind: 'SCHOOL', constraintLevel: 'HARD', classificationReason: 'Child school event', date: '2026-03-10' },
          source: { sourceType: 'CALENDAR', artifactType: 'CALENDAR_CLASSIFICATION' },
        }),
      ],
      createdAt: CREATED_AT,
    });

    expect(records).toHaveLength(1);
    expect(records[0].code).toBe('CALENDAR_HARD_SCHOOL_EVENT');
    expect(records[0].importance).toBe('PRIMARY');
    expect(records[0].messageTemplate).toContain('hard constraint');
  });

  it('explains strong activity classification', () => {
    const records = builder.buildCalendarExplanations({
      targetType: 'CALENDAR_EVENT_CLASSIFICATION',
      targetId: TARGET_ID,
      calendarArtifacts: [
        makeNormalizedArtifact({
          type: 'CALENDAR_CLASSIFICATION',
          data: { kind: 'ACTIVITY', constraintLevel: 'STRONG', date: '2026-03-11' },
          source: { sourceType: 'CALENDAR', artifactType: 'CALENDAR_CLASSIFICATION' },
        }),
      ],
      createdAt: CREATED_AT,
    });

    expect(records).toHaveLength(1);
    expect(records[0].code).toBe('CALENDAR_STRONG_ACTIVITY_EVENT');
    expect(records[0].importance).toBe('SECONDARY');
  });

  it('preserves explicit classification reason', () => {
    const records = builder.buildCalendarExplanations({
      targetType: 'CALENDAR_EVENT_CLASSIFICATION',
      targetId: TARGET_ID,
      calendarArtifacts: [
        makeNormalizedArtifact({
          type: 'CALENDAR_CLASSIFICATION',
          data: {
            kind: 'MEDICAL',
            constraintLevel: 'HARD',
            classificationReason: 'Child medical appointment requires custody presence',
            date: '2026-03-12',
          },
          source: { sourceType: 'CALENDAR', artifactType: 'CALENDAR_CLASSIFICATION' },
        }),
      ],
      createdAt: CREATED_AT,
    });

    expect(records[0].data['classificationReason']).toBe('Child medical appointment requires custody presence');
  });

  it('returns empty for no calendar artifacts', () => {
    const records = builder.buildCalendarExplanations({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      createdAt: CREATED_AT,
    });

    expect(records).toHaveLength(0);
  });
});
