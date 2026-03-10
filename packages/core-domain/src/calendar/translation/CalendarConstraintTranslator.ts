import { DateTime } from 'luxon';
import {
  CalendarProjectionInput,
  CalendarConstraintRecord,
  ClassifiedCalendarEvent,
  CalendarTranslationResult,
  CalendarArtifact,
} from '../types';
import { CalendarAvailabilityBuilder } from './CalendarAvailabilityBuilder';

/**
 * Translates classified events into per-date constraint records.
 */
export class CalendarConstraintTranslator {
  private readonly availabilityBuilder: CalendarAvailabilityBuilder;

  constructor(availabilityBuilder?: CalendarAvailabilityBuilder) {
    this.availabilityBuilder = availabilityBuilder ?? new CalendarAvailabilityBuilder();
  }

  translate(input: CalendarProjectionInput): CalendarTranslationResult {
    const constraints: CalendarConstraintRecord[] = [];

    for (const event of input.events) {
      const records = this.eventToConstraintRecords(event, input.windowStart, input.windowEnd);
      constraints.push(...records);
    }

    // Sort deterministically
    constraints.sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      const sc = (a.startTime ?? '').localeCompare(b.startTime ?? '');
      if (sc !== 0) return sc;
      return a.eventId.localeCompare(b.eventId);
    });

    const availabilityView = this.availabilityBuilder.buildAvailabilityView({
      familyId: input.familyId,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      constraints,
      parentIds: input.parentIds,
      childIds: input.childIds,
    });

    const artifacts: CalendarArtifact[] = [{
      type: 'TRANSLATION_SUMMARY',
      data: {
        totalEvents: input.events.length,
        totalConstraints: constraints.length,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
      },
    }];

    return {
      familyId: input.familyId,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      constraints,
      availabilityView,
      artifacts,
    };
  }

  private eventToConstraintRecords(
    event: ClassifiedCalendarEvent,
    windowStart: string,
    windowEnd: string,
  ): CalendarConstraintRecord[] {
    const records: CalendarConstraintRecord[] = [];

    if (event.allDay) {
      // Split multi-day all-day events into per-date records
      const dates = this.expandDateRange(event.startTime, event.endTime, windowStart, windowEnd);
      for (const date of dates) {
        records.push(this.buildRecord(event, date));
      }
    } else {
      // Timed event: assign to start date, or split if spans midnight
      const startDate = event.startTime.slice(0, 10);
      const endDate = event.endTime.slice(0, 10);

      if (startDate === endDate) {
        if (startDate >= windowStart && startDate <= windowEnd) {
          records.push(this.buildRecord(event, startDate, event.startTime, event.endTime));
        }
      } else {
        // Multi-day timed event: create record for each date
        const dates = this.expandDateRange(startDate, endDate, windowStart, windowEnd);
        for (const date of dates) {
          records.push(this.buildRecord(event, date, event.startTime, event.endTime));
        }
      }
    }

    return records;
  }

  private buildRecord(
    event: ClassifiedCalendarEvent,
    date: string,
    startTime?: string,
    endTime?: string,
  ): CalendarConstraintRecord {
    return {
      eventId: event.externalId,
      familyId: event.familyId,
      scopeType: event.scopeType,
      parentId: event.parentId,
      childId: event.childId,
      date,
      startTime,
      endTime,
      constraintLevel: event.constraintLevel,
      kind: event.kind,
      title: event.title,
      source: event.source,
      metadata: event.metadata,
    };
  }

  private expandDateRange(
    startDate: string,
    endDate: string,
    windowStart: string,
    windowEnd: string,
  ): string[] {
    const dates: string[] = [];
    let current = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);
    const winStart = DateTime.fromISO(windowStart);
    const winEnd = DateTime.fromISO(windowEnd);

    while (current <= end) {
      const iso = current.toISODate()!;
      if (current >= winStart && current <= winEnd) {
        dates.push(iso);
      }
      current = current.plus({ days: 1 });
    }

    return dates;
  }
}
