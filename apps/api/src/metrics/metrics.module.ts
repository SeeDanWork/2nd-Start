import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import {
  LedgerSnapshot,
  StabilitySnapshot,
  OvernightAssignment,
  HandoffEvent,
  BaseScheduleVersion,
  AuditLog,
  Request,
} from '../entities';
import { FamiliesModule } from '../families/families.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { FamilyContextModule } from '../family-context/family-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LedgerSnapshot,
      StabilitySnapshot,
      OvernightAssignment,
      HandoffEvent,
      BaseScheduleVersion,
      AuditLog,
      Request,
    ]),
    FamiliesModule,
    SchedulesModule,
    FamilyContextModule,
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
