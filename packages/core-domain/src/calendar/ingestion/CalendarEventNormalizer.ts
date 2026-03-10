import {
  ExternalCalendarEvent,
  NormalizedCalendarEvent,
  CalendarEventScopeType,
  CalendarEventKind,
} from '../types';
import { CalendarNormalizationError } from '../errors';

/**
 * Normalizes external calendar events into canonical internal form.
 */
export class CalendarEventNormalizer {
  normalize(input: {
    familyId: string;
    externalEvent: ExternalCalendarEvent;
    resolvedScope: {
      scopeType: CalendarEventScopeType;
      parentId?: string;
      childId?: string;
    };
    inferredKind: CalendarEventKind;
  }): NormalizedCalendarEvent {
    const { familyId, externalEvent, resolvedScope, inferredKind } = input;

    if (!externalEvent.externalId) {
      throw new CalendarNormalizationError('externalId is required');
    }
    if (!externalEvent.source) {
      throw new CalendarNormalizationError('source is required');
    }
    if (!externalEvent.startTime) {
      throw new CalendarNormalizationError('startTime is required');
    }
    if (!externalEvent.endTime) {
      throw new CalendarNormalizationError('endTime is required');
    }

    return {
      externalId: externalEvent.externalId,
      source: externalEvent.source.trim(),
      title: (externalEvent.title ?? '').trim(),
      description: externalEvent.description?.trim(),
      startTime: externalEvent.startTime,
      endTime: externalEvent.endTime,
      timezone: externalEvent.timezone ?? 'UTC',
      allDay: externalEvent.allDay ?? false,
      scopeType: resolvedScope.scopeType,
      parentId: resolvedScope.parentId,
      childId: resolvedScope.childId,
      familyId,
      kind: inferredKind,
      metadata: externalEvent.metadata,
    };
  }
}
