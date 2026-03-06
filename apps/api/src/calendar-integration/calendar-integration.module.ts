import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CalendarIntegrationController } from './calendar-integration.controller';
import { CalendarIntegrationService } from './calendar-integration.service';
import { CalendarSource } from '../entities/calendar-source.entity';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { CalendarSyncLog } from '../entities/calendar-sync-log.entity';
import { DisruptionEvent, AuditLog } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarSource,
      CalendarEvent,
      CalendarSyncLog,
      DisruptionEvent,
      AuditLog,
    ]),
    HttpModule.register({ timeout: 30000 }),
  ],
  controllers: [CalendarIntegrationController],
  providers: [CalendarIntegrationService],
  exports: [CalendarIntegrationService],
})
export class CalendarIntegrationModule {}
