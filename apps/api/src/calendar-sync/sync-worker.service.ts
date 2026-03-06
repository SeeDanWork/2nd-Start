import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CalendarSyncService } from './calendar-sync.service';

@Injectable()
export class SyncWorkerService implements OnModuleInit {
  private readonly logger = new Logger(SyncWorkerService.name);
  private queue: Queue | null = null;
  private useQueueFallback = true;

  constructor(private readonly calendarSyncService: CalendarSyncService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.queue = new Queue('calendar-sync', {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
      });
      // Test the connection by pinging
      await this.queue.client.then((client) => client.ping());
      this.useQueueFallback = false;
      this.logger.log('BullMQ queue "calendar-sync" connected');
    } catch (err) {
      this.logger.warn(
        `Redis not available for calendar-sync queue, using synchronous fallback: ${err}`,
      );
      this.queue = null;
      this.useQueueFallback = true;
    }
  }

  async enqueueSyncSchedule(familyId: string): Promise<void> {
    if (!this.useQueueFallback && this.queue) {
      await this.queue.add('sync-schedule', {
        type: 'sync-schedule',
        familyId,
      });
      this.logger.log(
        `Enqueued sync-schedule job for family ${familyId}`,
      );
    } else {
      this.logger.log(
        `Running synchronous calendar sync for family ${familyId}`,
      );
      try {
        await this.calendarSyncService.syncSchedule(familyId);
      } catch (err) {
        this.logger.error(
          `Synchronous calendar sync failed for family ${familyId}: ${err}`,
        );
      }
    }
  }

  async enqueueSyncEvent(calendarEventId: string): Promise<void> {
    if (!this.useQueueFallback && this.queue) {
      await this.queue.add('sync-event', {
        type: 'sync-event',
        calendarEventId,
      });
      this.logger.log(
        `Enqueued sync-event job for calendar event ${calendarEventId}`,
      );
    } else {
      this.logger.log(
        `Running synchronous event sync for calendar event ${calendarEventId}`,
      );
      try {
        await this.calendarSyncService.forceSyncEvent(calendarEventId);
      } catch (err) {
        this.logger.error(
          `Synchronous event sync failed for calendar event ${calendarEventId}: ${err}`,
        );
      }
    }
  }
}
