import { CalendarEventRecord } from '../types';

/**
 * Repository interface for calendar event persistence.
 */
export interface ICalendarEventRepository {
  create(record: CalendarEventRecord): Promise<CalendarEventRecord>;
  update(id: string, record: Partial<CalendarEventRecord>): Promise<void>;
  findById(id: string): Promise<CalendarEventRecord | null>;
  findByFamilyAndWindow(
    familyId: string,
    windowStart: string,
    windowEnd: string,
  ): Promise<CalendarEventRecord[]>;
  findBySourceAndExternalId(
    source: string,
    externalId: string,
  ): Promise<CalendarEventRecord | null>;
}
