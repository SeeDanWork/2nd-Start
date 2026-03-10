import { ScenarioFixture } from '../../types';

export const fixture: ScenarioFixture = {
  scenarioId: 'calendar_school_event_hard_constraint',
  label: 'Calendar school event as HARD constraint',
  description: 'Ingest school event, classify as HARD, build explanation.',
  tags: ['calendar', 'classification', 'explanation'],
  seed: {
    family: { name: 'CalendarFamily' },
    parents: [
      { name: 'Alice', role: 'MOTHER' },
      { name: 'Bob', role: 'FATHER' },
    ],
    children: [
      { name: 'Charlie', birthDate: '2019-04-20' },
    ],
  },
  steps: [
    {
      type: 'INGEST_CALENDAR',
      stepId: 'ingest-school',
      events: [
        {
          source: 'google',
          title: "Charlie's school day — parent-teacher conference",
          startTime: '2026-03-12',
          endTime: '2026-03-12',
          allDay: true,
        },
      ],
    },
    {
      type: 'BUILD_EXPLANATION',
      stepId: 'explain-classification',
      targetType: 'CALENDAR_EVENT_CLASSIFICATION',
      targetSelector: { strategy: 'LATEST' },
    },
  ],
  expectations: [
    {
      type: 'CALENDAR_CLASSIFICATION',
      expected: [
        { title: 'school day', constraintLevel: 'HARD', kind: 'SCHOOL' },
      ],
    },
    {
      type: 'EXPLANATION',
      targetType: 'CALENDAR_EVENT_CLASSIFICATION',
      minimumRecordCount: 1,
      requiredCodes: ['CALENDAR_HARD_SCHOOL_EVENT'],
    },
  ],
};
