import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google, calendar_v3 } from 'googleapis';
import {
  GoogleCalendarToken,
  OvernightAssignment,
  FamilyMembership,
  BaseScheduleVersion,
} from '../entities';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { ParentRole } from '@adcp/shared';

const CALENDAR_SUMMARY = 'ADCP Co-Parenting';

@Injectable()
export class GoogleCalendarSyncService {
  private readonly logger = new Logger(GoogleCalendarSyncService.name);

  constructor(
    @InjectRepository(GoogleCalendarToken)
    private readonly tokenRepo: Repository<GoogleCalendarToken>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    @InjectRepository(BaseScheduleVersion)
    private readonly versionRepo: Repository<BaseScheduleVersion>,
    private readonly authService: GoogleCalendarAuthService,
  ) {}

  /**
   * Creates the "ADCP Co-Parenting" sub-calendar if it doesn't exist yet,
   * or if the user deleted it. Stores the calendarId on the token record.
   */
  private async ensureCalendar(
    calendarApi: calendar_v3.Calendar,
    token: GoogleCalendarToken,
  ): Promise<string> {
    // If we have a stored calendarId, verify it still exists
    if (token.calendarId) {
      try {
        await calendarApi.calendars.get({ calendarId: token.calendarId });
        return token.calendarId;
      } catch {
        // Calendar was deleted by user — recreate
        this.logger.warn(
          `Calendar ${token.calendarId} no longer exists for user ${token.userId}, recreating`,
        );
      }
    }

    const res = await calendarApi.calendars.insert({
      requestBody: {
        summary: CALENDAR_SUMMARY,
        description: 'Custody schedule synced from ADCP Co-Parenting app',
        timeZone: 'America/New_York',
      },
    });

    const calendarId = res.data.id!;
    await this.tokenRepo.update(token.id, { calendarId } as any);
    token.calendarId = calendarId;
    this.logger.log(`Created calendar "${CALENDAR_SUMMARY}" (${calendarId}) for user ${token.userId}`);
    return calendarId;
  }

  /**
   * Deterministic event ID: adcp{familyId-first8-no-dashes}{YYYYMMDD}
   * Google requires lowercase alphanumeric, 5-1024 chars.
   */
  private makeEventId(familyId: string, date: string): string {
    const familySlug = familyId.replace(/-/g, '').substring(0, 8).toLowerCase();
    const dateSlug = date.replace(/-/g, '');
    return `adcp${familySlug}${dateSlug}`;
  }

  /**
   * Sync all assignments for a single user within a family.
   */
  async syncForUser(userId: string, familyId: string): Promise<void> {
    const client = await this.authService.getAuthenticatedClient(userId);
    if (!client) return; // Not connected — no-op

    const token = await this.tokenRepo.findOne({ where: { userId } });
    if (!token) return;

    try {
      const calendarApi = google.calendar({ version: 'v3', auth: client });
      const calendarId = await this.ensureCalendar(calendarApi, token);

      // Find the user's role in this family
      const membership = await this.membershipRepo.findOne({
        where: { familyId, userId },
      });
      if (!membership) return;

      const userRole = membership.role; // 'parent_a' or 'parent_b'

      // Get active schedule assignments
      const activeVersion = await this.versionRepo.findOne({
        where: { familyId, isActive: true },
      });
      if (!activeVersion) return;

      const assignments = await this.assignmentRepo.find({
        where: { familyId, scheduleVersionId: activeVersion.id },
        order: { date: 'ASC' },
      });

      // Upsert each assignment as an all-day event
      for (const assignment of assignments) {
        const eventId = this.makeEventId(familyId, assignment.date);
        const isYourNight = assignment.assignedTo === userRole;
        const summary = isYourNight ? 'Your Night' : "Co-Parent's Night";

        // Date format for all-day events: YYYY-MM-DD
        const startDate = assignment.date;
        const endDateObj = new Date(assignment.date + 'T00:00:00');
        endDateObj.setDate(endDateObj.getDate() + 1);
        const endDate = endDateObj.toISOString().split('T')[0];

        const eventBody: calendar_v3.Schema$Event = {
          id: eventId,
          summary,
          start: { date: startDate },
          end: { date: endDate },
          transparency: 'transparent',
          description: `Custody schedule — ${isYourNight ? 'child stays with you' : 'child stays with co-parent'}`,
        };

        try {
          await calendarApi.events.update({
            calendarId,
            eventId,
            requestBody: eventBody,
          });
        } catch (err: any) {
          if (err.code === 404) {
            // Event doesn't exist yet — insert
            await calendarApi.events.insert({
              calendarId,
              requestBody: eventBody,
            });
          } else {
            throw err;
          }
        }
      }

      await this.authService.markSyncSuccess(userId);
      this.logger.log(
        `Synced ${assignments.length} events to Google Calendar for user ${userId}`,
      );
    } catch (err: any) {
      this.logger.error(`Google Calendar sync failed for user ${userId}: ${err.message}`);
      await this.authService.markSyncError(userId, err.message);
    }
  }

  /**
   * Sync schedule for all connected family members. Errors are per-user.
   */
  async syncScheduleForFamily(familyId: string): Promise<void> {
    const memberships = await this.membershipRepo.find({
      where: { familyId },
    });

    for (const membership of memberships) {
      if (!membership.userId) continue;

      try {
        await this.syncForUser(membership.userId, familyId);
      } catch (err: any) {
        this.logger.warn(
          `Sync failed for user ${membership.userId} in family ${familyId}: ${err.message}`,
        );
      }
    }
  }

  /**
   * Delete the ADCP calendar from user's Google account (used on disconnect).
   */
  async clearCalendar(userId: string): Promise<void> {
    const client = await this.authService.getAuthenticatedClient(userId);
    if (!client) return;

    const token = await this.tokenRepo.findOne({ where: { userId } });
    if (!token?.calendarId) return;

    try {
      const calendarApi = google.calendar({ version: 'v3', auth: client });
      await calendarApi.calendars.delete({ calendarId: token.calendarId });
      this.logger.log(`Deleted calendar ${token.calendarId} for user ${userId}`);
    } catch (err: any) {
      this.logger.warn(`Failed to delete calendar: ${err.message}`);
    }
  }
}
