import { Injectable, Logger } from '@nestjs/common';
import { CalendarProviderInterface } from './calendar.provider.interface';
import { CalendarConnection, CalendarEvent } from '../../entities';

@Injectable()
export class ConsoleCalendarProvider implements CalendarProviderInterface {
  private readonly logger = new Logger(ConsoleCalendarProvider.name);

  async createEvent(connection: CalendarConnection, event: CalendarEvent): Promise<string> {
    const externalId = `console-evt-${Date.now()}`;
    this.logger.log(
      `[CREATE] Event "${event.title}" (${event.eventType}) for connection ${connection.id} -> ${externalId}`,
    );
    this.logger.log(`  Start: ${event.startTime} | End: ${event.endTime}`);
    return externalId;
  }

  async updateEvent(
    connection: CalendarConnection,
    externalEventId: string,
    event: CalendarEvent,
  ): Promise<void> {
    this.logger.log(
      `[UPDATE] Event ${externalEventId} "${event.title}" for connection ${connection.id}`,
    );
  }

  async deleteEvent(connection: CalendarConnection, externalEventId: string): Promise<void> {
    this.logger.log(`[DELETE] Event ${externalEventId} for connection ${connection.id}`);
  }

  async testConnection(connection: CalendarConnection): Promise<boolean> {
    this.logger.log(`[TEST] Connection ${connection.id} (${connection.provider}) — OK`);
    return true;
  }
}
