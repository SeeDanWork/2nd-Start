import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CalendarConnection,
  CalendarEvent,
  OvernightAssignment,
  BaseScheduleVersion,
} from '../entities';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarSyncController } from './calendar-sync.controller';
import { CALENDAR_PROVIDER } from './providers/calendar.provider.interface';
import { ConsoleCalendarProvider } from './providers/console-calendar.provider';
import { GoogleCalendarProvider } from './providers/google-calendar.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarConnection,
      CalendarEvent,
      OvernightAssignment,
      BaseScheduleVersion,
    ]),
  ],
  providers: [
    {
      provide: CALENDAR_PROVIDER,
      useFactory: () => {
        if (process.env.GOOGLE_CLIENT_ID) {
          return new GoogleCalendarProvider();
        }
        return new ConsoleCalendarProvider();
      },
    },
    CalendarSyncService,
  ],
  controllers: [CalendarSyncController],
  exports: [CalendarSyncService],
})
export class CalendarSyncModule {}
