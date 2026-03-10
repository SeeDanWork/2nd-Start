import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import {
  ProposalBundle,
  ProposalOption,
  Acceptance,
  Request,
  OvernightAssignment,
  HandoffEvent,
  BaseScheduleVersion,
  AuditLog,
  ConstraintSet,
  Constraint,
  PreConsentRule,
  FamilyMembership,
} from '../entities';
import { SchedulesModule } from '../schedules/schedules.module';
import { FamilyContextModule } from '../family-context/family-context.module';
import { DisruptionsModule } from '../disruptions/disruptions.module';
import { NotificationModule } from '../notifications/notification.module';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProposalBundle,
      ProposalOption,
      Acceptance,
      Request,
      OvernightAssignment,
      HandoffEvent,
      BaseScheduleVersion,
      AuditLog,
      ConstraintSet,
      Constraint,
      PreConsentRule,
      FamilyMembership,
    ]),
    HttpModule.register({
      baseURL: process.env.OPTIMIZER_URL || 'http://localhost:8000',
      timeout: 60000,
    }),
    SchedulesModule,
    FamilyContextModule,
    DisruptionsModule,
    NotificationModule,
    FeedbackModule,
  ],
  controllers: [ProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
