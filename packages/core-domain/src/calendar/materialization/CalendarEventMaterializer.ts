import {
  ClassifiedCalendarEvent,
  CalendarEventRecord,
} from '../types';

/**
 * Materializes classified events into persistence records.
 */
export function materializeToRecord(
  event: ClassifiedCalendarEvent,
  id: string,
): CalendarEventRecord {
  return {
    id,
    familyId: event.familyId,
    parentId: event.parentId ?? null,
    childId: event.childId ?? null,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    constraintLevel: event.constraintLevel,
    source: event.source,
    externalId: event.externalId,
    description: event.description ?? null,
    scopeType: event.scopeType,
    kind: event.kind,
    classificationReason: event.classificationReason,
    classificationConfidence: event.confidence,
    metadata: event.metadata ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
}

/**
 * Materializes a batch of events with deterministic ID generation.
 */
export function materializeBatch(
  events: ClassifiedCalendarEvent[],
  idPrefix: string = 'cal',
): CalendarEventRecord[] {
  return events
    .sort((a, b) => {
      const sc = a.startTime.localeCompare(b.startTime);
      if (sc !== 0) return sc;
      return a.externalId.localeCompare(b.externalId);
    })
    .map((event, i) => materializeToRecord(event, `${idPrefix}-${i}`));
}
