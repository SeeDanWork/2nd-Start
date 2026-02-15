import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import {
  Request,
  ChangeBudgetLedger,
  AuditLog,
  OvernightAssignment,
} from '../entities';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Request,
      ChangeBudgetLedger,
      AuditLog,
      OvernightAssignment,
    ]),
    SchedulesModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
