import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CalendarConnection,
  CalendarEvent,
  OvernightAssignment,
  BaseScheduleVersion,
} from '../entities';
import {
  CALENDAR_PROVIDER,
  CalendarProviderInterface,
} from './providers/calendar.provider.interface';

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    @Inject(CALENDAR_PROVIDER)
    private readonly calendarProvider: CalendarProviderInterface,
    @InjectRepository(CalendarConnection)
    private readonly connectionRepo: Repository<CalendarConnection>,
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    @InjectRepository(BaseScheduleVersion)
    private readonly scheduleRepo: Repository<BaseScheduleVersion>,
  ) {}

  async syncSchedule(
    familyId: string,
  ): Promise<{ created: number; updated: number; deleted: number }> {
    const connections = await this.connectionRepo.find({
      where: { familyId, isActive: true },
    });

    if (connections.length === 0) {
      this.logger.log(`No active calendar connections for family ${familyId}`);
      return { created: 0, updated: 0, deleted: 0 };
    }

    const activeVersion = await this.scheduleRepo.findOne({
      where: { familyId, isActive: true },
    });

    if (!activeVersion) {
      this.logger.log(`No active schedule version for family ${familyId}`);
      return { created: 0, updated: 0, deleted: 0 };
    }

    const assignments = await this.assignmentRepo.find({
      where: { scheduleVersionId: activeVersion.id },
    });

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;

    for (const connection of connections) {
      const result = await this.syncConnectionAssignments(
        connection,
        assignments,
      );
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalDeleted += result.deleted;

      await this.connectionRepo.update(connection.id, {
        lastSyncAt: new Date(),
      } as any);
    }

    this.logger.log(
      `Sync complete for family ${familyId}: created=${totalCreated}, updated=${totalUpdated}, deleted=${totalDeleted}`,
    );
    return { created: totalCreated, updated: totalUpdated, deleted: totalDeleted };
  }

  private async syncConnectionAssignments(
    connection: CalendarConnection,
    assignments: OvernightAssignment[],
  ): Promise<{ created: number; updated: number; deleted: number }> {
    const existingEvents = await this.eventRepo.find({
      where: { calendarConnectionId: connection.id },
    });

    const existingByAssignmentId = new Map<string, CalendarEvent>();
    for (const evt of existingEvents) {
      if (evt.assignmentId) {
        existingByAssignmentId.set(evt.assignmentId, evt);
      }
    }

    const currentAssignmentIds = new Set(assignments.map((a) => a.id));
    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Create or update events for current assignments
    for (const assignment of assignments) {
      const existing = existingByAssignmentId.get(assignment.id);

      if (!existing) {
        // New assignment — create event
        const newEvent = this.eventRepo.create({
          calendarConnectionId: connection.id,
          assignmentId: assignment.id,
          eventType: 'custody_block',
          title: `Custody: ${assignment.assignedTo}`,
          startTime: new Date(assignment.date),
          endTime: new Date(
            new Date(assignment.date).getTime() + 24 * 60 * 60 * 1000,
          ),
          syncStatus: 'pending',
          syncVersion: 1,
        });

        try {
          const externalId = await this.calendarProvider.createEvent(
            connection,
            newEvent,
          );
          newEvent.externalEventId = externalId;
          newEvent.syncStatus = 'synced';
          newEvent.lastSyncedAt = new Date();
        } catch (err) {
          this.logger.error(`Failed to create external event: ${err}`);
          newEvent.syncStatus = 'failed';
        }

        await this.eventRepo.save(newEvent);
        created++;
      } else {
        // Existing — check if update needed
        const expectedTitle = `Custody: ${assignment.assignedTo}`;
        if (existing.title !== expectedTitle && existing.externalEventId) {
          existing.title = expectedTitle;
          existing.syncVersion++;

          try {
            await this.calendarProvider.updateEvent(
              connection,
              existing.externalEventId,
              existing,
            );
            existing.syncStatus = 'synced';
            existing.lastSyncedAt = new Date();
          } catch (err) {
            this.logger.error(`Failed to update external event: ${err}`);
            existing.syncStatus = 'failed';
          }

          await this.eventRepo.save(existing);
          updated++;
        }
      }
    }

    // Delete events for removed assignments
    for (const evt of existingEvents) {
      if (evt.assignmentId && !currentAssignmentIds.has(evt.assignmentId)) {
        if (evt.externalEventId) {
          try {
            await this.calendarProvider.deleteEvent(
              connection,
              evt.externalEventId,
            );
          } catch (err) {
            this.logger.error(`Failed to delete external event: ${err}`);
          }
        }
        await this.eventRepo.remove(evt);
        deleted++;
      }
    }

    return { created, updated, deleted };
  }

  async getStatus(
    familyId: string,
  ): Promise<{ connections: number; pendingEvents: number; lastSync: Date | null }> {
    const connections = await this.connectionRepo.count({
      where: { familyId, isActive: true },
    });

    const pendingEvents = await this.eventRepo
      .createQueryBuilder('ce')
      .innerJoin('ce.calendarConnection', 'cc')
      .where('cc.family_id = :familyId', { familyId })
      .andWhere('cc.is_active = true')
      .andWhere("ce.sync_status = 'pending'")
      .getCount();

    const latestConnection = await this.connectionRepo.findOne({
      where: { familyId, isActive: true },
      order: { lastSyncAt: 'DESC' },
    });

    return {
      connections,
      pendingEvents,
      lastSync: latestConnection?.lastSyncAt ?? null,
    };
  }

  async forceSyncEvent(calendarEventId: string): Promise<void> {
    const event = await this.eventRepo.findOne({
      where: { id: calendarEventId },
      relations: ['calendarConnection'],
    });

    if (!event) {
      throw new Error(`Calendar event ${calendarEventId} not found`);
    }

    const connection = event.calendarConnection;

    if (event.externalEventId) {
      try {
        await this.calendarProvider.updateEvent(
          connection,
          event.externalEventId,
          event,
        );
        event.syncStatus = 'synced';
        event.lastSyncedAt = new Date();
      } catch (err) {
        this.logger.error(`Failed to force sync event: ${err}`);
        event.syncStatus = 'failed';
      }
    } else {
      try {
        const externalId = await this.calendarProvider.createEvent(
          connection,
          event,
        );
        event.externalEventId = externalId;
        event.syncStatus = 'synced';
        event.lastSyncedAt = new Date();
      } catch (err) {
        this.logger.error(`Failed to force create event: ${err}`);
        event.syncStatus = 'failed';
      }
    }

    await this.eventRepo.save(event);
  }
}
