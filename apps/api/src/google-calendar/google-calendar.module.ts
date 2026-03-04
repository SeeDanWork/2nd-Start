import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GoogleCalendarToken,
  OvernightAssignment,
  FamilyMembership,
  BaseScheduleVersion,
} from '../entities';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GoogleCalendarToken,
      OvernightAssignment,
      FamilyMembership,
      BaseScheduleVersion,
    ]),
  ],
  controllers: [GoogleCalendarController],
  providers: [GoogleCalendarAuthService, GoogleCalendarSyncService],
  exports: [GoogleCalendarSyncService],
})
export class GoogleCalendarModule {}
