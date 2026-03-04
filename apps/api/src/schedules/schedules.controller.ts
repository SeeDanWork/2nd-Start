import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { SchedulesService } from './schedules.service';
import { FamiliesService } from '../families/families.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities';

@Controller('families/:familyId')
export class SchedulesController {
  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly familiesService: FamiliesService,
  ) {}

  @Get('calendar')
  @UseGuards(AuthGuard('jwt'))
  async getCalendar(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.schedulesService.getCalendar(familyId, start, end);
  }

  @Get('schedules/active')
  @UseGuards(AuthGuard('jwt'))
  async getActiveSchedule(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.schedulesService.getActiveSchedule(familyId);
  }

  @Get('schedules/history')
  @UseGuards(AuthGuard('jwt'))
  async getScheduleHistory(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.schedulesService.getScheduleHistory(familyId);
  }

  @Get('schedules/:version')
  @UseGuards(AuthGuard('jwt'))
  async getScheduleVersion(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Param('version') version: string,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.schedulesService.getScheduleVersion(familyId, parseInt(version, 10));
  }

  @Get('schedules/:version/assignments')
  @UseGuards(AuthGuard('jwt'))
  async getAssignments(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Param('version') version: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    const schedule = await this.schedulesService.getScheduleVersion(familyId, parseInt(version, 10));
    return this.schedulesService.getAssignments(familyId, schedule.id, start, end);
  }

  @Get('schedules/:version/export/ics')
  @UseGuards(AuthGuard('jwt'))
  async exportIcs(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Param('version') version: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Res() res: Response,
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    const ics = await this.schedulesService.exportIcs(
      familyId,
      parseInt(version, 10),
      start,
      end,
    );
    res
      .type('text/calendar')
      .set('Content-Disposition', 'attachment; filename="schedule.ics"')
      .send(ics);
  }

  @Post('schedules/generate')
  @UseGuards(AuthGuard('jwt'))
  async generateSchedule(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Body() body: {
      horizonStart?: string;
      horizonEnd?: string;
      weekendDefinition?: string;
      daycareExchangeDays?: number[];
    },
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.schedulesService.generateBaseSchedule(familyId, user.id, body);
  }

  @Post('schedules/manual')
  @UseGuards(AuthGuard('jwt'))
  async createManualSchedule(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Body() body: { assignments: Array<{ date: string; assignedTo: string }> },
  ) {
    await this.familiesService.verifyMembership(familyId, user.id);
    return this.schedulesService.createManualSchedule(familyId, user.id, body.assignments);
  }
}
