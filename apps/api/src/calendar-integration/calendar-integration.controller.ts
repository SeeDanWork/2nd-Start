import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CalendarIntegrationService } from './calendar-integration.service';

@Controller('families/:familyId/calendar-integration')
@UseGuards(AuthGuard('jwt'))
export class CalendarIntegrationController {
  constructor(private readonly service: CalendarIntegrationService) {}

  // ── Sources ────────────────────────────────────────────────────

  @Get('sources')
  async getSources(@Param('familyId') familyId: string) {
    return this.service.getSources(familyId);
  }

  @Post('sources/ics')
  async addIcsFeed(
    @Param('familyId') familyId: string,
    @Body() body: { label: string; url: string; syncFrequencyHours?: number; userId: string },
  ) {
    const source = await this.service.addIcsFeedSource(familyId, body.userId, {
      label: body.label,
      url: body.url,
      syncFrequencyHours: body.syncFrequencyHours,
    });
    // Trigger initial sync
    const syncLog = await this.service.syncIcsFeed(source.id);
    return { source, syncLog };
  }

  @Post('sources/google')
  async addGoogleCalendar(
    @Param('familyId') familyId: string,
    @Body() body: { label: string; googleCalendarId: string; userId: string },
  ) {
    return this.service.addGoogleCalendarSource(familyId, body.userId, {
      label: body.label,
      googleCalendarId: body.googleCalendarId,
    });
  }

  @Delete('sources/:sourceId')
  async removeSource(
    @Param('familyId') familyId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: { userId: string },
  ) {
    await this.service.removeSource(familyId, sourceId, body.userId);
    return { removed: true };
  }

  @Post('sources/:sourceId/sync')
  async syncSource(@Param('sourceId') sourceId: string) {
    return this.service.syncIcsFeed(sourceId);
  }

  @Get('sources/:sourceId/logs')
  async getSyncLogs(
    @Param('sourceId') sourceId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getSyncLogs(sourceId, limit ? parseInt(limit, 10) : 10);
  }

  // ── Events ─────────────────────────────────────────────────────

  @Get('events')
  async getEvents(
    @Param('familyId') familyId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.service.getEvents(familyId, start, end);
  }

  @Get('events/unresolved')
  async getUnresolvedEvents(@Param('familyId') familyId: string) {
    return this.service.getUnresolvedEvents(familyId);
  }

  @Post('events/manual')
  async addManualEvent(
    @Param('familyId') familyId: string,
    @Body() body: {
      userId: string;
      eventType: string;
      startDate: string;
      endDate: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    },
  ) {
    return this.service.addManualEvent(familyId, body.userId, body);
  }

  @Post('events/:eventId/resolve')
  async resolveEvent(
    @Param('familyId') familyId: string,
    @Param('eventId') eventId: string,
    @Body() body: { userId: string; eventType: string; createDisruption: boolean },
  ) {
    return this.service.resolveEvent(familyId, eventId, body.userId, body);
  }

  @Get('events/date/:date')
  async getResolvedEventsForDate(
    @Param('familyId') familyId: string,
    @Param('date') date: string,
  ) {
    return this.service.getResolvedEventsForDate(familyId, date);
  }

  // ── Cron ───────────────────────────────────────────────────────

  @Post('/calendar-integration/cron/sync')
  async cronSync() {
    return this.service.syncDueSources();
  }
}
