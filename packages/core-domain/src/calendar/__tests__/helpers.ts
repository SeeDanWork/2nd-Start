import {
  ExternalCalendarEvent,
  CalendarFamilyContext,
  NormalizedCalendarEvent,
  ClassifiedCalendarEvent,
  CalendarConstraintLevel,
  CalendarEventKind,
  CalendarEventScopeType,
} from '../types';

export const FAMILY_ID = 'family-1';
export const PARENT_A_ID = 'parent-a';
export const PARENT_B_ID = 'parent-b';
export const CHILD_1_ID = 'child-1';
export const CHILD_2_ID = 'child-2';

export function makeFamilyContext(overrides?: Partial<CalendarFamilyContext>): CalendarFamilyContext {
  return {
    familyId: FAMILY_ID,
    parents: [
      { id: PARENT_A_ID, name: 'Alice' },
      { id: PARENT_B_ID, name: 'Bob' },
    ],
    children: [
      { id: CHILD_1_ID, name: 'Charlie' },
      { id: CHILD_2_ID, name: 'Dana' },
    ],
    timezone: 'America/New_York',
    ...overrides,
  };
}

export function makeExternalEvent(overrides?: Partial<ExternalCalendarEvent>): ExternalCalendarEvent {
  return {
    externalId: 'ext-1',
    source: 'google',
    title: 'Team Meeting',
    startTime: '2026-03-10T09:00:00',
    endTime: '2026-03-10T17:00:00',
    ...overrides,
  };
}

export function makeNormalizedEvent(overrides?: Partial<NormalizedCalendarEvent>): NormalizedCalendarEvent {
  return {
    externalId: 'ext-1',
    source: 'google',
    title: 'Team Meeting',
    startTime: '2026-03-10T09:00:00',
    endTime: '2026-03-10T17:00:00',
    timezone: 'UTC',
    allDay: false,
    scopeType: 'PARENT',
    parentId: PARENT_A_ID,
    familyId: FAMILY_ID,
    kind: 'WORK',
    ...overrides,
  };
}

export function makeClassifiedEvent(overrides?: Partial<ClassifiedCalendarEvent>): ClassifiedCalendarEvent {
  return {
    ...makeNormalizedEvent(),
    constraintLevel: 'STRONG' as CalendarConstraintLevel,
    classificationReason: 'Parent work commitment',
    confidence: 0.80,
    ...overrides,
  };
}
