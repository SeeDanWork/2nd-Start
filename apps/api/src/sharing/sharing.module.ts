import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';
import {
  ShareLink,
  AuditLog,
  OvernightAssignment,
  HandoffEvent,
} from '../entities';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShareLink,
      AuditLog,
      OvernightAssignment,
      HandoffEvent,
    ]),
    SchedulesModule,
  ],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
