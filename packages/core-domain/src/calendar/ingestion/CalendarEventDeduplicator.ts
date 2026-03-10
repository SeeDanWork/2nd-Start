import {
  NormalizedCalendarEvent,
  ClassifiedCalendarEvent,
} from '../types';

export interface DeduplicationResult {
  action: 'INSERT' | 'UPDATE' | 'SKIP';
  matchedEventId?: string;
}

/**
 * Detects repeated imports of the same external event.
 */
export class CalendarEventDeduplicator {
  dedupe(input: {
    source: string;
    externalId?: string;
    familyId: string;
    normalizedEvent: NormalizedCalendarEvent;
    existingEvents: ClassifiedCalendarEvent[];
  }): DeduplicationResult {
    const { source, externalId, familyId, normalizedEvent, existingEvents } = input;

    // 1. Prefer exact (source, externalId) match
    if (externalId) {
      const match = existingEvents.find(
        e => e.source === source && e.externalId === externalId && e.familyId === familyId,
      );
      if (match) {
        // Check if content has changed
        if (this.contentChanged(normalizedEvent, match)) {
          return { action: 'UPDATE', matchedEventId: match.externalId };
        }
        return { action: 'SKIP', matchedEventId: match.externalId };
      }
    }

    // 2. Fallback: match by source + title + startTime + familyId
    const fallbackMatch = existingEvents.find(
      e => e.source === source &&
           e.title === normalizedEvent.title &&
           e.startTime === normalizedEvent.startTime &&
           e.familyId === familyId,
    );
    if (fallbackMatch) {
      if (this.contentChanged(normalizedEvent, fallbackMatch)) {
        return { action: 'UPDATE', matchedEventId: fallbackMatch.externalId };
      }
      return { action: 'SKIP', matchedEventId: fallbackMatch.externalId };
    }

    return { action: 'INSERT' };
  }

  private contentChanged(
    normalized: NormalizedCalendarEvent,
    existing: ClassifiedCalendarEvent,
  ): boolean {
    return (
      normalized.title !== existing.title ||
      normalized.startTime !== existing.startTime ||
      normalized.endTime !== existing.endTime ||
      normalized.description !== existing.description ||
      normalized.allDay !== existing.allDay
    );
  }
}
