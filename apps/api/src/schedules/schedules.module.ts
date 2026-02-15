import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import {
  BaseScheduleVersion,
  OvernightAssignment,
  HandoffEvent,
  HolidayCalendar,
  AuditLog,
  ConstraintSet,
  Constraint,
} from '../entities';
import { FamiliesModule } from '../families/families.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BaseScheduleVersion,
      OvernightAssignment,
      HandoffEvent,
      HolidayCalendar,
      AuditLog,
      ConstraintSet,
      Constraint,
    ]),
    HttpModule.register({
      timeout: 60000,
      baseURL: process.env.OPTIMIZER_URL || 'http://localhost:8000',
    }),
    FamiliesModule,
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
