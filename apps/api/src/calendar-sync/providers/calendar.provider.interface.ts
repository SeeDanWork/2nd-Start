import { CalendarConnection, CalendarEvent } from '../../entities';

export const CALENDAR_PROVIDER = Symbol('CALENDAR_PROVIDER');

export interface CalendarProviderInterface {
  createEvent(connection: CalendarConnection, event: CalendarEvent): Promise<string>;
  updateEvent(connection: CalendarConnection, externalEventId: string, event: CalendarEvent): Promise<void>;
  deleteEvent(connection: CalendarConnection, externalEventId: string): Promise<void>;
  testConnection(connection: CalendarConnection): Promise<boolean>;
}
