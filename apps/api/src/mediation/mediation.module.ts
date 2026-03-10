import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediationController } from './mediation.controller';
import { MediationService } from './mediation.service';
import { PreConflictService } from './preconflict.service';
import {
  Request,
  ProposalBundle,
  ProposalOption,
  Acceptance,
  AuditLog,
  FamilyMembership,
} from '../entities';
import { ProposalsModule } from '../proposals/proposals.module';
import { MetricsModule } from '../metrics/metrics.module';
import { FamilyContextModule } from '../family-context/family-context.module';
import { NotificationModule } from '../notifications/notification.module';
import { GuardrailsModule } from '../guardrails/guardrails.module';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Request,
      ProposalBundle,
      ProposalOption,
      Acceptance,
      AuditLog,
      FamilyMembership,
    ]),
    ProposalsModule,
    MetricsModule,
    FamilyContextModule,
    NotificationModule,
    GuardrailsModule,
    FeedbackModule,
  ],
  controllers: [MediationController],
  providers: [MediationService, PreConflictService],
  exports: [MediationService, PreConflictService],
})
export class MediationModule {}
