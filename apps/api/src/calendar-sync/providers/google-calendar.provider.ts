import { Injectable, Logger } from '@nestjs/common';
import { CalendarProviderInterface } from './calendar.provider.interface';
import { CalendarConnection, CalendarEvent } from '../../entities';

@Injectable()
export class GoogleCalendarProvider implements CalendarProviderInterface {
  private readonly logger = new Logger(GoogleCalendarProvider.name);

  async createEvent(_connection: CalendarConnection, _event: CalendarEvent): Promise<string> {
    this.logger.warn('Google Calendar not configured');
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  }

  async updateEvent(
    _connection: CalendarConnection,
    _externalEventId: string,
    _event: CalendarEvent,
  ): Promise<void> {
    this.logger.warn('Google Calendar not configured');
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  }

  async deleteEvent(_connection: CalendarConnection, _externalEventId: string): Promise<void> {
    this.logger.warn('Google Calendar not configured');
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  }

  async testConnection(_connection: CalendarConnection): Promise<boolean> {
    this.logger.warn('Google Calendar not configured');
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  }
}
