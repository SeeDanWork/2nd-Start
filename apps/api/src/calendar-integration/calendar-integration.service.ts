import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CalendarSource } from '../entities/calendar-source.entity';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { CalendarSyncLog } from '../entities/calendar-sync-log.entity';
import { DisruptionEvent, AuditLog } from '../entities';
import { parseIcs, classifyEvent } from '@adcp/shared/calendar';
import { DisruptionSource } from '@adcp/shared';

@Injectable()
export class CalendarIntegrationService {
  private readonly logger = new Logger(CalendarIntegrationService.name);

  constructor(
    @InjectRepository(CalendarSource)
    private readonly sourceRepo: Repository<CalendarSource>,
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @InjectRepository(CalendarSyncLog)
    private readonly syncLogRepo: Repository<CalendarSyncLog>,
    @InjectRepository(DisruptionEvent)
    private readonly disruptionRepo: Repository<DisruptionEvent>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly httpService: HttpService,
  ) {}

  // ── Source CRUD ────────────────────────────────────────────────

  async addIcsFeedSource(
    familyId: string,
    userId: string,
    dto: { label: string; url: string; syncFrequencyHours?: number },
  ): Promise<CalendarSource> {
    const source = await this.sourceRepo.save(
      this.sourceRepo.create({
        familyId,
        type: 'ics_feed',
        label: dto.label,
        url: dto.url,
        syncFrequencyHours: dto.syncFrequencyHours ?? 24,
        precedence: 50,
        createdBy: userId,
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'calendar_source.added',
        entityType: 'calendar_source',
        entityId: source.id,
        metadata: { type: 'ics_feed', label: dto.label },
      }),
    );

    return source;
  }

  async addManualSource(
    familyId: string,
    userId: string,
    label: string,
  ): Promise<CalendarSource> {
    // Check if a manual source already exists for this family
    const existing = await this.sourceRepo.findOne({
      where: { familyId, type: 'manual', isActive: true },
    });
    if (existing) return existing;

    return this.sourceRepo.save(
      this.sourceRepo.create({
        familyId,
        type: 'manual',
        label,
        precedence: 100,
        createdBy: userId,
      }),
    );
  }

  async addGoogleCalendarSource(
    familyId: string,
    userId: string,
    dto: { label: string; googleCalendarId: string },
  ): Promise<CalendarSource> {
    const source = await this.sourceRepo.save(
      this.sourceRepo.create({
        familyId,
        type: 'google_calendar',
        label: dto.label,
        googleCalendarId: dto.googleCalendarId,
        googleUserId: userId,
        syncFrequencyHours: 12,
        precedence: 25,
        createdBy: userId,
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'calendar_source.added',
        entityType: 'calendar_source',
        entityId: source.id,
        metadata: { type: 'google_calendar', label: dto.label },
      }),
    );

    return source;
  }

  async getSources(familyId: string): Promise<CalendarSource[]> {
    return this.sourceRepo.find({
      where: { familyId, isActive: true },
      order: { precedence: 'DESC', createdAt: 'ASC' },
    });
  }

  async removeSource(familyId: string, sourceId: string, userId: string): Promise<void> {
    const source = await this.sourceRepo.findOne({
      where: { id: sourceId, familyId },
    });
    if (!source) throw new NotFoundException('Calendar source not found');

    await this.sourceRepo.update(source.id, { isActive: false } as any);

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'calendar_source.removed',
        entityType: 'calendar_source',
        entityId: source.id,
        metadata: { type: source.type, label: source.label },
      }),
    );
  }

  // ── Manual Event Entry ─────────────────────────────────────────

  async addManualEvent(
    familyId: string,
    userId: string,
    dto: {
      eventType: string;
      startDate: string;
      endDate: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    },
  ): Promise<{ calendarEvent: CalendarEvent; disruptionEvent: DisruptionEvent }> {
    // Ensure a manual source exists
    const source = await this.addManualSource(familyId, userId, 'Manual Events');

    const calendarEvent = await this.eventRepo.save(
      this.eventRepo.create({
        familyId,
        sourceId: source.id,
        sourceType: 'manual',
        eventType: dto.eventType,
        rawSummary: dto.notes || dto.eventType,
        startDate: dto.startDate,
        endDate: dto.endDate,
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        confidence: 1.0,
        isResolved: true,
      }),
    );

    // Immediately create a disruption event for manual entries
    const disruptionEvent = await this.disruptionRepo.save(
      this.disruptionRepo.create({
        familyId,
        type: dto.eventType,
        source: DisruptionSource.USER_DECLARED,
        startDate: dto.startDate,
        endDate: dto.endDate,
        metadata: {
          calendarEventId: calendarEvent.id,
          calendarSourceId: source.id,
          notes: dto.notes,
        },
        reportedBy: userId,
      }),
    );

    // Link back
    await this.eventRepo.update(calendarEvent.id, {
      disruptionEventId: disruptionEvent.id,
    } as any);

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'calendar_event.manual_added',
        entityType: 'calendar_event',
        entityId: calendarEvent.id,
        metadata: { eventType: dto.eventType, startDate: dto.startDate, endDate: dto.endDate },
      }),
    );

    return { calendarEvent, disruptionEvent };
  }

  // ── ICS Feed Sync ──────────────────────────────────────────────

  async syncIcsFeed(sourceId: string): Promise<CalendarSyncLog> {
    const source = await this.sourceRepo.findOne({ where: { id: sourceId } });
    if (!source || source.type !== 'ics_feed' || !source.url) {
      throw new BadRequestException('Invalid ICS feed source');
    }

    const startTime = Date.now();
    let eventsFound = 0;
    let eventsCreated = 0;
    let eventsUpdated = 0;
    let disruptionsCreated = 0;

    try {
      // Download ICS feed
      const response = await firstValueFrom(
        this.httpService.get<string>(source.url, {
          timeout: 30000,
          responseType: 'text' as any,
        }),
      );

      const icsContent = typeof response.data === 'string'
        ? response.data
        : String(response.data);

      // Parse events
      const icsEvents = parseIcs(icsContent);
      eventsFound = icsEvents.length;

      // Classify and store each event
      for (const icsEvent of icsEvents) {
        const classification = classifyEvent(icsEvent.summary);
        if (!classification) continue; // Not schedule-relevant

        // Check if we already have this event (by external UID)
        const existing = icsEvent.uid
          ? await this.eventRepo.findOne({
              where: { sourceId: source.id, externalId: icsEvent.uid },
            })
          : null;

        if (existing) {
          // Update if dates changed
          if (existing.startDate !== icsEvent.startDate || existing.endDate !== icsEvent.endDate) {
            await this.eventRepo.update(existing.id, {
              startDate: icsEvent.startDate,
              endDate: icsEvent.endDate,
              startTime: icsEvent.startTime,
              endTime: icsEvent.endTime,
              rawSummary: icsEvent.summary,
              eventType: classification.eventType,
              confidence: classification.confidence,
            } as any);
            eventsUpdated++;

            // Update linked disruption if exists
            if (existing.disruptionEventId) {
              await this.disruptionRepo.update(existing.disruptionEventId, {
                startDate: icsEvent.startDate,
                endDate: icsEvent.endDate,
                type: classification.eventType,
              } as any);
            }
          }
          continue;
        }

        // Create new calendar event
        const calendarEvent = await this.eventRepo.save(
          this.eventRepo.create({
            familyId: source.familyId,
            sourceId: source.id,
            externalId: icsEvent.uid || null,
            sourceType: 'ics_feed',
            eventType: classification.eventType,
            rawSummary: icsEvent.summary,
            startDate: icsEvent.startDate,
            endDate: icsEvent.endDate,
            startTime: icsEvent.startTime,
            endTime: icsEvent.endTime,
            confidence: classification.confidence,
          }),
        );
        eventsCreated++;

        // Auto-create disruption for high-confidence events
        if (classification.confidence >= 0.8) {
          const disruption = await this.createDisruptionFromEvent(
            source.familyId,
            calendarEvent,
            classification.eventType,
            source.id,
          );
          if (disruption) {
            disruptionsCreated++;
            await this.eventRepo.update(calendarEvent.id, {
              disruptionEventId: disruption.id,
              isResolved: true,
            } as any);
          }
        }
      }

      // Update source last synced
      await this.sourceRepo.update(source.id, {
        lastSyncedAt: new Date(),
        lastSyncError: null,
      } as any);

      const log = await this.syncLogRepo.save(
        this.syncLogRepo.create({
          sourceId: source.id,
          status: 'success',
          eventsFound,
          eventsCreated,
          eventsUpdated,
          disruptionsCreated,
          durationMs: Date.now() - startTime,
        }),
      );

      this.logger.log(
        `ICS sync complete for source ${source.id}: ${eventsFound} found, ${eventsCreated} created, ${disruptionsCreated} disruptions`,
      );

      return log;
    } catch (err: any) {
      await this.sourceRepo.update(source.id, {
        lastSyncError: err.message,
      } as any);

      const log = await this.syncLogRepo.save(
        this.syncLogRepo.create({
          sourceId: source.id,
          status: 'error',
          eventsFound,
          eventsCreated,
          eventsUpdated,
          disruptionsCreated,
          errorMessage: err.message,
          durationMs: Date.now() - startTime,
        }),
      );

      this.logger.error(`ICS sync failed for source ${source.id}: ${err.message}`);
      return log;
    }
  }

  // ── Sync All Due Sources ───────────────────────────────────────

  async syncDueSources(): Promise<{ synced: number; errors: number }> {
    const now = new Date();
    const sources = await this.sourceRepo.find({
      where: { isActive: true },
    });

    let synced = 0;
    let errors = 0;

    for (const source of sources) {
      if (source.type === 'manual') continue;

      // Check if sync is due
      if (source.lastSyncedAt) {
        const nextSyncDue = new Date(
          source.lastSyncedAt.getTime() + source.syncFrequencyHours * 3600_000,
        );
        if (nextSyncDue > now) continue;
      }

      try {
        if (source.type === 'ics_feed') {
          await this.syncIcsFeed(source.id);
          synced++;
        }
        // google_calendar sync handled separately via GoogleCalendarSyncService
      } catch {
        errors++;
      }
    }

    return { synced, errors };
  }

  // ── Event Queries ──────────────────────────────────────────────

  async getEvents(
    familyId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<CalendarEvent[]> {
    const qb = this.eventRepo.createQueryBuilder('e')
      .where('e.familyId = :familyId', { familyId })
      .orderBy('e.startDate', 'ASC');

    if (startDate) {
      qb.andWhere('e.endDate >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('e.startDate <= :endDate', { endDate });
    }

    return qb.getMany();
  }

  async getUnresolvedEvents(familyId: string): Promise<CalendarEvent[]> {
    return this.eventRepo.find({
      where: { familyId, isResolved: false },
      order: { startDate: 'ASC' },
    });
  }

  async resolveEvent(
    familyId: string,
    eventId: string,
    userId: string,
    dto: { eventType: string; createDisruption: boolean },
  ): Promise<CalendarEvent> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId, familyId },
    });
    if (!event) throw new NotFoundException('Calendar event not found');

    await this.eventRepo.update(event.id, {
      eventType: dto.eventType,
      isResolved: true,
    } as any);

    if (dto.createDisruption && !event.disruptionEventId) {
      const disruption = await this.createDisruptionFromEvent(
        familyId,
        event,
        dto.eventType,
        event.sourceId,
      );
      if (disruption) {
        await this.eventRepo.update(event.id, {
          disruptionEventId: disruption.id,
        } as any);
      }
    }

    return this.eventRepo.findOneOrFail({ where: { id: eventId } });
  }

  async getSyncLogs(sourceId: string, limit: number = 10): Promise<CalendarSyncLog[]> {
    return this.syncLogRepo.find({
      where: { sourceId },
      order: { syncedAt: 'DESC' },
      take: limit,
    });
  }

  // ── Precedence Resolution ──────────────────────────────────────

  /**
   * When multiple sources produce events for the same date,
   * the source with higher precedence wins.
   * manual (100) > ics_feed (50) > google_calendar (25)
   */
  async getResolvedEventsForDate(
    familyId: string,
    date: string,
  ): Promise<CalendarEvent[]> {
    const events = await this.eventRepo
      .createQueryBuilder('e')
      .innerJoin(CalendarSource, 's', 's.id = e.sourceId')
      .where('e.familyId = :familyId', { familyId })
      .andWhere('e.startDate <= :date AND e.endDate >= :date', { date })
      .orderBy('s.precedence', 'DESC')
      .addOrderBy('e.confidence', 'DESC')
      .getMany();

    return events;
  }

  // ── Private Helpers ────────────────────────────────────────────

  private async createDisruptionFromEvent(
    familyId: string,
    event: CalendarEvent,
    eventType: string,
    sourceId: string,
  ): Promise<DisruptionEvent | null> {
    // Check for duplicate disruption on same dates
    const existing = await this.disruptionRepo.findOne({
      where: {
        familyId,
        type: eventType,
        startDate: event.startDate,
        endDate: event.endDate,
        resolvedAt: IsNull(),
      },
    });
    if (existing) return existing;

    return this.disruptionRepo.save(
      this.disruptionRepo.create({
        familyId,
        type: eventType,
        source: DisruptionSource.AUTO_INFERRED,
        startDate: event.startDate,
        endDate: event.endDate,
        metadata: {
          calendarEventId: event.id,
          calendarSourceId: sourceId,
          rawSummary: event.rawSummary,
          confidence: event.confidence,
        },
      }),
    );
  }
}
