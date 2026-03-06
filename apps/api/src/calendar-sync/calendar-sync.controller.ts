import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CalendarSyncService } from './calendar-sync.service';

@Controller('calendar-sync')
@UseGuards(AuthGuard('jwt'))
export class CalendarSyncController {
  constructor(private readonly calendarSyncService: CalendarSyncService) {}

  @Get(':familyId/status')
  async getStatus(@Param('familyId') familyId: string) {
    return this.calendarSyncService.getStatus(familyId);
  }

  @Post(':familyId/force-sync')
  async forceSync(@Param('familyId') familyId: string) {
    return this.calendarSyncService.syncSchedule(familyId);
  }
}
